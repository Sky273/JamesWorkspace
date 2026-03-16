/**
 * Tests for Firms routes
 * GET /, GET /:id, POST /, PUT /:id, DELETE /:id
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Mock constants
vi.mock('../../config/constants.js', () => ({
    JWT_SECRET: 'test-jwt-secret-for-vitest-minimum-32-chars-long',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret-for-vitest-min-32-chars',
    CSRF_SECRET: 'test-csrf-secret-for-vitest-minimum-32-chars',
    SALT_ROUNDS: 10,
    MAX_TEXT_LENGTH: 50000,
    MAX_PROMPT_LENGTH: 100000,
    MAX_STRING_FIELD_LENGTH: 1000,
    RATE_LIMIT: { AUTH: { windowMs: 900000, max: 20 }, USER: { windowMs: 900000, max: 50 } }
}));

// Mock postgresHelpers
const mockSelectWithTimeout = vi.fn();
const mockFindWithTimeout = vi.fn();
const mockCreateWithTimeout = vi.fn();
const mockUpdateWithTimeout = vi.fn();
const mockDestroyWithTimeout = vi.fn();
vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: (...args) => mockSelectWithTimeout(...args),
    findWithTimeout: (...args) => mockFindWithTimeout(...args),
    createWithTimeout: (...args) => mockCreateWithTimeout(...args),
    updateWithTimeout: (...args) => mockUpdateWithTimeout(...args),
    destroyWithTimeout: (...args) => mockDestroyWithTimeout(...args)
}));

// Mock database query
const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
    query: (...args) => mockQuery(...args)
}));

// Mock cache service
vi.mock('../../services/cache.service.js', () => ({
    firmsCache: {
        get: vi.fn(() => null),
        set: vi.fn(),
        invalidate: vi.fn()
    }
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: vi.fn(() => vi.fn())
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    createFirmSchema: {}
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'user-123',
                email: 'test@example.com',
                role: req.headers['x-test-role'] || 'admin',
                firm: 'Test Firm'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    },
    requireAdmin: (req, res, next) => {
        if (req.user?.role?.toLowerCase() === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Admin access required' });
        }
    }
}));

import firmsRoutes from '../../routes/firms.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/firms', firmsRoutes);
    return app;
}

describe('Firms Routes', () => {
    let app;
    const authHeader = { Authorization: 'Bearer valid-token' };

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    describe('GET /api/firms', () => {
        it('should return firms with pagination', async () => {
            mockSelectWithTimeout.mockResolvedValue([
                { id: 'f-1', name: 'Firm A', status: 'active' },
                { id: 'f-2', name: 'Firm B', status: 'active' }
            ]);
            mockQuery.mockResolvedValue({ rows: [{ count: '2' }] });

            const res = await request(app).get('/api/firms').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.pagination).toHaveProperty('page', 1);
            expect(res.body.pagination).toHaveProperty('totalCount', 2);
        });

        it('should support search parameter', async () => {
            mockSelectWithTimeout.mockResolvedValue([{ id: 'f-1', name: 'Acme Corp' }]);
            mockQuery.mockResolvedValue({ rows: [{ count: '1' }] });

            const res = await request(app).get('/api/firms?search=acme').set(authHeader);

            expect(res.status).toBe(200);
            expect(mockSelectWithTimeout).toHaveBeenCalledWith('firms', expect.objectContaining({
                where: expect.stringContaining('LOWER(name) LIKE')
            }));
        });

        it('should handle hasMore flag', async () => {
            // Return limit+1 items to indicate more exist (default limit=100, so 101 items)
            const firms = Array.from({ length: 101 }, (_, i) => ({ id: `f-${i}`, name: `Firm ${i}` }));
            mockSelectWithTimeout.mockResolvedValue(firms);
            mockQuery.mockResolvedValue({ rows: [{ count: '200' }] });

            const res = await request(app).get('/api/firms').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(100);
            expect(res.body.pagination.hasMore).toBe(true);
        });

        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/firms');
            expect(res.status).toBe(401);
        });

        it('should return 500 on DB error', async () => {
            mockSelectWithTimeout.mockRejectedValue(new Error('DB error'));

            const res = await request(app).get('/api/firms').set(authHeader);
            expect(res.status).toBe(500);
        });
    });

    describe('GET /api/firms/:id', () => {
        it('should return firm by ID', async () => {
            mockFindWithTimeout.mockResolvedValue({ id: 'f-1', name: 'Acme', status: 'active' });

            const res = await request(app).get('/api/firms/f-1').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Acme');
        });

        it('should return 404 if not found', async () => {
            const err = new Error('Record not found');
            err.statusCode = 404;
            mockFindWithTimeout.mockRejectedValue(err);

            const res = await request(app).get('/api/firms/nonexistent').set(authHeader);
            expect(res.status).toBe(404);
        });
    });

    describe('POST /api/firms', () => {
        it('should create a firm', async () => {
            mockCreateWithTimeout.mockResolvedValue([{ id: 'f-new', name: 'New Firm', status: 'active' }]);

            const res = await request(app)
                .post('/api/firms')
                .set(authHeader)
                .send({ name: 'New Firm' });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('New Firm');
        });

        it('should return 400 on duplicate name', async () => {
            const err = new Error('duplicate');
            err.code = '23505';
            mockCreateWithTimeout.mockRejectedValue(err);

            const res = await request(app)
                .post('/api/firms')
                .set(authHeader)
                .send({ name: 'Existing Firm' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('already exists');
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .post('/api/firms')
                .set({ ...authHeader, 'x-test-role': 'user' })
                .send({ name: 'Test' });

            expect(res.status).toBe(403);
        });
    });

    describe('PUT /api/firms/:id', () => {
        it('should update a firm', async () => {
            mockUpdateWithTimeout.mockResolvedValue([{ id: 'f-1', name: 'Updated', status: 'active' }]);

            const res = await request(app)
                .put('/api/firms/f-1')
                .set(authHeader)
                .send({ name: 'Updated' });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated');
        });

        it('should return 404 if not found', async () => {
            const err = new Error('Record not found');
            err.statusCode = 404;
            mockUpdateWithTimeout.mockRejectedValue(err);

            const res = await request(app)
                .put('/api/firms/nonexistent')
                .set(authHeader)
                .send({ name: 'Test' });

            expect(res.status).toBe(404);
        });

        it('should return 400 on duplicate name', async () => {
            const err = new Error('duplicate');
            err.code = '23505';
            mockUpdateWithTimeout.mockRejectedValue(err);

            const res = await request(app)
                .put('/api/firms/f-1')
                .set(authHeader)
                .send({ name: 'Existing' });

            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/firms/:id', () => {
        it('should delete a firm with no associated users', async () => {
            mockSelectWithTimeout.mockResolvedValue([]);
            mockDestroyWithTimeout.mockResolvedValue(['f-1']);

            const res = await request(app).delete('/api/firms/f-1').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('deleted');
        });

        it('should return 400 if firm has associated users', async () => {
            mockSelectWithTimeout.mockResolvedValue([{ id: 'u-1' }]);

            const res = await request(app).delete('/api/firms/f-1').set(authHeader);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('associated users');
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .delete('/api/firms/f-1')
                .set({ ...authHeader, 'x-test-role': 'user' });

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/firms/:id/logo/image', () => {
        it('should serve logo image', async () => {
            const logoBuffer = Buffer.from('fake-image-data');
            mockQuery.mockResolvedValue({
                rows: [{ logo_data: logoBuffer, logo_mime_type: 'image/png' }]
            });

            const res = await request(app).get('/api/firms/f-1/logo/image');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('image/png');
        });

        it('should return 404 if no logo', async () => {
            mockQuery.mockResolvedValue({ rows: [{ logo_data: null }] });

            const res = await request(app).get('/api/firms/f-1/logo/image');
            expect(res.status).toBe(404);
        });

        it('should return 404 if firm not found', async () => {
            mockQuery.mockResolvedValue({ rows: [] });

            const res = await request(app).get('/api/firms/nonexistent/logo/image');
            expect(res.status).toBe(404);
        });
    });
});
