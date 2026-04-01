/**
 * Resume Comments Service
 * Manages internal comments/notes on resumes
 */

import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import { assertSchemaRequirements } from './schemaVerification.service.js';

/**
 * Verify the resume comments schema is present
 */
export async function initResumeCommentsTable() {
    try {
        await assertSchemaRequirements({
            context: 'resume comments',
            tables: ['resume_comments'],
            indexes: [
                'idx_resume_comments_resume_id',
                'idx_resume_comments_user_id',
                'idx_resume_comments_created_at'
            ]
        });

        safeLog('info', 'Resume comments schema verified');
        return true;
    } catch (error) {
        safeLog('error', 'Failed to verify resume comments schema', {
            error: error.message
        });
        throw error;
    }
}

/**
 * Add a comment to a resume
 * @param {Object} params - Comment parameters
 * @param {string} params.resumeId - Resume UUID
 * @param {string} params.userId - User UUID
 * @param {string} params.userName - User display name
 * @param {string} params.content - Comment content
 * @param {boolean} [params.isPrivate=false] - Whether comment is private to the user
 * @returns {Promise<Object>} Created comment
 */
export async function addComment({ resumeId, userId, userName, content, isPrivate = false }) {
    if (!resumeId || !userId || !content?.trim()) {
        throw new Error('Resume ID, user ID, and content are required');
    }

    const result = await query(`
        INSERT INTO resume_comments (resume_id, user_id, user_name, content, is_private)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `, [resumeId, userId, userName, content.trim(), isPrivate]);

    safeLog('info', 'Comment added to resume', {
        resumeId,
        userId,
        commentId: result.rows[0].id
    });

    return result.rows[0];
}

/**
 * Get all comments for a resume
 * @param {string} resumeId - Resume UUID
 * @param {string} [currentUserId] - Current user ID (to filter private comments)
 * @returns {Promise<Array>} List of comments
 */
export async function getComments(resumeId, currentUserId = null) {
    if (!resumeId) {
        throw new Error('Resume ID is required');
    }

    // Get all non-private comments + private comments owned by current user
    const result = await query(`
        SELECT 
            id,
            resume_id,
            user_id,
            user_name,
            content,
            is_private,
            created_at,
            updated_at
        FROM resume_comments
        WHERE resume_id = $1
          AND (is_private = FALSE OR user_id = $2)
        ORDER BY created_at DESC
    `, [resumeId, currentUserId]);

    return result.rows;
}

/**
 * Get comment metadata for access checking
 * @param {string} commentId - Comment UUID
 * @returns {Promise<Object|null>} Comment metadata
 */
export async function getCommentForAccessCheck(commentId) {
    if (!commentId) {
        throw new Error('Comment ID is required');
    }

    const result = await query(`
        SELECT id, resume_id, user_id
        FROM resume_comments
        WHERE id = $1
    `, [commentId]);

    return result.rows[0] || null;
}

/**
 * Update a comment
 * @param {string} commentId - Comment UUID
 * @param {string} userId - User UUID (must be owner)
 * @param {string} content - New content
 * @returns {Promise<Object|null>} Updated comment or null if not found/not owner
 */
export async function updateComment(commentId, resumeId, userId, content) {
    if (!commentId || !userId || !content?.trim()) {
        throw new Error('Comment ID, user ID, and content are required');
    }

    const result = await query(`
        UPDATE resume_comments
        SET content = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND resume_id = $3 AND user_id = $4
        RETURNING *
    `, [content.trim(), commentId, resumeId, userId]);

    if (result.rows.length > 0) {
        safeLog('info', 'Comment updated', { commentId, userId });
        return result.rows[0];
    }

    return null;
}

/**
 * Delete a comment
 * @param {string} commentId - Comment UUID
 * @param {string} userId - User UUID (must be owner or admin)
 * @param {boolean} [isAdmin=false] - Whether user is admin (can delete any comment)
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteComment(commentId, resumeId, userId, isAdmin = false) {
    if (!commentId || !userId) {
        throw new Error('Comment ID and user ID are required');
    }

    let result;
    if (isAdmin) {
        // Admin can delete any comment
        result = await query(`
            DELETE FROM resume_comments
            WHERE id = $1 AND resume_id = $2
            RETURNING id
        `, [commentId, resumeId]);
    } else {
        // Regular user can only delete their own comments
        result = await query(`
            DELETE FROM resume_comments
            WHERE id = $1 AND resume_id = $2 AND user_id = $3
            RETURNING id
        `, [commentId, resumeId, userId]);
    }

    if (result.rows.length > 0) {
        safeLog('info', 'Comment deleted', { commentId, userId, isAdmin });
        return true;
    }

    return false;
}

/**
 * Get comment count for a resume
 * @param {string} resumeId - Resume UUID
 * @param {string} [currentUserId] - Current user ID (to include their private comments)
 * @returns {Promise<number>} Comment count
 */
export async function getCommentCount(resumeId, currentUserId = null) {
    const result = await query(`
        SELECT COUNT(*) as count
        FROM resume_comments
        WHERE resume_id = $1
          AND (is_private = FALSE OR user_id = $2)
    `, [resumeId, currentUserId]);

    return parseInt(result.rows[0].count, 10);
}

/**
 * Get recent comments across all resumes (for dashboard)
 * @param {string} userId - User ID
 * @param {number} [limit=10] - Max comments to return
 * @returns {Promise<Array>} Recent comments with resume info
 */
export async function getRecentComments(userId, limit = 10) {
    const result = await query(`
        SELECT 
            c.id,
            c.resume_id,
            c.user_id,
            c.user_name,
            c.content,
            c.is_private,
            c.created_at,
            r.candidate_name,
            r.firm_name
        FROM resume_comments c
        JOIN resumes r ON c.resume_id = r.id
        WHERE c.is_private = FALSE OR c.user_id = $1
        ORDER BY c.created_at DESC
        LIMIT $2
    `, [userId, limit]);

    return result.rows;
}

export default {
    initResumeCommentsTable,
    addComment,
    getComments,
    getCommentForAccessCheck,
    updateComment,
    deleteComment,
    getCommentCount,
    getRecentComments
};
