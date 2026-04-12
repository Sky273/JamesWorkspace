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
    RATE_LIMIT: { AUTH: { windowMs: 900000, max: 20 }, USER: { windowMs: 900000, max: 50 } },
    MAX_LOGS: 1000
}));

// Mock firms service
const mockListFirms = vi.fn();
const mockGetFirmById = vi.fn();
const mockCreateFirm = vi.fn();
const mockUpdateFirm = vi.fn();
const mockDeleteFirm = vi.fn();
const mockGetAssociatedUsersCount = vi.fn();
const mockUploadFirmLogo = vi.fn();
const mockGetFirmLogo = vi.fn();
const mockDeleteFirmLogo = vi.fn();

vi.mock('../../services/firms.service.js', () => ({
    listFirms: (...args) => mockListFirms(...args),
    getFirmById: (...args) => mockGetFirmById(...args),
    createFirm: (...args) => mockCreateFirm(...args),
    updateFirm: (...args) => mockUpdateFirm(...args),
    deleteFirm: (...args) => mockDeleteFirm(...args),
    getAssociatedUsersCount: (...args) => mockGetAssociatedUsersCount(...args),
    uploadFirmLogo: (...args) => mockUploadFirmLogo(...args),
    getFirmLogo: (...args) => mockGetFirmLogo(...args),
    deleteFirmLogo: (...args) => mockDeleteFirmLogo(...args)
}));

// Mock cache service
vi.mock('../../services/cache.service.js', () => ({
    invalidateFirmsCaches: vi.fn(),
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
    createFirmSchema: {},
    updateFirmSchema: {},
    normalizeRequestBodyAliases: (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return value;
        }

        const normalized = { ...value };
        if (Object.prototype.hasOwnProperty.call(normalized, 'logo_url') && normalized.logoUrl === undefined) {
            normalized.logoUrl = normalized.logo_url;
        }
        return normalized;
    }
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
        if (req.user?.role === 'admin') {
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
            mockListFirms.mockResolvedValue({
                firms: [
                    { id: 'f-1', name: 'Firm A', status: 'active' },
                    { id: 'f-2', name: 'Firm B', status: 'active' }
                ],
                hasMore: false,
                totalCount: 2
            });

            const res = await request(app).get('/api/firms').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.pagination).toHaveProperty('page', 1);
            expect(res.body.pagination).toHaveProperty('totalCount', 2);
        });

        it('should support search parameter', async () => {
            mockListFirms.mockResolvedValue({
                firms: [{ id: 'f-1', name: 'Acme Corp' }],
                hasMore: false,
                totalCount: 1
            });

            const res = await request(app).get('/api/firms?search=acme').set(authHeader);

            expect(res.status).toBe(200);
            expect(mockListFirms).toHaveBeenCalledWith(
                expect.objectContaining({ search: 'acme' })
            );
        });

        it('should bypass cache when refresh=1 is provided', async () => {
            mockListFirms.mockResolvedValue({
                firms: [],
                hasMore: false,
                totalCount: 0
            });

            const res = await request(app).get('/api/firms?refresh=1').set(authHeader);

            expect(res.status).toBe(200);
            expect(mockListFirms).toHaveBeenCalledWith(
                expect.objectContaining({ bypassCache: true })
            );
        });

        it('should handle hasMore flag', async () => {
            const firms = Array.from({ length: 100 }, (_, i) => ({ id: `f-${i}`, name: `Firm ${i}` }));
            mockListFirms.mockResolvedValue({
                firms,
                hasMore: true,
                totalCount: 200
            });

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
            mockListFirms.mockRejectedValue(new Error('DB error'));

            const res = await request(app).get('/api/firms').set(authHeader);
            expect(res.status).toBe(500);
        });

        it('should return 403 for non-admin users', async () => {
            const res = await request(app)
                .get('/api/firms')
                .set({ ...authHeader, 'x-test-role': 'user' });

            expect(res.status).toBe(403);
        });

        it('should reject invalid pagination params', async () => {
            const res = await request(app)
                .get('/api/firms?page=-1&limit=0')
                .set(authHeader);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('positive integer');
            expect(mockListFirms).not.toHaveBeenCalled();
        });

        it('should clamp large limits before calling the service', async () => {
            mockListFirms.mockResolvedValue({
                firms: [],
                hasMore: false,
                totalCount: 0
            });

            const res = await request(app)
                .get('/api/firms?limit=1000')
                .set(authHeader);

            expect(res.status).toBe(200);
            expect(mockListFirms).toHaveBeenCalledWith(
                expect.objectContaining({ page: 1, limit: 200 })
            );
            expect(res.body.pagination.limit).toBe(200);
        });
    });

    describe('GET /api/firms/:id', () => {
        it('should return firm by ID', async () => {
            mockGetFirmById.mockResolvedValue({ id: 'f-1', name: 'Acme', status: 'active' });

            const res = await request(app).get('/api/firms/f-1').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Acme');
        });

        it('should bypass cache on detail read when refresh=1', async () => {
            mockGetFirmById.mockResolvedValue({ id: 'f-1', name: 'Acme', status: 'active' });

            const res = await request(app).get('/api/firms/f-1?refresh=1').set(authHeader);

            expect(res.status).toBe(200);
            expect(mockGetFirmById).toHaveBeenCalledWith('f-1', { bypassCache: true });
        });

        it('should return 404 if not found', async () => {
            const err = new Error('Firm not found');
            err.statusCode = 404;
            mockGetFirmById.mockRejectedValue(err);

            const res = await request(app).get('/api/firms/nonexistent').set(authHeader);
            expect(res.status).toBe(404);
        });

        it('should return 403 for non-admin users', async () => {
            const res = await request(app)
                .get('/api/firms/f-1')
                .set({ ...authHeader, 'x-test-role': 'user' });

            expect(res.status).toBe(403);
        });
    });

    describe('POST /api/firms', () => {
        it('should create a firm', async () => {
            mockCreateFirm.mockResolvedValue({ id: 'f-new', name: 'New Firm', status: 'active' });

            const res = await request(app)
                .post('/api/firms')
                .set(authHeader)
                .send({ name: 'New Firm' });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('New Firm');
        });

        it('should create a firm with legacy logo_url payload', async () => {
            mockCreateFirm.mockResolvedValue({ id: 'f-new', name: 'New Firm', status: 'active', logo_url: 'https://cdn.test/logo.png' });

            const res = await request(app)
                .post('/api/firms')
                .set(authHeader)
                .send({ name: 'New Firm', logo_url: 'https://cdn.test/logo.png' });

            expect(res.status).toBe(200);
            expect(mockCreateFirm).toHaveBeenCalledWith(expect.objectContaining({
                name: 'New Firm',
                logo_url: 'https://cdn.test/logo.png'
            }));
        });

        it('should return 400 on duplicate name', async () => {
            const err = new Error('duplicate');
            err.code = '23505';
            mockCreateFirm.mockRejectedValue(err);

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
            mockUpdateFirm.mockResolvedValue({ id: 'f-1', name: 'Updated', status: 'active' });

            const res = await request(app)
                .put('/api/firms/f-1')
                .set(authHeader)
                .send({ name: 'Updated' });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated');
        });

        it('should clear a firm logo with canonical payload normalization', async () => {
            mockUpdateFirm.mockResolvedValue({ id: 'f-1', name: 'Updated', status: 'active', logo_url: null });

            const res = await request(app)
                .put('/api/firms/f-1')
                .set(authHeader)
                .send({ name: 'Updated', logo_url: '' });

            expect(res.status).toBe(200);
            expect(mockUpdateFirm).toHaveBeenCalledWith('f-1', expect.objectContaining({
                name: 'Updated',
                logo_url: null
            }));
        });

        it('should return 404 if not found', async () => {
            const err = new Error('Firm not found');
            err.statusCode = 404;
            mockUpdateFirm.mockRejectedValue(err);

            const res = await request(app)
                .put('/api/firms/nonexistent')
                .set(authHeader)
                .send({ name: 'Test' });

            expect(res.status).toBe(404);
        });

        it('should return 400 on duplicate name', async () => {
            const err = new Error('duplicate');
            err.code = '23505';
            mockUpdateFirm.mockRejectedValue(err);

            const res = await request(app)
                .put('/api/firms/f-1')
                .set(authHeader)
                .send({ name: 'Existing' });

            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/firms/:id', () => {
        it('should delete a firm with no associated users', async () => {
            mockGetAssociatedUsersCount.mockResolvedValue(0);
            mockDeleteFirm.mockResolvedValue(true);

            const res = await request(app).delete('/api/firms/f-1').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('deleted');
        });

        it('should return 400 if firm has associated users', async () => {
            mockGetAssociatedUsersCount.mockResolvedValue(1);

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
            mockGetFirmLogo.mockResolvedValue({
                logo_data: logoBuffer, logo_mime_type: 'image/png'
            });

            const res = await request(app).get('/api/firms/f-1/logo/image');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('image/png');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['cache-control']).toBe('public, max-age=86400');
        });

        it('should force download for legacy svg logos', async () => {
            const logoBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
            mockGetFirmLogo.mockResolvedValue({
                logo_data: logoBuffer, logo_mime_type: 'image/svg+xml'
            });

            const res = await request(app).get('/api/firms/f-1/logo/image');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('image/svg+xml');
            expect(res.headers['content-disposition']).toContain('attachment');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
        });

        it('should return 404 if no logo', async () => {
            mockGetFirmLogo.mockResolvedValue(null);

            const res = await request(app).get('/api/firms/f-1/logo/image');
            expect(res.status).toBe(404);
        });

        it('should return 404 if firm not found', async () => {
            mockGetFirmLogo.mockResolvedValue(null);

            const res = await request(app).get('/api/firms/nonexistent/logo/image');
            expect(res.status).toBe(404);
        });
    });

    describe('POST /api/firms/:id/logo', () => {
        it('should reject invalid logo binary contents', async () => {
            mockGetFirmById.mockResolvedValue({ id: 'f-1', name: 'Acme' });

            const res = await request(app)
                .post('/api/firms/f-1/logo')
                .set(authHeader)
                .attach('logo', Buffer.from('not-an-image'), { filename: 'logo.png', contentType: 'image/png' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid logo file contents');
        });
    });
});
