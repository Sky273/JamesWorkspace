import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';

async function addToHistory({ pipelineId, fromStage, toStage, changedBy, notes }) {
    try {
        await query(
            `
            INSERT INTO pipeline_history (pipeline_id, from_stage, to_stage, changed_by, notes)
            VALUES ($1, $2, $3, $4, $5)
        `,
            [pipelineId, fromStage, toStage, changedBy, notes]
        );
    } catch (error) {
        safeLog('error', 'Failed to add pipeline history', { error: error.message });
    }
}

async function getPipelineHistory(pipelineId) {
    try {
        const result = await query(
            `
            SELECT 
                ph.*,
                u.name as changed_by_name
            FROM pipeline_history ph
            LEFT JOIN users u ON ph.changed_by = u.id
            WHERE ph.pipeline_id = $1
            ORDER BY ph.created_at DESC
        `,
            [pipelineId]
        );

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get pipeline history', { error: error.message });
        throw error;
    }
}

export {
    addToHistory,
    getPipelineHistory
};
