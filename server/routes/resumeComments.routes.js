/**
 * Resume Comments Routes
 * API endpoints for managing comments on resumes
 */

import { Router, json } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, createCommentSchema, updateCommentSchema } from '../utils/validation.js';
import resumeCommentsService from '../services/resumeComments.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { getResumeForAccessCheck } from '../services/resumes.service.js';
import { getUserFirmId } from '../utils/firmHelpers.js';

const router = Router();

// Ensure JSON body parsing for this router
router.use(json());

async function assertResumeAccess(req, resumeId) {
    const resume = await getResumeForAccessCheck(resumeId);
    if (!resume) {
        return { status: 404, body: { success: false, error: 'Resume not found' } };
    }

    if (req.user?.role === 'admin') {
        return { resume };
    }

    const userFirmId = await getUserFirmId(req);
    if (!userFirmId || resume.firm_id !== userFirmId) {
        return { status: 403, body: { success: false, error: 'Forbidden' } };
    }

    return { resume };
}

/**
 * GET /api/resumes/:resumeId/comments
 * Get all comments for a resume
 */
router.get('/:resumeId/comments', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const { resumeId } = req.params;
        const userId = req.user?.id;
        const access = await assertResumeAccess(req, resumeId);
        if (access.status) {
            return res.status(access.status).json(access.body);
        }

        const comments = await resumeCommentsService.getComments(resumeId, userId);
        
        res.json({
            success: true,
            comments,
            count: comments.length
        });
    } catch (error) {
        safeLog('error', 'Failed to get comments', {
            resumeId: req.params.resumeId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get comments'
        });
    }
});

/**
 * POST /api/resumes/:resumeId/comments
 * Add a comment to a resume
 */
router.post('/:resumeId/comments', authenticateToken, validateParams('resumeId'), validateBody(createCommentSchema), async (req, res) => {
    try {
        const { resumeId } = req.params;
        const { content, isPrivate } = req.body;
        const userId = req.user?.id;
        const userName = req.user?.name || req.user?.email || 'Unknown';
        const access = await assertResumeAccess(req, resumeId);
        if (access.status) {
            return res.status(access.status).json(access.body);
        }

        if (!content?.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Comment content is required'
            });
        }

        const comment = await resumeCommentsService.addComment({
            resumeId,
            userId,
            userName,
            content,
            isPrivate: isPrivate || false
        });

        res.status(201).json({
            success: true,
            comment
        });
    } catch (error) {
        safeLog('error', 'Failed to add comment', {
            resumeId: req.params.resumeId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to add comment'
        });
    }
});

/**
 * PUT /api/resumes/:resumeId/comments/:commentId
 * Update a comment
 */
router.put('/:resumeId/comments/:commentId', authenticateToken, validateParams('resumeId', 'commentId'), validateBody(updateCommentSchema), async (req, res) => {
    try {
        const { resumeId, commentId } = req.params;
        const { content } = req.body;
        const userId = req.user?.id;
        const access = await assertResumeAccess(req, resumeId);
        if (access.status) {
            return res.status(access.status).json(access.body);
        }

        const comment = await resumeCommentsService.getCommentForAccessCheck(commentId);
        if (!comment || comment.resume_id !== resumeId) {
            return res.status(404).json({
                success: false,
                error: 'Comment not found'
            });
        }

        if (!content?.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Comment content is required'
            });
        }

        const updatedComment = await resumeCommentsService.updateComment(commentId, resumeId, userId, content);

        if (!updatedComment) {
            return res.status(404).json({
                success: false,
                error: 'Comment not found or you are not the owner'
            });
        }

        res.json({
            success: true,
            comment: updatedComment
        });
    } catch (error) {
        safeLog('error', 'Failed to update comment', {
            commentId: req.params.commentId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to update comment'
        });
    }
});

/**
 * DELETE /api/resumes/:resumeId/comments/:commentId
 * Delete a comment
 */
router.delete('/:resumeId/comments/:commentId', authenticateToken, validateParams('resumeId', 'commentId'), async (req, res) => {
    try {
        const { resumeId, commentId } = req.params;
        const userId = req.user?.id;
        const isAdmin = req.user?.role === 'admin';
        const access = await assertResumeAccess(req, resumeId);
        if (access.status) {
            return res.status(access.status).json(access.body);
        }

        const comment = await resumeCommentsService.getCommentForAccessCheck(commentId);
        if (!comment || comment.resume_id !== resumeId) {
            return res.status(404).json({
                success: false,
                error: 'Comment not found or you are not authorized to delete it'
            });
        }

        const deleted = await resumeCommentsService.deleteComment(commentId, resumeId, userId, isAdmin);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Comment not found or you are not authorized to delete it'
            });
        }

        res.json({
            success: true,
            message: 'Comment deleted'
        });
    } catch (error) {
        safeLog('error', 'Failed to delete comment', {
            commentId: req.params.commentId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to delete comment'
        });
    }
});

/**
 * GET /api/resumes/:resumeId/comments/count
 * Get comment count for a resume
 */
router.get('/:resumeId/comments/count', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const { resumeId } = req.params;
        const userId = req.user?.id;
        const access = await assertResumeAccess(req, resumeId);
        if (access.status) {
            return res.status(access.status).json(access.body);
        }

        const count = await resumeCommentsService.getCommentCount(resumeId, userId);

        res.json({
            success: true,
            count
        });
    } catch (error) {
        safeLog('error', 'Failed to get comment count', {
            resumeId: req.params.resumeId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get comment count'
        });
    }
});

export default router;
