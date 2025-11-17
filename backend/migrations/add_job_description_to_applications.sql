-- Migration: Add job_description column to job_applications table
-- Description: Stores the complete job description from tailored_cvs for easy reference in Application Tracker
-- Created: 2025-01-17

-- Add job_description column (nullable, since existing applications won't have this)
ALTER TABLE job_applications
ADD COLUMN IF NOT EXISTS job_description TEXT;

-- Backfill job_description from related tailored_cvs for existing job applications
UPDATE job_applications ja
SET job_description = tc.job_description
FROM tailored_cvs tc
WHERE ja.tailored_cv_id = tc.id
  AND ja.job_description IS NULL
  AND tc.job_description IS NOT NULL;

-- Optional: Create an index for faster text searches if needed
-- CREATE INDEX IF NOT EXISTS idx_job_applications_job_description
-- ON job_applications USING GIN (to_tsvector('english', job_description));
