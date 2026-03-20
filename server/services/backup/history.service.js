/**
 * Backup History Service
 * Handles backup history CRUD and stale entry cleanup
 */

import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';

/**
 * Allowed column names for dynamic UPDATE on the backup_history table.
 * Any key not in this set is silently dropped to prevent SQL injection.
 */
const ALLOWED_COLUMNS = new Set([
    'status', 'file_size', 'size_bytes', 'error_message', 'completed_at'
]);

/**
 * Cleanup stale "running" entries that have been stuck for more than 30 minutes
 * This handles cases where the backup process crashed without updating the status
 */
export async function cleanupStaleRunningEntries() {
    try {
        const result = await query(`
            UPDATE backup_history 
            SET status = 'failed', 
                error_message = 'Backup process timed out or crashed',
                completed_at = NOW()
            WHERE status = 'running' 
            AND started_at < NOW() - INTERVAL '30 minutes'
            RETURNING id
        `);
        if (result.rows.length > 0) {
            safeLog('info', 'Cleaned up stale running backup entries', { 
                count: result.rows.length,
                ids: result.rows.map(r => r.id)
            });
        }
    } catch (error) {
        safeLog('error', 'Failed to cleanup stale running entries', { error: error.message });
    }
}

/**
 * Create a backup history entry
 */
export async function createHistoryEntry(type, filename) {
    // First, cleanup any stale running entries
    await cleanupStaleRunningEntries();
    
    const result = await query(`
        INSERT INTO backup_history (backup_type, filename, status)
        VALUES ($1, $2, 'running')
        RETURNING *
    `, [type, filename]);
    return result.rows[0];
}

/**
 * Update backup history entry
 */
export async function updateHistoryEntry(id, updates) {
    const setClauses = [];
    const values = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updates)) {
        if (ALLOWED_COLUMNS.has(key)) {
            setClauses.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        }
    }
    
    values.push(id);
    
    await query(`
        UPDATE backup_history SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
    `, values);
}

/**
 * Get backup history
 */
export async function getBackupHistory(limit = 50, offset = 0) {
    // Cleanup stale running entries before returning history
    await cleanupStaleRunningEntries();
    
    const result = await query(`
        SELECT * FROM backup_history
        ORDER BY started_at DESC
        LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    const countResult = await query('SELECT COUNT(*) FROM backup_history');
    
    return {
        items: result.rows,
        total: parseInt(countResult.rows[0].count, 10)
    };
}

/**
 * Delete a backup history entry
 */
export async function deleteHistoryEntry(id) {
    await query('DELETE FROM backup_history WHERE id = $1', [id]);
}
