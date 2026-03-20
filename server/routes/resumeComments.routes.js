/**
 * Resume Comments Routes
 * API endpoints for managing comments on resumes
 */

import { Router, json } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, createCommentSchema, updateCommentSchema } from '../utils/validation.js';
import resumeCommentsService from '../services/resumeComments.service.js';
import { safeLog } from '../utils/logger.backend.js';

const router = Router();

// Ensure JSON body parsing for this router
router.use(json());

/**
 * GET /api/resumes/:resumeId/comments
 * Get all comments for a resume
 */
router.get('/:resumeId/comments', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const { resumeId } = req.params;
        const userId = req.user?.id;

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
        const { commentId } = req.params;
        const { content } = req.body;
        const userId = req.user?.id;

        if (!content?.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Comment content is required'
            });
        }

        const comment = await resumeCommentsService.updateComment(commentId, userId, content);

        if (!comment) {
            return res.status(404).json({
                success: false,
                error: 'Comment not found or you are not the owner'
            });
        }

        res.json({
            success: true,
            comment
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
        const { commentId } = req.params;
        const userId = req.user?.id;
        const isAdmin = req.user?.role === 'admin';

        const deleted = await resumeCommentsService.deleteComment(commentId, userId, isAdmin);

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
