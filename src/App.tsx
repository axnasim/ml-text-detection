import { useState } from 'react';
import { FileSearch, Loader2, AlertCircle } from 'lucide-react';
import ImageUploader from './components/ImageUploader';
import DetectionResults from './components/DetectionResults';
import { supabase, DetectedText } from './lib/supabase';

function App() {
  const [imageData, setImageData] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<DetectedText[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [lastRequestTime, setLastRequestTime] = useState<number>(0);

  const handleImageSelect = async (data: string, file: File) => {
    setImageData(data);
    setDetections([]);
    setError(null);
    setJobId(null);
  };

  const handleDetectText = async () => {
    if (!imageData) return;

    // Rate limiting: prevent requests more frequent than every 2 seconds
    const now = Date.now();
    const minInterval = 2000; // 2 seconds
    if (now - lastRequestTime < minInterval) {
      setError('Please wait a moment before making another request');
      return;
    }
    setLastRequestTime(now);

    setDetecting(true);
    setError(null);

    try {
      const { data: job, error: jobError } = await supabase
        .from('detection_jobs')
        .insert({
          image_url: 'base64_image',
          status: 'pending',
        })
        .select()
        .maybeSingle();

      if (jobError || !job) {
        throw new Error(jobError?.message || 'Failed to create detection job');
      }

      setJobId(job.id);

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-text`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: imageData,
          jobId: job.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to detect text');
      }

      const { data: detectedTexts, error: fetchError } = await supabase
        .from('detected_text')
        .select('*')
        .eq('job_id', job.id)
        .order('created_at', { ascending: true });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setDetections(detectedTexts || []);
    } catch (err) {
      console.error('Error detecting text:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while detecting text');
    } finally {
      setDetecting(false);
    }
  };

  // The first detection contains the full text from GCP Vision API
  // If no detections, show empty string
  const fullText = detections.length > 0 ? detections[0].text_content : '';
  
  // Individual text elements (excluding the first one which is full text)
  const individualDetections = detections.length > 1 ? detections.slice(1) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileSearch className="h-10 w-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">
              Text Detection with GCP
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Upload an image and extract text using Google Cloud Vision API. Powered by advanced machine learning models deployed on GCP.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Upload Image
              </h2>
              <ImageUploader
                onImageSelect={handleImageSelect}
                disabled={detecting}
              />
            </div>

            {imageData && (
              <button
                onClick={handleDetectText}
                disabled={detecting}
                className="w-full bg-blue-600 text-white px-6 py-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-md"
              >
                {detecting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Detecting Text...
                  </>
                ) : (
                  <>
                    <FileSearch className="h-5 w-5" />
                    Detect Text
                  </>
                )}
              </button>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-red-900 mb-1">
                    Error
                  </h3>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            {detecting ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Analyzing image with GCP Vision API...</p>
              </div>
            ) : detections.length > 0 || (jobId && !detecting) ? (
              <DetectionResults detections={individualDetections} fullText={fullText} />
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <FileSearch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  Upload an image to see detection results
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            About This Application
          </h3>
          <div className="prose prose-sm text-gray-600">
            <p>
              This application demonstrates text detection using Google Cloud Platform's Vision API.
              The system uses advanced machine learning models to extract text from images with high accuracy.
            </p>
            <ul className="mt-3 space-y-2">
              <li>Detects text in multiple languages</li>
              <li>Provides confidence scores for each detection</li>
              <li>Stores results in Supabase for history tracking</li>
              <li>Processes images securely through edge functions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
