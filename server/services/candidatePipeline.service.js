/**
 * Candidate Pipeline Service
 * Manages the selection pipeline for candidates (freelancers, partner employees)
 * Includes interview scheduling with calendar integration
 */

import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';

// Pipeline stages configuration
export const PIPELINE_STAGES = [
    { id: 'new', label: 'Nouveau', labelEn: 'New', order: 1, color: '#6B7280' },
    { id: 'screening', label: 'Présélection', labelEn: 'Screening', order: 2, color: '#3B82F6' },
    { id: 'submitted', label: 'Soumis au client', labelEn: 'Submitted to Client', order: 3, color: '#8B5CF6' },
    { id: 'interview', label: 'Entretien planifié', labelEn: 'Interview Scheduled', order: 4, color: '#F59E0B' },
    { id: 'interview_done', label: 'Entretien effectué', labelEn: 'Interview Done', order: 5, color: '#10B981' },
    { id: 'selected', label: 'Sélectionné', labelEn: 'Selected', order: 6, color: '#059669' },
    { id: 'rejected', label: 'Non retenu', labelEn: 'Not Selected', order: 7, color: '#EF4444' },
    { id: 'on_hold', label: 'En attente', labelEn: 'On Hold', order: 8, color: '#F97316' }
];

/**
 * Initialize the candidate_pipeline table
 * Creates the table if it doesn't exist
 */
export async function initCandidatePipelineTable() {
    try {
        // Create candidate_pipeline table
        await query(`
            CREATE TABLE IF NOT EXISTS candidate_pipeline (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
                mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
                client_id UUID,
                stage VARCHAR(50) NOT NULL DEFAULT 'new',
                notes TEXT,
                created_by UUID NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                moved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(resume_id, mission_id)
            )
        `);

        // Create pipeline_history table for tracking stage changes
        await query(`
            CREATE TABLE IF NOT EXISTS pipeline_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                pipeline_id UUID NOT NULL REFERENCES candidate_pipeline(id) ON DELETE CASCADE,
                from_stage VARCHAR(50),
                to_stage VARCHAR(50) NOT NULL,
                changed_by UUID NOT NULL,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create pipeline_interviews table for interview scheduling
        await query(`
            CREATE TABLE IF NOT EXISTS pipeline_interviews (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                pipeline_id UUID NOT NULL REFERENCES candidate_pipeline(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                interview_type VARCHAR(50) DEFAULT 'client',
                scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
                duration_minutes INTEGER DEFAULT 60,
                location VARCHAR(255),
                meeting_link VARCHAR(500),
                attendees JSONB DEFAULT '[]',
                calendar_event_id VARCHAR(255),
                calendar_provider VARCHAR(50),
                status VARCHAR(50) DEFAULT 'scheduled',
                outcome VARCHAR(50),
                outcome_notes TEXT,
                created_by UUID NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes
        await query(`
            CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_resume_id ON candidate_pipeline(resume_id);
            CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_mission_id ON candidate_pipeline(mission_id);
            CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_client_id ON candidate_pipeline(client_id);
            CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_stage ON candidate_pipeline(stage);
            CREATE INDEX IF NOT EXISTS idx_pipeline_history_pipeline_id ON pipeline_history(pipeline_id);
            CREATE INDEX IF NOT EXISTS idx_pipeline_interviews_pipeline_id ON pipeline_interviews(pipeline_id);
            CREATE INDEX IF NOT EXISTS idx_pipeline_interviews_scheduled_at ON pipeline_interviews(scheduled_at);
        `);

        // Migration: Drop old foreign key constraint on client_id if it exists (was pointing to firms)
        try {
            await query(`ALTER TABLE candidate_pipeline DROP CONSTRAINT IF EXISTS candidate_pipeline_client_id_fkey`);
            safeLog('info', 'Dropped old client_id foreign key constraint');
        } catch (migrationError) {
            // Constraint might not exist - that's fine
            safeLog('debug', 'Migration note: client_id constraint', { note: migrationError.message });
        }

        safeLog('info', 'Candidate pipeline tables initialized');
        return true;
    } catch (error) {
        safeLog('error', 'Failed to initialize candidate pipeline tables', { error: error.message });
        throw error;
    }
}

// ============================================
// PIPELINE CRUD OPERATIONS
// ============================================

/**
 * Add a resume to the pipeline
 */
export async function addToPipeline({ resumeId, missionId, clientId, stage = 'new', notes, createdBy }) {
    try {
        const result = await query(`
            INSERT INTO candidate_pipeline (resume_id, mission_id, client_id, stage, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (resume_id, mission_id) DO UPDATE SET
                stage = EXCLUDED.stage,
                client_id = COALESCE(EXCLUDED.client_id, candidate_pipeline.client_id),
                notes = COALESCE(EXCLUDED.notes, candidate_pipeline.notes),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [resumeId, missionId, clientId, stage, notes, createdBy]);

        const pipeline = result.rows[0];

        // Add to history
        await addToHistory({
            pipelineId: pipeline.id,
            fromStage: null,
            toStage: stage,
            changedBy: createdBy,
            notes: 'Ajouté au pipeline'
        });

        safeLog('info', 'Resume added to pipeline', { resumeId, missionId, stage });
        return pipeline;
    } catch (error) {
        safeLog('error', 'Failed to add resume to pipeline', { error: error.message });
        throw error;
    }
}

/**
 * Get pipeline entry by ID
 */
export async function getPipelineById(pipelineId) {
    try {
        const result = await query(`
            SELECT 
                cp.*,
                r.name as resume_name,
                r.improved_text,
                m.title as mission_title,
                mc.name as mission_client,
                c.name as client_name
            FROM candidate_pipeline cp
            LEFT JOIN resumes r ON cp.resume_id = r.id
            LEFT JOIN missions m ON cp.mission_id = m.id
            LEFT JOIN clients mc ON m.client_id = mc.id
            LEFT JOIN clients c ON cp.client_id = c.id
            WHERE cp.id = $1
        `, [pipelineId]);

        return result.rows[0] || null;
    } catch (error) {
        safeLog('error', 'Failed to get pipeline entry', { error: error.message });
        throw error;
    }
}

/**
 * Get pipeline entries for a resume
 */
export async function getPipelineByResumeId(resumeId) {
    try {
        const result = await query(`
            SELECT 
                cp.*,
                m.title as mission_title,
                mc.name as mission_client,
                c.name as client_name,
                (SELECT COUNT(*) FROM pipeline_interviews pi WHERE pi.pipeline_id = cp.id) as interview_count,
                (SELECT scheduled_at FROM pipeline_interviews pi WHERE pi.pipeline_id = cp.id AND pi.status = 'scheduled' ORDER BY scheduled_at ASC LIMIT 1) as next_interview
            FROM candidate_pipeline cp
            LEFT JOIN missions m ON cp.mission_id = m.id
            LEFT JOIN clients mc ON m.client_id = mc.id
            LEFT JOIN clients c ON cp.client_id = c.id
            WHERE cp.resume_id = $1
            ORDER BY cp.updated_at DESC
        `, [resumeId]);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get pipeline for resume', { error: error.message });
        throw error;
    }
}

/**
 * Get pipeline entries for a mission (Kanban view)
 */
export async function getPipelineByMissionId(missionId) {
    try {
        const result = await query(`
            SELECT 
                cp.*,
                r.name as resume_name,
                r.global_score,
                r.tags,
                (SELECT COUNT(*) FROM pipeline_interviews pi WHERE pi.pipeline_id = cp.id) as interview_count,
                (SELECT scheduled_at FROM pipeline_interviews pi WHERE pi.pipeline_id = cp.id AND pi.status = 'scheduled' ORDER BY scheduled_at ASC LIMIT 1) as next_interview
            FROM candidate_pipeline cp
            LEFT JOIN resumes r ON cp.resume_id = r.id
            WHERE cp.mission_id = $1
            ORDER BY cp.moved_at DESC
        `, [missionId]);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get pipeline for mission', { error: error.message });
        throw error;
    }
}

/**
 * Get all pipeline entries grouped by stage (for dashboard)
 */
export async function getPipelineOverview(filters = {}) {
    try {
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (filters.clientId) {
            whereClause += ` AND cp.client_id = $${paramIndex++}`;
            params.push(filters.clientId);
        }

        if (filters.missionId) {
            whereClause += ` AND cp.mission_id = $${paramIndex++}`;
            params.push(filters.missionId);
        }

        const result = await query(`
            SELECT 
                cp.stage,
                COUNT(*) as count,
                json_agg(json_build_object(
                    'id', cp.id,
                    'resume_id', cp.resume_id,
                    'resume_name', r.name,
                    'mission_title', m.title,
                    'client_name', c.name,
                    'updated_at', cp.updated_at,
                    'next_interview', (SELECT scheduled_at FROM pipeline_interviews pi WHERE pi.pipeline_id = cp.id AND pi.status = 'scheduled' ORDER BY scheduled_at ASC LIMIT 1)
                ) ORDER BY cp.moved_at DESC) as items
            FROM candidate_pipeline cp
            LEFT JOIN resumes r ON cp.resume_id = r.id
            LEFT JOIN missions m ON cp.mission_id = m.id
            LEFT JOIN clients c ON cp.client_id = c.id
            ${whereClause}
            GROUP BY cp.stage
        `, params);

        // Transform to stage-keyed object
        const overview = {};
        for (const stage of PIPELINE_STAGES) {
            const stageData = result.rows.find(r => r.stage === stage.id);
            overview[stage.id] = {
                ...stage,
                count: stageData?.count || 0,
                items: stageData?.items || []
            };
        }

        return overview;
    } catch (error) {
        safeLog('error', 'Failed to get pipeline overview', { error: error.message });
        throw error;
    }
}

/**
 * Move a candidate to a different stage
 */
export async function moveToStage({ pipelineId, newStage, changedBy, notes }) {
    try {
        // Get current stage
        const current = await query(`
            SELECT stage FROM candidate_pipeline WHERE id = $1
        `, [pipelineId]);

        if (current.rows.length === 0) {
            throw new Error('Pipeline entry not found');
        }

        const fromStage = current.rows[0].stage;

        // Update stage
        const result = await query(`
            UPDATE candidate_pipeline
            SET stage = $1, updated_at = CURRENT_TIMESTAMP, moved_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `, [newStage, pipelineId]);

        // Add to history
        await addToHistory({
            pipelineId,
            fromStage,
            toStage: newStage,
            changedBy,
            notes
        });

        safeLog('info', 'Pipeline stage updated', { pipelineId, fromStage, toStage: newStage });
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Failed to move pipeline stage', { error: error.message });
        throw error;
    }
}

/**
 * Update pipeline notes
 */
export async function updatePipelineNotes({ pipelineId, notes }) {
    try {
        const result = await query(`
            UPDATE candidate_pipeline
            SET notes = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `, [notes, pipelineId]);

        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Failed to update pipeline notes', { error: error.message });
        throw error;
    }
}

/**
 * Remove from pipeline
 */
export async function removeFromPipeline(pipelineId) {
    try {
        await query(`DELETE FROM candidate_pipeline WHERE id = $1`, [pipelineId]);
        safeLog('info', 'Removed from pipeline', { pipelineId });
        return true;
    } catch (error) {
        safeLog('error', 'Failed to remove from pipeline', { error: error.message });
        throw error;
    }
}

// ============================================
// HISTORY OPERATIONS
// ============================================

/**
 * Add entry to pipeline history
 */
async function addToHistory({ pipelineId, fromStage, toStage, changedBy, notes }) {
    try {
        await query(`
            INSERT INTO pipeline_history (pipeline_id, from_stage, to_stage, changed_by, notes)
            VALUES ($1, $2, $3, $4, $5)
        `, [pipelineId, fromStage, toStage, changedBy, notes]);
    } catch (error) {
        safeLog('error', 'Failed to add pipeline history', { error: error.message });
    }
}

/**
 * Get pipeline history
 */
export async function getPipelineHistory(pipelineId) {
    try {
        const result = await query(`
            SELECT 
                ph.*,
                u.name as changed_by_name
            FROM pipeline_history ph
            LEFT JOIN users u ON ph.changed_by = u.id
            WHERE ph.pipeline_id = $1
            ORDER BY ph.created_at DESC
        `, [pipelineId]);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get pipeline history', { error: error.message });
        throw error;
    }
}

// ============================================
// INTERVIEW OPERATIONS
// ============================================

/**
 * Schedule an interview
 */
export async function scheduleInterview({
    pipelineId,
    title,
    description,
    interviewType = 'client',
    scheduledAt,
    durationMinutes = 60,
    location,
    meetingLink,
    attendees = [],
    calendarEventId,
    calendarProvider,
    createdBy
}) {
    try {
        const result = await query(`
            INSERT INTO pipeline_interviews (
                pipeline_id, title, description, interview_type, scheduled_at,
                duration_minutes, location, meeting_link, attendees,
                calendar_event_id, calendar_provider, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            pipelineId, title, description, interviewType, scheduledAt,
            durationMinutes, location, meetingLink, JSON.stringify(attendees),
            calendarEventId, calendarProvider, createdBy
        ]);

        // Auto-move to interview stage if currently in earlier stage
        const pipeline = await getPipelineById(pipelineId);
        const currentStageOrder = PIPELINE_STAGES.find(s => s.id === pipeline.stage)?.order || 0;
        const interviewStageOrder = PIPELINE_STAGES.find(s => s.id === 'interview')?.order || 4;

        if (currentStageOrder < interviewStageOrder) {
            await moveToStage({
                pipelineId,
                newStage: 'interview',
                changedBy: createdBy,
                notes: `Entretien planifié: ${title}`
            });
        }

        safeLog('info', 'Interview scheduled', { pipelineId, scheduledAt });
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Failed to schedule interview', { error: error.message });
        throw error;
    }
}

/**
 * Get interviews for a pipeline entry
 */
export async function getInterviews(pipelineId) {
    try {
        const result = await query(`
            SELECT * FROM pipeline_interviews
            WHERE pipeline_id = $1
            ORDER BY scheduled_at ASC
        `, [pipelineId]);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get interviews', { error: error.message });
        throw error;
    }
}

/**
 * Get upcoming interviews (for dashboard/calendar)
 */
export async function getUpcomingInterviews(filters = {}) {
    try {
        let whereClause = 'WHERE pi.scheduled_at >= NOW() AND pi.status = $1';
        const params = ['scheduled'];
        let paramIndex = 2;

        if (filters.userId) {
            // Filter by creator or attendee
            whereClause += ` AND (pi.created_by = $${paramIndex} OR pi.attendees @> $${paramIndex + 1}::jsonb)`;
            params.push(filters.userId, JSON.stringify([{ id: filters.userId }]));
            paramIndex += 2;
        }

        if (filters.days) {
            whereClause += ` AND pi.scheduled_at <= NOW() + INTERVAL '${parseInt(filters.days)} days'`;
        }

        const result = await query(`
            SELECT 
                pi.*,
                cp.resume_id,
                r.name as resume_name,
                m.title as mission_title,
                c.name as client_name
            FROM pipeline_interviews pi
            JOIN candidate_pipeline cp ON pi.pipeline_id = cp.id
            LEFT JOIN resumes r ON cp.resume_id = r.id
            LEFT JOIN missions m ON cp.mission_id = m.id
            LEFT JOIN clients c ON cp.client_id = c.id
            ${whereClause}
            ORDER BY pi.scheduled_at ASC
            LIMIT 50
        `, params);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get upcoming interviews', { error: error.message });
        throw error;
    }
}

/**
 * Update interview
 */
export async function updateInterview(interviewId, updates) {
    try {
        const allowedFields = [
            'title', 'description', 'scheduled_at', 'duration_minutes',
            'location', 'meeting_link', 'attendees', 'status', 'outcome', 'outcome_notes'
        ];

        const setClauses = [];
        const params = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            if (allowedFields.includes(snakeKey)) {
                setClauses.push(`${snakeKey} = $${paramIndex++}`);
                params.push(key === 'attendees' ? JSON.stringify(value) : value);
            }
        }

        if (setClauses.length === 0) {
            throw new Error('No valid fields to update');
        }

        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(interviewId);

        const result = await query(`
            UPDATE pipeline_interviews
            SET ${setClauses.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `, params);

        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Failed to update interview', { error: error.message });
        throw error;
    }
}

/**
 * Complete an interview with outcome
 */
export async function completeInterview({ interviewId, outcome, outcomeNotes, changedBy }) {
    try {
        const result = await query(`
            UPDATE pipeline_interviews
            SET status = 'completed', outcome = $1, outcome_notes = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `, [outcome, outcomeNotes, interviewId]);

        const interview = result.rows[0];

        // Get pipeline and potentially update stage
        const pipeline = await getPipelineById(interview.pipeline_id);
        
        if (pipeline.stage === 'interview') {
            await moveToStage({
                pipelineId: interview.pipeline_id,
                newStage: 'interview_done',
                changedBy,
                notes: `Entretien terminé: ${outcome}`
            });
        }

        return interview;
    } catch (error) {
        safeLog('error', 'Failed to complete interview', { error: error.message });
        throw error;
    }
}

/**
 * Cancel an interview
 */
export async function cancelInterview(interviewId) {
    try {
        const result = await query(`
            UPDATE pipeline_interviews
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [interviewId]);

        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Failed to cancel interview', { error: error.message });
        throw error;
    }
}

/**
 * Delete an interview
 */
export async function deleteInterview(interviewId) {
    try {
        await query(`DELETE FROM pipeline_interviews WHERE id = $1`, [interviewId]);
        return true;
    } catch (error) {
        safeLog('error', 'Failed to delete interview', { error: error.message });
        throw error;
    }
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get pipeline statistics
 */
export async function getPipelineStats(filters = {}) {
    try {
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (filters.missionId) {
            whereClause += ` AND cp.mission_id = $${paramIndex++}`;
            params.push(filters.missionId);
        }

        if (filters.clientId) {
            whereClause += ` AND cp.client_id = $${paramIndex++}`;
            params.push(filters.clientId);
        }

        const result = await query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE cp.stage = 'new') as new_count,
                COUNT(*) FILTER (WHERE cp.stage = 'screening') as screening_count,
                COUNT(*) FILTER (WHERE cp.stage = 'submitted') as submitted_count,
                COUNT(*) FILTER (WHERE cp.stage = 'interview') as interview_count,
                COUNT(*) FILTER (WHERE cp.stage = 'interview_done') as interview_done_count,
                COUNT(*) FILTER (WHERE cp.stage = 'selected') as selected_count,
                COUNT(*) FILTER (WHERE cp.stage = 'rejected') as rejected_count,
                COUNT(*) FILTER (WHERE cp.stage = 'on_hold') as on_hold_count,
                (SELECT COUNT(*) FROM pipeline_interviews pi 
                 JOIN candidate_pipeline cp2 ON pi.pipeline_id = cp2.id 
                 ${whereClause.replace('cp.', 'cp2.')} AND pi.status = 'scheduled' AND pi.scheduled_at >= NOW()
                ) as upcoming_interviews
            FROM candidate_pipeline cp
            ${whereClause}
        `, params);

        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Failed to get pipeline stats', { error: error.message });
        throw error;
    }
}

export default {
    PIPELINE_STAGES,
    initCandidatePipelineTable,
    addToPipeline,
    getPipelineById,
    getPipelineByResumeId,
    getPipelineByMissionId,
    getPipelineOverview,
    moveToStage,
    updatePipelineNotes,
    removeFromPipeline,
    getPipelineHistory,
    scheduleInterview,
    getInterviews,
    getUpcomingInterviews,
    updateInterview,
    completeInterview,
    cancelInterview,
    deleteInterview,
    getPipelineStats
};
