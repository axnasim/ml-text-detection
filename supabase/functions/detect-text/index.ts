import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DetectionRequest {
  imageUrl?: string;
  imageBase64?: string;
  jobId: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { imageUrl, imageBase64, jobId }: DetectionRequest = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "Job ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate job exists and is pending before processing
    const { data: job, error: jobFetchError } = await supabase
      .from("detection_jobs")
      .select("id,status")
      .eq("id", jobId)
      .maybeSingle();

    if (jobFetchError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch job: ${jobFetchError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (job.status !== "pending") {
      return new Response(
        JSON.stringify({ error: `Job is not pending (current status: ${job.status})` }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update job status to processing
    await supabase
      .from("detection_jobs")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    // Get GCP API key from environment
    const gcpApiKey = Deno.env.get("GCP_VISION_API_KEY");
    
    if (!gcpApiKey) {
      // Update job with error
      await supabase
        .from("detection_jobs")
        .update({ 
          status: "failed", 
          error_message: "GCP Vision API key not configured",
          updated_at: new Date().toISOString()
        })
        .eq("id", jobId);

      return new Response(
        JSON.stringify({ error: "GCP Vision API key not configured. Please set GCP_VISION_API_KEY in edge function secrets." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare image for GCP Vision API
    let imageContent: any;
    if (imageBase64) {
      imageContent = { content: imageBase64.replace(/^data:image\/\w+;base64,/, "") };
    } else if (imageUrl) {
      imageContent = { source: { imageUri: imageUrl } };
    } else {
      throw new Error("Either imageUrl or imageBase64 must be provided");
    }

    // Call GCP Vision API
    const visionApiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${gcpApiKey}`;
    const visionResponse = await fetch(visionApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            image: imageContent,
            features: [
              {
                type: "TEXT_DETECTION",
                maxResults: 50,
              },
            ],
          },
        ],
      }),
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      throw new Error(`GCP Vision API error: ${errorText}`);
    }

    const visionData = await visionResponse.json();
    const textAnnotations = visionData.responses[0]?.textAnnotations || [];

    if (textAnnotations.length === 0) {
      // No text detected
      await supabase
        .from("detection_jobs")
        .update({ 
          status: "completed",
          updated_at: new Date().toISOString()
        })
        .eq("id", jobId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No text detected in image",
          detections: [] 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Store detected text in database (bulk insert for performance)
    const detectedTextsPayload = textAnnotations.map((annotation: any) => {
      const boundingBox = annotation.boundingPoly?.vertices ?? null;
      return {
        job_id: jobId,
        text_content: annotation.description,
        confidence: typeof annotation.confidence === "number" ? annotation.confidence : 0.95,
        // Store as proper JSON in jsonb column (no stringify)
        bounding_box: boundingBox,
        language: annotation.locale ?? null,
      };
    });

    const { data: insertedDetections, error: insertError } = await supabase
      .from("detected_text")
      .insert(detectedTextsPayload)
      .select();

    if (insertError) {
      // Mark job as failed on insert error
      await supabase
        .from("detection_jobs")
        .update({
          status: "failed",
          error_message: `Failed to store detections: ${insertError.message}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return new Response(
        JSON.stringify({ error: `Failed to store detections: ${insertError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update job status to completed
    await supabase
      .from("detection_jobs")
      .update({ 
        status: "completed",
        updated_at: new Date().toISOString()
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Detected ${insertedDetections?.length ?? 0} text elements`,
        detections: insertedDetections ?? []
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in detect-text function:", error);
    // Attempt to mark job as failed if we have jobId
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        const admin = createClient(supabaseUrl, supabaseServiceKey);
        const bodyText = await req.text().catch(() => null);
        const parsed = bodyText ? JSON.parse(bodyText) as Partial<DetectionRequest> : null;
        const failedJobId = parsed?.jobId;
        if (failedJobId) {
          await admin
            .from("detection_jobs")
            .update({
              status: "failed",
              error_message: error instanceof Error ? error.message : "Unknown error occurred",
              updated_at: new Date().toISOString(),
            })
            .eq("id", failedJobId);
        }
      }
    } catch (_) {
      // best-effort; ignore secondary failures
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});