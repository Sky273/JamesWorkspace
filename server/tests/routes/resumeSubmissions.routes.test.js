/**
 * Tests for Resume Submissions routes
 * GET /, GET /:id, POST /, PUT /:id, DELETE /:id, GET /stats/summary
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock database
const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
    query: (...args) => mockQuery(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateParams: () => (req, res, next) => next(),
    validateBody: () => (req, res, next) => next()
}));

// Mock firmHelpers
const mockGetUserFirmId = vi.fn();
vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args)
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'user-123',
                email: 'user@test.com',
                role: req.headers['x-test-role'] || 'admin',
                firm_id: 'firm-123'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    },
    isUserAdmin: (req) => req.user?.role?.toLowerCase() === 'admin'
}));

import submissionRoutes from '../../routes/resumeSubmissions.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/submissions', submissionRoutes);
    return app;
}

const sampleSubmission = {
    id: 'sub-123',
    resume_id: 'res-1',
    client_id: 'cli-1',
    contact_id: 'con-1',
    mission_id: 'mis-1',
    firm_id: 'firm-123',
    sent_by: 'user-123',
    status: 'sent',
    notes: null,
    sent_at: '2026-01-15T10:00:00Z',
    resume_name: 'John Doe CV',
    client_name: 'Acme Corp',
    contact_name: 'Jane Smith',
    contact_email: 'jane@acme.com',
    mission_title: 'Senior Dev',
    sent_by_name: 'Test User',
    firm_name: 'Test Firm'
};

describe('Resume Submissions Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
        mockGetUserFirmId.mockResolvedValue('firm-123');
    });

    // ==========================================
    // GET /api/submissions
    // ==========================================
    describe('GET /', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/submissions');
            expect(res.status).toBe(401);
        });

        it('should return paginated submissions', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [sampleSubmission] }) // data query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // count query (page 1)

            const res = await request(app)
                .get('/api/submissions')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.pagination).toBeDefined();
            expect(res.body.pagination.page).toBe(1);
            expect(res.body.pagination.totalCount).toBe(1);
        });

        it('should filter by clientId', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] });

            const res = await request(app)
                .get('/api/submissions?clientId=cli-1')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            // Verify the client_id param was included
            const queryCall = mockQuery.mock.calls[0];
            expect(queryCall[1]).toContain('cli-1');
        });

        it('should filter by resumeId', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] });

            const res = await request(app)
                .get('/api/submissions?resumeId=res-1')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            const queryCall = mockQuery.mock.calls[0];
            expect(queryCall[1]).toContain('res-1');
        });

        it('should support pagination params', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .get('/api/submissions?page=3&limit=5')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.pagination.page).toBe(3);
            expect(res.body.pagination.limit).toBe(5);
        });

        it('should detect hasMore with limit+1 rows', async () => {
            const rows = Array.from({ length: 21 }, (_, i) => ({
                ...sampleSubmission, id: `sub-${i}`
            }));
            mockQuery
                .mockResolvedValueOnce({ rows })
                .mockResolvedValueOnce({ rows: [{ count: '50' }] });

            const res = await request(app)
                .get('/api/submissions?limit=20')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(20);
            expect(res.body.pagination.hasMore).toBe(true);
            expect(res.body.pagination.nextPage).toBe(2);
        });

        it('should return 500 on error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/submissions')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch submissions');
        });
    });

    // ==========================================
    // GET /api/submissions/:id
    // ==========================================
    describe('GET /:id', () => {
        it('should return submission by ID', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [sampleSubmission] });

            const res = await request(app)
                .get('/api/submissions/sub-123')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.id).toBe('sub-123');
        });

        it('should return 404 if not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .get('/api/submissions/sub-missing')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(404);
        });

        it('should return 403 for non-admin accessing another firm', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ ...sampleSubmission, firm_id: 'other-firm' }]
            });

            const res = await request(app)
                .get('/api/submissions/sub-other')
                .set('Authorization', 'Bearer valid-token')
                .set('x-test-role', 'user');

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied');
        });

        it('should allow admin to access any firm submission', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ ...sampleSubmission, firm_id: 'other-firm' }]
            });

            const res = await request(app)
                .get('/api/submissions/sub-other')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
        });
    });

    // ==========================================
    // POST /api/submissions
    // ==========================================
    describe('POST /', () => {
        const createBody = {
            resume_id: 'res-1',
            client_id: 'cli-1',
            contact_id: 'con-1',
            mission_id: 'mis-1'
        };

        it('should create submission with valid data', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] }) // resume check
                .mockResolvedValueOnce({ rows: [{ firm_id: 'firm-123' }] }) // client check
                .mockResolvedValueOnce({ rows: [{ id: 'con-1' }] }) // contact check
                .mockResolvedValueOnce({ rows: [{ id: 'mis-1' }] }) // mission check
                .mockResolvedValueOnce({ rows: [{ id: 'sub-new' }] }) // INSERT
                .mockResolvedValueOnce({ rows: [{ ...sampleSubmission, id: 'sub-new' }] }); // full fetch

            const res = await request(app)
                .post('/api/submissions')
                .set('Authorization', 'Bearer valid-token')
                .send(createBody);

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('sub-new');
        });

        it('should return 400 if resume_id missing', async () => {
            const res = await request(app)
                .post('/api/submissions')
                .set('Authorization', 'Bearer valid-token')
                .send({ client_id: 'cli-1', contact_id: 'con-1' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Resume ID is required');
        });

        it('should return 400 if client_id missing', async () => {
            const res = await request(app)
                .post('/api/submissions')
                .set('Authorization', 'Bearer valid-token')
                .send({ resume_id: 'res-1', contact_id: 'con-1' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Client ID is required');
        });

        it('should return 400 if contact_id missing', async () => {
            const res = await request(app)
                .post('/api/submissions')
                .set('Authorization', 'Bearer valid-token')
                .send({ resume_id: 'res-1', client_id: 'cli-1' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Contact ID is required');
        });

        it('should return 400 if resume not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] }); // resume not found

            const res = await request(app)
                .post('/api/submissions')
                .set('Authorization', 'Bearer valid-token')
                .send(createBody);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Resume not found');
        });

        it('should return 403 if client belongs to another firm', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] }) // resume exists
                .mockResolvedValueOnce({ rows: [{ firm_id: 'other-firm' }] }); // client wrong firm

            const res = await request(app)
                .post('/api/submissions')
                .set('Authorization', 'Bearer valid-token')
                .send(createBody);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Client does not belong to your firm');
        });

        it('should return 400 if contact does not belong to client', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] }) // resume
                .mockResolvedValueOnce({ rows: [{ firm_id: 'firm-123' }] }) // client
                .mockResolvedValueOnce({ rows: [] }); // contact not found for client

            const res = await request(app)
                .post('/api/submissions')
                .set('Authorization', 'Bearer valid-token')
                .send(createBody);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Contact not found');
        });

        it('should return 400 if user has no firm', async () => {
            mockGetUserFirmId.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/submissions')
                .set('Authorization', 'Bearer valid-token')
                .send(createBody);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('must belong to a firm');
        });
    });

    // ==========================================
    // PUT /api/submissions/:id
    // ==========================================
    describe('PUT /:id', () => {
        it('should update submission status', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [sampleSubmission] }) // existing check
                .mockResolvedValueOnce({ rows: [{ ...sampleSubmission, status: 'viewed' }] }); // update

            const res = await request(app)
                .put('/api/submissions/sub-123')
                .set('Authorization', 'Bearer valid-token')
                .send({ status: 'viewed' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('viewed');
        });

        it('should return 404 if not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .put('/api/submissions/sub-missing')
                .set('Authorization', 'Bearer valid-token')
                .send({ status: 'viewed' });

            expect(res.status).toBe(404);
        });

        it('should return 403 for non-admin on another firms submission', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ ...sampleSubmission, firm_id: 'other-firm' }]
            });

            const res = await request(app)
                .put('/api/submissions/sub-other')
                .set('Authorization', 'Bearer valid-token')
                .set('x-test-role', 'user')
                .send({ status: 'viewed' });

            expect(res.status).toBe(403);
        });
    });

    // ==========================================
    // DELETE /api/submissions/:id
    // ==========================================
    describe('DELETE /:id', () => {
        it('should delete submission', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [sampleSubmission] }) // existing check
                .mockResolvedValueOnce({ rows: [] }); // delete

            const res = await request(app)
                .delete('/api/submissions/sub-123')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Submission deleted successfully');
        });

        it('should return 404 if not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .delete('/api/submissions/sub-missing')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(404);
        });

        it('should return 403 for non-admin on another firms submission', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ ...sampleSubmission, firm_id: 'other-firm' }]
            });

            const res = await request(app)
                .delete('/api/submissions/sub-other')
                .set('Authorization', 'Bearer valid-token')
                .set('x-test-role', 'user');

            expect(res.status).toBe(403);
        });
    });

    // ==========================================
    // GET /api/submissions/stats/summary
    // ==========================================
    describe('GET /stats/summary', () => {
        it('should return submission statistics', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    total_submissions: '42',
                    sent: '20',
                    viewed: '10',
                    accepted: '5',
                    rejected: '3',
                    pending: '4',
                    unique_clients: '8',
                    unique_resumes: '15'
                }]
            });

            const res = await request(app)
                .get('/api/submissions/stats/summary')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.total_submissions).toBe('42');
            expect(res.body.unique_clients).toBe('8');
        });

        it('should return 500 on error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/submissions/stats/summary')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch submission stats');
        });
    });

    // ==========================================
    // Error message safety
    // ==========================================
    describe('Error message safety', () => {
        it('should not leak SQL errors in responses', async () => {
            mockQuery.mockRejectedValueOnce(new Error('column "bad" does not exist'));

            const res = await request(app)
                .get('/api/submissions')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch submissions');
            expect(JSON.stringify(res.body)).not.toContain('column');
        });
    });
});
