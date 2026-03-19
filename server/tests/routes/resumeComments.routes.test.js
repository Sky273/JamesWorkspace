/**
 * Tests for Resume Comments routes
 * GET /:resumeId/comments, POST /:resumeId/comments,
 * PUT /:resumeId/comments/:commentId, DELETE /:resumeId/comments/:commentId,
 * GET /:resumeId/comments/count
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock resumeComments service
const mockGetComments = vi.fn();
const mockAddComment = vi.fn();
const mockUpdateComment = vi.fn();
const mockDeleteComment = vi.fn();
const mockGetCommentCount = vi.fn();
vi.mock('../../services/resumeComments.service.js', () => ({
    default: {
        getComments: (...args) => mockGetComments(...args),
        addComment: (...args) => mockAddComment(...args),
        updateComment: (...args) => mockUpdateComment(...args),
        deleteComment: (...args) => mockDeleteComment(...args),
        getCommentCount: (...args) => mockGetCommentCount(...args)
    }
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'user-123',
                email: 'user@test.com',
                name: 'Test User',
                role: req.headers['x-test-role'] || 'user'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

import commentRoutes from '../../routes/resumeComments.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/resumes', commentRoutes);
    return app;
}

const sampleComment = {
    id: 'com-1',
    resume_id: 'res-1',
    user_id: 'user-123',
    user_name: 'Test User',
    content: 'Great CV!',
    is_private: false,
    created_at: '2026-01-15T10:00:00Z'
};

describe('Resume Comments Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    // ==========================================
    // GET /api/resumes/:resumeId/comments
    // ==========================================
    describe('GET /:resumeId/comments', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/resumes/res-1/comments');
            expect(res.status).toBe(401);
        });

        it('should return comments for a resume', async () => {
            mockGetComments.mockResolvedValueOnce([sampleComment]);

            const res = await request(app)
                .get('/api/resumes/res-1/comments')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.comments).toHaveLength(1);
            expect(res.body.count).toBe(1);
            expect(mockGetComments).toHaveBeenCalledWith('res-1', 'user-123');
        });

        it('should return empty list when no comments', async () => {
            mockGetComments.mockResolvedValueOnce([]);

            const res = await request(app)
                .get('/api/resumes/res-1/comments')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.comments).toHaveLength(0);
            expect(res.body.count).toBe(0);
        });

        it('should return 500 on error', async () => {
            mockGetComments.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/resumes/res-1/comments')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to get comments');
        });
    });

    // ==========================================
    // POST /api/resumes/:resumeId/comments
    // ==========================================
    describe('POST /:resumeId/comments', () => {
        it('should add a comment', async () => {
            mockAddComment.mockResolvedValueOnce(sampleComment);

            const res = await request(app)
                .post('/api/resumes/res-1/comments')
                .set('Authorization', 'Bearer valid-token')
                .send({ content: 'Great CV!', isPrivate: false });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.comment).toBeDefined();
            expect(mockAddComment).toHaveBeenCalledWith(expect.objectContaining({
                resumeId: 'res-1',
                userId: 'user-123',
                userName: 'Test User',
                content: 'Great CV!',
                isPrivate: false
            }));
        });

        it('should return 400 for empty content', async () => {
            const res = await request(app)
                .post('/api/resumes/res-1/comments')
                .set('Authorization', 'Bearer valid-token')
                .send({ content: '' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Comment content is required');
        });

        it('should return 400 for missing content', async () => {
            const res = await request(app)
                .post('/api/resumes/res-1/comments')
                .set('Authorization', 'Bearer valid-token')
                .send({});

            expect(res.status).toBe(400);
        });

        it('should return 400 for whitespace-only content', async () => {
            const res = await request(app)
                .post('/api/resumes/res-1/comments')
                .set('Authorization', 'Bearer valid-token')
                .send({ content: '   ' });

            expect(res.status).toBe(400);
        });

        it('should return 500 on service error', async () => {
            mockAddComment.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .post('/api/resumes/res-1/comments')
                .set('Authorization', 'Bearer valid-token')
                .send({ content: 'test' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to add comment');
        });
    });

    // ==========================================
    // PUT /api/resumes/:resumeId/comments/:commentId
    // ==========================================
    describe('PUT /:resumeId/comments/:commentId', () => {
        it('should update a comment', async () => {
            mockUpdateComment.mockResolvedValueOnce({ ...sampleComment, content: 'Updated!' });

            const res = await request(app)
                .put('/api/resumes/res-1/comments/com-1')
                .set('Authorization', 'Bearer valid-token')
                .send({ content: 'Updated!' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(mockUpdateComment).toHaveBeenCalledWith('com-1', 'user-123', 'Updated!');
        });

        it('should return 404 if comment not found or not owner', async () => {
            mockUpdateComment.mockResolvedValueOnce(null);

            const res = await request(app)
                .put('/api/resumes/res-1/comments/com-missing')
                .set('Authorization', 'Bearer valid-token')
                .send({ content: 'Updated!' });

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('not found');
        });

        it('should return 400 for empty content', async () => {
            const res = await request(app)
                .put('/api/resumes/res-1/comments/com-1')
                .set('Authorization', 'Bearer valid-token')
                .send({ content: '' });

            expect(res.status).toBe(400);
        });

        it('should return 500 on error', async () => {
            mockUpdateComment.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .put('/api/resumes/res-1/comments/com-1')
                .set('Authorization', 'Bearer valid-token')
                .send({ content: 'test' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to update comment');
        });
    });

    // ==========================================
    // DELETE /api/resumes/:resumeId/comments/:commentId
    // ==========================================
    describe('DELETE /:resumeId/comments/:commentId', () => {
        it('should delete own comment', async () => {
            mockDeleteComment.mockResolvedValueOnce(true);

            const res = await request(app)
                .delete('/api/resumes/res-1/comments/com-1')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Comment deleted');
            expect(mockDeleteComment).toHaveBeenCalledWith('com-1', 'user-123', false);
        });

        it('should allow admin to delete any comment', async () => {
            mockDeleteComment.mockResolvedValueOnce(true);

            const res = await request(app)
                .delete('/api/resumes/res-1/comments/com-1')
                .set('Authorization', 'Bearer valid-token')
                .set('x-test-role', 'admin');

            expect(res.status).toBe(200);
            expect(mockDeleteComment).toHaveBeenCalledWith('com-1', 'user-123', true);
        });

        it('should return 404 if comment not found or unauthorized', async () => {
            mockDeleteComment.mockResolvedValueOnce(false);

            const res = await request(app)
                .delete('/api/resumes/res-1/comments/com-missing')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(404);
        });

        it('should return 500 on error', async () => {
            mockDeleteComment.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .delete('/api/resumes/res-1/comments/com-1')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to delete comment');
        });
    });

    // ==========================================
    // GET /api/resumes/:resumeId/comments/count
    // ==========================================
    describe('GET /:resumeId/comments/count', () => {
        it('should return comment count', async () => {
            mockGetCommentCount.mockResolvedValueOnce(5);

            const res = await request(app)
                .get('/api/resumes/res-1/comments/count')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(5);
            expect(mockGetCommentCount).toHaveBeenCalledWith('res-1', 'user-123');
        });

        it('should return 500 on error', async () => {
            mockGetCommentCount.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/resumes/res-1/comments/count')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to get comment count');
        });
    });

    // ==========================================
    // Error message safety
    // ==========================================
    describe('Error message safety', () => {
        it('should not leak internal errors', async () => {
            mockGetComments.mockRejectedValueOnce(new Error('relation "resume_comments" does not exist'));

            const res = await request(app)
                .get('/api/resumes/res-1/comments')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to get comments');
            expect(JSON.stringify(res.body)).not.toContain('relation');
        });
    });
});
