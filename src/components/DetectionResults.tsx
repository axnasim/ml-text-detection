import { DetectedText } from '../lib/supabase';
import { FileText, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface DetectionResultsProps {
  detections: DetectedText[];
  fullText: string;
}

export default function DetectionResults({ detections, fullText }: DetectionResultsProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  if (detections.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-gray-600">No text detected in the image</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Detected Text</h3>
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Text
              </>
            )}
          </button>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
          <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
            {fullText}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Detection Details ({detections.length} elements)
        </h3>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {detections.map((detection, index) => (
            <div
              key={detection.id}
              className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {detection.text_content}
                </p>
                <div className="flex gap-4 mt-1">
                  <span className="text-xs text-gray-500">
                    Confidence: {(detection.confidence * 100).toFixed(1)}%
                  </span>
                  {detection.language && (
                    <span className="text-xs text-gray-500">
                      Language: {detection.language}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-400 ml-4">#{index + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
