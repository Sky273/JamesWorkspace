/**
 * Batch Jobs - Item CRUD Operations
 * Create, read, update operations for batch job items
 */

import { query } from '../../config/database.js';
import fs from 'fs/promises';
import { safeLog } from '../../utils/logger.backend.js';
import { stripNullCharacters, stripNullCharactersDeep } from '../../utils/sanitizer.backend.js';
import { ITEM_STATUS, BATCH_SIZE } from './constants.js';

const MAX_BATCH_INSERT_BYTES = 64 * 1024 * 1024;

function sanitizeDbString(value) {
    return typeof value === 'string' ? stripNullCharacters(value) : value;
}

async function refreshJobItemCount(jobId) {
    await query(`
        UPDATE batch_jobs
        SET total_items = (SELECT COUNT(*) FROM batch_job_items WHERE job_id = $1)
        WHERE id = $1
    `, [jobId]);
}

async function insertJobItems(jobId, items) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const addedCount = normalizedItems.length;

    if (addedCount > 0) {
        const valuePlaceholders = [];
        const params = [];

        normalizedItems.forEach((item, index) => {
            const offset = index * 6;
            valuePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
            params.push(jobId, item.fileName, item.fileData, item.fileMimeType, item.relativePath || null, ITEM_STATUS.PENDING);
        });

        await query(`
            INSERT INTO batch_job_items (job_id, file_name, file_data, file_mime_type, relative_path, status)
            VALUES ${valuePlaceholders.join(', ')}
        `, params);
    }

    return addedCount;
}

async function cleanupUploadedFile(file) {
    if (file?.path) {
        await fs.unlink(file.path).catch(() => {});
    }
}

/**
 * Add items to a batch job
 * @param {string} jobId - Job ID
 * @param {Array} items - Array of { fileName, fileData, fileMimeType, relativePath }
 * @returns {Promise<number>} Number of items added
 */
export async function addJobItems(jobId, items) {
    try {
        const addedCount = await insertJobItems(jobId, items);
        await refreshJobItemCount(jobId);

        safeLog('info', 'Added items to batch job', { jobId, count: addedCount });
        return addedCount;
    } catch (error) {
        safeLog('error', 'Failed to add items to batch job', { error: error.message, jobId });
        throw error;
    }
}

export async function addJobItemsFromUploadedFiles(jobId, uploadedFiles) {
    const normalizedFiles = Array.isArray(uploadedFiles) ? uploadedFiles : [];
    let addedCount = 0;
    let currentBatch = [];
    let currentBatchBytes = 0;

    const flushBatch = async () => {
        if (currentBatch.length === 0) {
            return;
        }

        addedCount += await insertJobItems(jobId, currentBatch);
        currentBatch = [];
        currentBatchBytes = 0;
    };

    try {
        for (const file of normalizedFiles) {
            const fileBuffer = file?.buffer || await fs.readFile(file.path);

            if (currentBatch.length > 0 && currentBatchBytes + fileBuffer.length > MAX_BATCH_INSERT_BYTES) {
                await flushBatch();
            }

            currentBatch.push({
                fileName: file.originalname,
                fileData: fileBuffer,
                fileMimeType: file.fileMimeType || file.mimetype,
                relativePath: file.relativePath || null
            });
            currentBatchBytes += fileBuffer.length;

            await cleanupUploadedFile(file);
        }

        await flushBatch();

        await refreshJobItemCount(jobId);

        safeLog('info', 'Added uploaded files to batch job', { jobId, count: addedCount });
        return addedCount;
    } catch (error) {
        await Promise.all(normalizedFiles.map((file) => cleanupUploadedFile(file)));
        safeLog('error', 'Failed to add uploaded files to batch job', { error: error.message, jobId });
        throw error;
    }
}

/**
 * Add resume IDs to a batch job (for improvement jobs)
 * @param {string} jobId - Job ID
 * @param {Array<number>} resumeIds - Array of resume IDs
 * @returns {Promise<number>} Number of items added
 */
export async function addJobResumeIds(jobId, resumeIds) {
    try {
        let addedCount = 0;

        for (const resumeId of resumeIds) {
            // Get resume name for display
            const resumeResult = await query(`
                SELECT name FROM resumes WHERE id = $1
            `, [resumeId]);
            
            const fileName = resumeResult.rows[0]?.name || `Resume ${resumeId}`;

            await query(`
                INSERT INTO batch_job_items (job_id, resume_id, file_name, status)
                VALUES ($1, $2, $3, $4)
            `, [jobId, resumeId, fileName, ITEM_STATUS.PENDING]);
            addedCount++;
        }

        await refreshJobItemCount(jobId);

        safeLog('info', 'Added resume IDs to batch job', { jobId, count: addedCount });
        return addedCount;
    } catch (error) {
        safeLog('error', 'Failed to add resume IDs to batch job', { error: error.message, jobId });
        throw error;
    }
}

/**
 * Add generic task items to a batch job
 * @param {string} jobId - Job ID
 * @param {Array} items - Array of { resumeId?, fileName, sourceType?, originalName?, resultData? }
 * @returns {Promise<number>} Number of items added
 */
export async function addJobTaskItems(jobId, items) {
    try {
        const normalizedItems = Array.isArray(items) ? items : [];
        let addedCount = 0;

        for (const item of normalizedItems) {
            await query(`
                INSERT INTO batch_job_items (job_id, resume_id, file_name, source_type, original_name, pending_data, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                jobId,
                item.resumeId || null,
                item.fileName,
                item.sourceType || null,
                item.originalName || null,
                item.resultData ? JSON.stringify(item.resultData) : null,
                ITEM_STATUS.PENDING
            ]);
            addedCount++;
        }

        await refreshJobItemCount(jobId);

        safeLog('info', 'Added task items to batch job', { jobId, count: addedCount });
        return addedCount;
    } catch (error) {
        safeLog('error', 'Failed to add task items to batch job', { error: error.message, jobId });
        throw error;
    }
}

/**
 * Add export items to a batch job (for deal-export jobs)
 * @param {string} jobId - Job ID
 * @param {Array} items - Array of { resumeId, adaptationId, sourceType, fileName, relativePath }
 * @returns {Promise<number>} Number of items added
 */
export async function addJobExportItems(jobId, items) {
    try {
        let addedCount = 0;

        for (const item of items) {
            await query(`
                INSERT INTO batch_job_items (job_id, resume_id, adaptation_id, source_type, file_name, relative_path, original_name, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                jobId,
                item.resumeId || null,
                item.adaptationId || null,
                item.sourceType,
                item.fileName,
                item.relativePath || null,
                item.originalName || null,
                ITEM_STATUS.PENDING
            ]);
            addedCount++;
        }

        await refreshJobItemCount(jobId);

        safeLog('info', 'Added export items to batch job', { jobId, count: addedCount });
        return addedCount;
    } catch (error) {
        safeLog('error', 'Failed to add export items to batch job', { error: error.message, jobId });
        throw error;
    }
}

/**
 * Get job items
 * @param {string} jobId - Job ID
 * @returns {Promise<Array>} Job items
 */
export async function getJobItems(jobId) {
    try {
        const result = await query(`
            SELECT id, job_id, resume_id, adaptation_id, source_type, file_name, relative_path, status, progress, error_message,
                   original_name, display_name, pending_data, created_at, processed_at
            FROM batch_job_items
            WHERE job_id = $1
            ORDER BY created_at ASC
        `, [jobId]);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get batch job items', { error: error.message, jobId });
        throw error;
    }
}

/**
 * Update job item status
 * @param {string} itemId - Item ID
 * @param {string} status - New status
 * @param {Object} updates - Additional updates
 */
export async function updateJobItemStatus(itemId, status, updates = {}) {
    try {
        const setClauses = ['status = $2'];
        const params = [itemId, status];
        let paramIndex = 3;

        if (status === ITEM_STATUS.SUCCESS || status === ITEM_STATUS.ERROR) {
            setClauses.push(`processed_at = NOW()`);
        }

        if (updates.progress !== undefined) {
            setClauses.push(`progress = $${paramIndex}`);
            params.push(updates.progress);
            paramIndex++;
        }

        if (updates.error_message) {
            setClauses.push(`error_message = $${paramIndex}`);
            params.push(sanitizeDbString(updates.error_message));
            paramIndex++;
        }

        if (updates.resume_id) {
            setClauses.push(`resume_id = $${paramIndex}`);
            params.push(updates.resume_id);
            paramIndex++;
        }

        if (updates.adaptation_id) {
            setClauses.push(`adaptation_id = $${paramIndex}`);
            params.push(updates.adaptation_id);
            paramIndex++;
        }

        if (updates.original_name) {
            setClauses.push(`original_name = $${paramIndex}`);
            params.push(sanitizeDbString(updates.original_name));
            paramIndex++;
        }

        if (updates.display_name) {
            setClauses.push(`display_name = $${paramIndex}`);
            params.push(sanitizeDbString(updates.display_name));
            paramIndex++;
        }

        if (updates.result_data !== undefined) {
            setClauses.push(`pending_data = $${paramIndex}`);
            params.push(updates.result_data ? JSON.stringify(stripNullCharactersDeep(updates.result_data)) : null);
            paramIndex++;
        }

        // Store pending data for items waiting for name input
        if (updates.pending_analysis || updates.pending_text || updates.pending_improve !== undefined) {
            const pendingData = {
                analysis: updates.pending_analysis ? stripNullCharactersDeep(JSON.parse(updates.pending_analysis)) : null,
                text: sanitizeDbString(updates.pending_text) || null,
                improve: updates.pending_improve || false,
                ...(updates.credit_usage ? { creditUsage: stripNullCharactersDeep(updates.credit_usage) } : {})
            };
            setClauses.push(`pending_data = $${paramIndex}`);
            params.push(JSON.stringify(pendingData));
            paramIndex++;
        }

        await query(`
            UPDATE batch_job_items 
            SET ${setClauses.join(', ')}
            WHERE id = $1
        `, params);
    } catch (error) {
        safeLog('error', 'Failed to update batch job item status', { error: error.message, itemId });
        throw error;
    }
}

export async function mergeJobItemPendingData(itemId, patch = {}) {
    try {
        const result = await query(
            `SELECT pending_data
             FROM batch_job_items
             WHERE id = $1`,
            [itemId]
        );

        const currentValue = result.rows[0]?.pending_data;
        const currentData = typeof currentValue === 'string'
            ? JSON.parse(currentValue)
            : (currentValue || {});

        await query(
            `UPDATE batch_job_items
             SET pending_data = $2::jsonb
             WHERE id = $1`,
            [itemId, JSON.stringify({
                ...currentData,
                ...patch,
                creditUsage: {
                    ...(currentData.creditUsage || {}),
                    ...(patch.creditUsage || {})
                }
            })]
        );
    } catch (error) {
        safeLog('error', 'Failed to merge batch job item pending data', { error: error.message, itemId });
        throw error;
    }
}

/**
 * Get item by ID
 * @param {string} itemId - Item ID
 * @returns {Promise<Object|null>} Item or null
 */
export async function getJobItem(itemId) {
    try {
        const result = await query(`
            SELECT bji.*, bj.firm_id, bj.options
            FROM batch_job_items bji
            JOIN batch_jobs bj ON bji.job_id = bj.id
            WHERE bji.id = $1
        `, [itemId]);
        return result.rows[0] || null;
    } catch (error) {
        safeLog('error', 'Failed to get batch job item', { error: error.message, itemId });
        throw error;
    }
}

/**
 * Resume item processing after name is provided
 * @param {string} itemId - Item ID
 * @param {string} candidateName - Provided candidate name
 * @returns {Promise<Object>} Updated item
 */
export async function resumeItemWithName(itemId, candidateName) {
    try {
        // Get the item with pending data
        const item = await getJobItem(itemId);
        if (!item) {
            throw new Error('Item not found');
        }
        
        if (item.status !== ITEM_STATUS.PENDING_NAME) {
            throw new Error(`Item is not waiting for name input (status: ${item.status})`);
        }
        
        // Update item status to pending so worker picks it up
        await query(`
            UPDATE batch_job_items 
            SET status = $1, 
                original_name = $2,
                error_message = NULL
            WHERE id = $3
        `, [ITEM_STATUS.PENDING, candidateName, itemId]);
        
        safeLog('info', 'Item resumed with provided name', { itemId, candidateName });
        
        return { ...item, status: ITEM_STATUS.PENDING, original_name: candidateName };
    } catch (error) {
        safeLog('error', 'Failed to resume item with name', { error: error.message, itemId });
        throw error;
    }
}

/**
 * Get items pending name input for a job
 * @param {string} jobId - Job ID
 * @returns {Promise<Array>} Items pending name
 */
export async function getItemsPendingName(jobId) {
    try {
        const result = await query(`
            SELECT id, file_name, resume_id, progress, error_message, pending_data
            FROM batch_job_items 
            WHERE job_id = $1 AND status = $2
            ORDER BY created_at ASC
        `, [jobId, ITEM_STATUS.PENDING_NAME]);
        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get items pending name', { error: error.message, jobId });
        throw error;
    }
}

/**
 * Get pending items for a job (limited to batch size)
 * @param {string} jobId - Job ID
 * @returns {Promise<Array>} Pending items
 */
export async function getPendingItems(jobId) {
    try {
        const result = await query(`
            SELECT id, job_id, resume_id, adaptation_id, source_type, file_name, file_mime_type,
                   relative_path, status, progress, error_message, original_name, display_name,
                   pending_data, created_at, processed_at
            FROM batch_job_items
            WHERE job_id = $1 AND status = $2
            ORDER BY created_at ASC
            LIMIT $3
        `, [jobId, ITEM_STATUS.PENDING, BATCH_SIZE]);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get pending batch job items', { error: error.message, jobId });
        return [];
    }
}

/**
 * Atomically claim pending items for processing.
 * Prevents multiple workers from reading the same pending rows concurrently.
 * @param {string} jobId - Job ID
 * @returns {Promise<Array>} Claimed items
 */
export async function claimPendingItems(jobId) {
    try {
        const result = await query(`
            WITH claimed_items AS (
                SELECT id
                FROM batch_job_items
                WHERE job_id = $1 AND status = $2
                ORDER BY created_at ASC
                LIMIT $3
                FOR UPDATE SKIP LOCKED
            )
            UPDATE batch_job_items bji
            SET status = $4
            FROM claimed_items ci
            WHERE bji.id = ci.id
            RETURNING bji.id, bji.job_id, bji.resume_id, bji.adaptation_id, bji.source_type, bji.file_name, bji.file_mime_type,
                      bji.relative_path, bji.status, bji.progress, bji.error_message, bji.original_name, bji.display_name,
                      bji.pending_data, bji.created_at, bji.processed_at
        `, [jobId, ITEM_STATUS.PENDING, BATCH_SIZE, ITEM_STATUS.PROCESSING]);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to claim pending batch job items', { error: error.message, jobId });
        return [];
    }
}

/**
 * Get the file payload for a job item on demand.
 * This avoids preloading up to 100 blobs into the worker batch result set.
 * @param {string} itemId - Item ID
 * @returns {Promise<Object|null>} File payload
 */
export async function getJobItemFilePayload(itemId) {
    try {
        const result = await query(`
            SELECT file_data, file_mime_type
            FROM batch_job_items
            WHERE id = $1
        `, [itemId]);

        return result.rows[0] || null;
    } catch (error) {
        safeLog('error', 'Failed to get batch job item file payload', { error: error.message, itemId });
        throw error;
    }
}

/**
 * Clear stored file payload once the item no longer needs the batch copy.
 * @param {string} itemId - Item ID
 * @returns {Promise<void>}
 */
export async function clearJobItemFileData(itemId) {
    try {
        await query(`
            UPDATE batch_job_items
            SET file_data = NULL
            WHERE id = $1
        `, [itemId]);
    } catch (error) {
        safeLog('error', 'Failed to clear batch job item file payload', { error: error.message, itemId });
        throw error;
    }
}

/**
 * Clear stored file payload for processed items in bulk.
 * @returns {Promise<number>} Cleared row count
 */
export async function clearProcessedJobItemFileData() {
    try {
        const result = await query(`
            UPDATE batch_job_items 
            SET file_data = NULL 
            WHERE file_data IS NOT NULL 
            AND status IN ('success', 'error', 'skipped', 'pending_name')
        `);
        return result.rowCount || 0;
    } catch (error) {
        safeLog('error', 'Failed to clear processed batch job file payloads', { error: error.message });
        throw error;
    }
}
