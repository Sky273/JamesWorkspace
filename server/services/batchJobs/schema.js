/**
 * Batch Jobs Schema
 * Database table initialization and migrations for batch jobs
 */

import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';

/**
 * Initialize the batch_jobs table if it doesn't exist
 */
export async function initializeBatchJobsTable() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS batch_jobs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                job_type VARCHAR(50) NOT NULL DEFAULT 'import',
                options JSONB DEFAULT '{}',
                total_items INTEGER DEFAULT 0,
                processed_items INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                error_count INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                started_at TIMESTAMP WITH TIME ZONE,
                completed_at TIMESTAMP WITH TIME ZONE,
                error_message TEXT,
                export_file_path TEXT,
                export_file_name TEXT
            )
        `);
        
        // Add columns if they don't exist (for existing tables)
        await query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_jobs' AND column_name = 'export_file_path') THEN
                    ALTER TABLE batch_jobs ADD COLUMN export_file_path TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_jobs' AND column_name = 'export_file_name') THEN
                    ALTER TABLE batch_jobs ADD COLUMN export_file_name TEXT;
                END IF;
            END $$;
        `);

        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resumes' AND column_name = 'relative_path') THEN
                    ALTER TABLE resumes ADD COLUMN relative_path VARCHAR(1024);
                END IF;
            END $$;
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS batch_job_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                job_id UUID REFERENCES batch_jobs(id) ON DELETE CASCADE,
                resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
                file_name VARCHAR(255),
                file_data BYTEA,
                file_mime_type VARCHAR(100),
                relative_path VARCHAR(1024),
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                error_message TEXT,
                original_name VARCHAR(255),
                display_name VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                processed_at TIMESTAMP WITH TIME ZONE
            )
        `);
        
        // Add relative_path column if it doesn't exist (for existing tables)
        await query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_job_items' AND column_name = 'relative_path') THEN
                    ALTER TABLE batch_job_items ADD COLUMN relative_path VARCHAR(1024);
                END IF;
            END $$;
        `);

        // Create indexes for performance
        await query(`
            CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);
            CREATE INDEX IF NOT EXISTS idx_batch_jobs_firm_id ON batch_jobs(firm_id);
            CREATE INDEX IF NOT EXISTS idx_batch_jobs_user_id ON batch_jobs(user_id);
            CREATE INDEX IF NOT EXISTS idx_batch_job_items_job_id ON batch_job_items(job_id);
            CREATE INDEX IF NOT EXISTS idx_batch_job_items_status ON batch_job_items(status);
        `);

        // Add new columns if they don't exist (migration for existing tables)
        await query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_job_items' AND column_name = 'original_name') THEN
                    ALTER TABLE batch_job_items ADD COLUMN original_name VARCHAR(255);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_job_items' AND column_name = 'display_name') THEN
                    ALTER TABLE batch_job_items ADD COLUMN display_name VARCHAR(255);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_job_items' AND column_name = 'pending_data') THEN
                    ALTER TABLE batch_job_items ADD COLUMN pending_data JSONB;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_job_items' AND column_name = 'source_type') THEN
                    ALTER TABLE batch_job_items ADD COLUMN source_type VARCHAR(20) DEFAULT 'resume';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_job_items' AND column_name = 'adaptation_id') THEN
                    ALTER TABLE batch_job_items ADD COLUMN adaptation_id UUID;
                END IF;
            END $$;
        `);

        safeLog('info', 'Batch jobs tables initialized');
        return true;
    } catch (error) {
        safeLog('error', 'Failed to initialize batch jobs tables', { error: error.message });
        throw error;
    }
}
