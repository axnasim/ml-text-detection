import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface DetectionJob {
  id: string;
  user_id: string | null;
  image_url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  error_message: string | null;
}

export interface DetectedText {
  id: string;
  job_id: string;
  text_content: string;
  confidence: number;
  bounding_box: any;
  language: string | null;
  created_at: string;
}
