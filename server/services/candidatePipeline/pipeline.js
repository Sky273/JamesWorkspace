import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';
import { addToHistory } from './history.js';

async function addToPipeline({ resumeId, missionId, clientId, stage = 'new', notes, createdBy }) {
    try {
        const result = await query(
            `
            INSERT INTO candidate_pipeline (resume_id, mission_id, client_id, stage, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (resume_id, mission_id) DO UPDATE SET
                stage = EXCLUDED.stage,
                client_id = COALESCE(EXCLUDED.client_id, candidate_pipeline.client_id),
                notes = COALESCE(EXCLUDED.notes, candidate_pipeline.notes),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `,
            [resumeId, missionId, clientId, stage, notes, createdBy]
        );

        const pipeline = result.rows[0];
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

async function getPipelineById(pipelineId) {
    try {
        const result = await query(
            `
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
        `,
            [pipelineId]
        );

        return result.rows[0] || null;
    } catch (error) {
        safeLog('error', 'Failed to get pipeline entry', { error: error.message });
        throw error;
    }
}

async function getPipelineByResumeId(resumeId) {
    try {
        const result = await query(
            `
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
        `,
            [resumeId]
        );

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get pipeline for resume', { error: error.message });
        throw error;
    }
}

async function getPipelineByMissionId(missionId) {
    try {
        const result = await query(
            `
            SELECT 
                cp.*,
                r.name as resume_name,
                r.global_rating as global_score,
                r.skills as tags,
                (SELECT COUNT(*) FROM pipeline_interviews pi WHERE pi.pipeline_id = cp.id) as interview_count,
                (SELECT scheduled_at FROM pipeline_interviews pi WHERE pi.pipeline_id = cp.id AND pi.status = 'scheduled' ORDER BY scheduled_at ASC LIMIT 1) as next_interview
            FROM candidate_pipeline cp
            LEFT JOIN resumes r ON cp.resume_id = r.id
            WHERE cp.mission_id = $1
            ORDER BY cp.moved_at DESC
        `,
            [missionId]
        );

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get pipeline for mission', { error: error.message });
        throw error;
    }
}

async function getPipelineOverview(filters = {}, pipelineStages) {
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

        if (filters.firmId) {
            whereClause += ` AND COALESCE(m.firm_id, r.firm_id, c.firm_id) = $${paramIndex++}`;
            params.push(filters.firmId);
        }

        const result = await query(
            `
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
        `,
            params
        );

        const overview = {};
        for (const stage of pipelineStages) {
            const stageData = result.rows.find((row) => row.stage === stage.id);
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

async function moveToStage({ pipelineId, newStage, changedBy, notes }) {
    try {
        const current = await query('SELECT stage FROM candidate_pipeline WHERE id = $1', [pipelineId]);
        if (current.rows.length === 0) {
            throw new Error('Pipeline entry not found');
        }

        const fromStage = current.rows[0].stage;
        const result = await query(
            `
            UPDATE candidate_pipeline
            SET stage = $1, updated_at = CURRENT_TIMESTAMP, moved_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `,
            [newStage, pipelineId]
        );

        await addToHistory({ pipelineId, fromStage, toStage: newStage, changedBy, notes });
        safeLog('info', 'Pipeline stage updated', { pipelineId, fromStage, toStage: newStage });
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Failed to move pipeline stage', { error: error.message });
        throw error;
    }
}

async function updatePipelineNotes({ pipelineId, notes }) {
    try {
        const result = await query(
            `
            UPDATE candidate_pipeline
            SET notes = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `,
            [notes, pipelineId]
        );

        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Failed to update pipeline notes', { error: error.message });
        throw error;
    }
}

async function removeFromPipeline(pipelineId) {
    try {
        await query('DELETE FROM candidate_pipeline WHERE id = $1', [pipelineId]);
        safeLog('info', 'Removed from pipeline', { pipelineId });
        return true;
    } catch (error) {
        safeLog('error', 'Failed to remove from pipeline', { error: error.message });
        throw error;
    }
}

export {
    addToPipeline,
    getPipelineById,
    getPipelineByMissionId,
    getPipelineByResumeId,
    getPipelineOverview,
    moveToStage,
    removeFromPipeline,
    updatePipelineNotes
};
