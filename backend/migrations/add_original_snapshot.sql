-- Migration: Add original_snapshot column to tailored_cvs table
-- Description: Stores the pristine original state of the CV for restoration functionality
-- Created: 2025-01-17

-- Add original_snapshot column (nullable, since existing CVs won't have this)
ALTER TABLE tailored_cvs
ADD COLUMN IF NOT EXISTS original_snapshot JSON;

-- Create an index for faster queries if needed
CREATE INDEX IF NOT EXISTS idx_tailored_cvs_original_snapshot
ON tailored_cvs USING GIN (original_snapshot);

-- Optional: For existing CVs, copy current content_snapshot to original_snapshot
-- This preserves the current state as "original" for existing records
-- Uncomment if you want to backfill existing CVs:
-- UPDATE tailored_cvs
-- SET original_snapshot = content_snapshot
-- WHERE original_snapshot IS NULL;
