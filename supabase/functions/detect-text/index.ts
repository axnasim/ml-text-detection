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

    // Validate input parameters
    if (!jobId || typeof jobId !== 'string') {
      return new Response(
        JSON.stringify({ error: "Valid Job ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({ error: "Either imageUrl or imageBase64 must be provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate base64 image size (max 10MB when decoded)
    if (imageBase64) {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const sizeInBytes = (base64Data.length * 3) / 4;
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (sizeInBytes > maxSize) {
        return new Response(
          JSON.stringify({ error: "Image size exceeds 10MB limit" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate base64 format
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
        return new Response(
          JSON.stringify({ error: "Invalid base64 image format" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
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

    // Store detected text in database
    const detectedTexts = [];
    
    // First annotation is the full text, store it separately
    // Skip the first annotation (index 0) for individual text elements as it contains the full text
    const fullTextAnnotation = textAnnotations[0];
    
    // Store the full text as the first entry
    const fullTextData = {
      job_id: jobId,
      text_content: fullTextAnnotation.description,
      confidence: fullTextAnnotation.confidence || 0.95,
      bounding_box: fullTextAnnotation.boundingPoly?.vertices ? JSON.stringify(fullTextAnnotation.boundingPoly.vertices) : null,
      language: fullTextAnnotation.locale || null,
    };

    const { data: fullTextResult, error: fullTextError } = await supabase
      .from("detected_text")
      .insert(fullTextData)
      .select()
      .single();

    if (fullTextError) {
      console.error("Error inserting full text:", fullTextError);
    } else {
      detectedTexts.push(fullTextResult);
    }

    // Process individual text elements (skip first annotation which is full text)
    for (let i = 1; i < textAnnotations.length; i++) {
      const annotation = textAnnotations[i];
      const boundingBox = annotation.boundingPoly?.vertices || null;
      
      const detectionData = {
        job_id: jobId,
        text_content: annotation.description,
        confidence: annotation.confidence || 0.95, // GCP doesn't always provide confidence for text
        bounding_box: boundingBox ? JSON.stringify(boundingBox) : null,
        language: annotation.locale || null,
      };

      const { data, error } = await supabase
        .from("detected_text")
        .insert(detectionData)
        .select()
        .single();

      if (error) {
        console.error("Error inserting detected text:", error);
      } else {
        detectedTexts.push(data);
      }
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
        message: `Detected ${detectedTexts.length} text elements`,
        detections: detectedTexts
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in detect-text function:", error);
    
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