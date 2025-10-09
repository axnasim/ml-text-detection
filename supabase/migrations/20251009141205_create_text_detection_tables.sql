/*
  # Text Detection System Schema

  ## Overview
  This migration creates the database schema for storing text detection results from images processed through GCP Vision API.

  ## New Tables
  
  ### `detection_jobs`
  Stores information about each text detection job submitted by users.
  - `id` (uuid, primary key) - Unique identifier for each detection job
  - `user_id` (uuid, nullable) - User who submitted the job (nullable for anonymous usage)
  - `image_url` (text) - URL or path to the uploaded image
  - `status` (text) - Job status: 'pending', 'processing', 'completed', 'failed'
  - `created_at` (timestamptz) - When the job was created
  - `updated_at` (timestamptz) - When the job was last updated
  - `error_message` (text, nullable) - Error details if job failed

  ### `detected_text`
  Stores the actual text detected from images.
  - `id` (uuid, primary key) - Unique identifier for each text detection
  - `job_id` (uuid, foreign key) - Reference to the detection job
  - `text_content` (text) - The detected text content
  - `confidence` (numeric) - Confidence score from GCP Vision API (0-1)
  - `bounding_box` (jsonb, nullable) - Coordinates of detected text region
  - `language` (text, nullable) - Detected language of the text
  - `created_at` (timestamptz) - When the detection was recorded

  ## Security
  - Enable RLS on both tables
  - Users can view their own detection jobs
  - Users can insert their own detection jobs
  - Anonymous users can create jobs (for demo purposes)
  - All users can view detected text for jobs they have access to

  ## Indexes
  - Index on `detection_jobs.user_id` for faster user queries
  - Index on `detection_jobs.status` for filtering by status
  - Index on `detected_text.job_id` for joining with jobs
*/

-- Create detection_jobs table
CREATE TABLE IF NOT EXISTS detection_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  image_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  error_message text,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create detected_text table
CREATE TABLE IF NOT EXISTS detected_text (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES detection_jobs(id) ON DELETE CASCADE,
  text_content text NOT NULL,
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  bounding_box jsonb,
  language text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_detection_jobs_user_id ON detection_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_detection_jobs_status ON detection_jobs(status);
CREATE INDEX IF NOT EXISTS idx_detected_text_job_id ON detected_text(job_id);

-- Enable Row Level Security
ALTER TABLE detection_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_text ENABLE ROW LEVEL SECURITY;

-- RLS Policies for detection_jobs

-- Allow anyone to insert detection jobs (for anonymous usage)
CREATE POLICY "Anyone can create detection jobs"
  ON detection_jobs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can view their own jobs, or all jobs if user_id is null (anonymous)
CREATE POLICY "Users can view own or anonymous jobs"
  ON detection_jobs
  FOR SELECT
  TO anon, authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

-- Users can update their own jobs
CREATE POLICY "Users can update own jobs"
  ON detection_jobs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow service role to update any job (for edge function)
CREATE POLICY "Service role can update any job"
  ON detection_jobs
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for detected_text

-- Anyone can view detected text for jobs they have access to
CREATE POLICY "Users can view text for accessible jobs"
  ON detected_text
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM detection_jobs
      WHERE detection_jobs.id = detected_text.job_id
      AND (detection_jobs.user_id IS NULL OR detection_jobs.user_id = auth.uid())
    )
  );

-- Service role can insert detected text
CREATE POLICY "Service role can insert detected text"
  ON detected_text
  FOR INSERT
  TO service_role
  WITH CHECK (true);