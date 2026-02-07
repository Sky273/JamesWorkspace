-- Migration 007: Add resume_file_data column for storing CV files in database
-- This replaces the file system storage approach (uploads directory)

-- Add column for binary file data
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS resume_file_data BYTEA;

-- Add comment for documentation
COMMENT ON COLUMN resumes.resume_file_data IS 'Binary content of the original CV file (PDF, DOCX, etc.)';

-- Note: resume_file_url will now be used as a virtual path for download endpoint
-- e.g., /api/resumes/:id/download instead of /uploads/filename
