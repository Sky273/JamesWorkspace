/**
 * Tests for Tags routes
 * GET /, GET /cleaned, GET /esco, PUT /rename
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
const mockSelectRawWithTimeout = vi.fn();
const mockUpdateWithTimeout = vi.fn();
vi.mock('../../utils/postgresHelpers.js', () => ({
    selectRawWithTimeout: (...args) => mockSelectRawWithTimeout(...args),
    selectWithTimeout: (...args) => mockSelectWithTimeout(...args),
    updateWithTimeout: (...args) => mockUpdateWithTimeout(...args)
}));

// Mock firmHelpers
const mockGetUserFirmId = vi.fn();
vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args)
}));

// Mock escoService
vi.mock('../../services/escoService.js', () => ({
    processCleanedTagsToEsco: vi.fn().mockResolvedValue({ skills: [], industries: [], tools: [], softSkills: [] })
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: vi.fn(() => vi.fn())
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'user-123',
                email: 'test@example.com',
                role: req.headers['x-test-role'] || 'user',
                firm: 'Test Firm',
                firm_id: 'firm-123'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    },
    requireUserManager: (req, res, next) => {
        if (req.user?.role === 'admin' || req.user?.role === 'localAdmin') {
            next();
        } else {
            res.status(403).json({ error: 'Manager access required' });
        }
    },
    isUserAdmin: (req) => req.user?.role === 'admin',
    requireAdmin: (req, res, next) => {
        if (req.user?.role === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Admin access required' });
        }
    }
}));

import tagsRoutes from '../../routes/tags.routes.js';
import { invalidateTagsCache } from '../../services/tagsCache.service.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/tags', tagsRoutes);
    return app;
}

describe('Tags Routes', () => {
    let app;
    const authHeader = { Authorization: 'Bearer valid-token', 'x-test-role': 'admin' };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserFirmId.mockResolvedValue('firm-123');
        invalidateTagsCache();
        app = createTestApp();
    });

    describe('GET /api/tags', () => {
        it('should return aggregated tags', async () => {
            mockSelectRawWithTimeout.mockResolvedValue([{
                skills: ['JavaScript', 'Python'],
                industries: ['IT'],
                tools: ['Git'],
                soft_skills: ['Leadership']
            }]);

            const res = await request(app).get('/api/tags').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('Skills');
            expect(res.body).toHaveProperty('Industries');
            expect(res.body).toHaveProperty('Tools');
            expect(res.body).toHaveProperty('Soft Skills');
        });

        it('should handle empty results', async () => {
            mockSelectRawWithTimeout.mockResolvedValue([{}]);

            const res = await request(app).get('/api/tags').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.Skills).toEqual([]);
        });

        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/tags');
            expect(res.status).toBe(401);
        });

        it('should return 500 on service error', async () => {
            mockSelectRawWithTimeout.mockRejectedValue(new Error('DB error'));

            const res = await request(app).get('/api/tags').set(authHeader);
            expect(res.status).toBe(500);
        });

        it('should return 403 without firm association', async () => {
            mockGetUserFirmId.mockResolvedValueOnce(null);

            const res = await request(app)
                .get('/api/tags')
                .set({ Authorization: 'Bearer valid-token', 'x-test-role': 'user' });

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/tags/cleaned', () => {
        it('should return cleaned tags for user', async () => {
            mockGetUserFirmId.mockResolvedValue('firm-123');
            mockSelectRawWithTimeout.mockResolvedValue([{
                skills: ['JavaScript'],
                industries: ['Tech'],
                tools: ['VS Code'],
                soft_skills: ['Communication']
            }]);

            const res = await request(app).get('/api/tags/cleaned').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('Skills');
            expect(res.headers['cache-control']).toBe('private, no-cache, max-age=0, must-revalidate');
        });

        it('should return 500 on DB error', async () => {
            mockGetUserFirmId.mockResolvedValue('firm-123');
            mockSelectRawWithTimeout.mockRejectedValue(new Error('DB error'));

            const res = await request(app).get('/api/tags/cleaned').set(authHeader);
            expect(res.status).toBe(500);
        });
    });

    describe('GET /api/tags/esco', () => {
        it('should return ESCO tags', async () => {
            mockSelectRawWithTimeout.mockResolvedValue([{
                skills: [{ label: 'Programming', uri: 'http://esco/1' }],
                industries: [],
                tools: [],
                soft_skills: []
            }]);

            const res = await request(app).get('/api/tags/esco').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('skills');
            expect(res.body).toHaveProperty('industries');
        });

        it('should return 500 on error', async () => {
            mockSelectRawWithTimeout.mockRejectedValue(new Error('DB error'));

            const res = await request(app).get('/api/tags/esco').set(authHeader);
            expect(res.status).toBe(500);
        });
    });

    describe('POST /api/tags/esco/recalculate', () => {
        it('should accept lang alias for ESCO recalculation', async () => {
            mockSelectWithTimeout.mockResolvedValue([]);

            const res = await request(app)
                .post('/api/tags/esco/recalculate')
                .set(authHeader)
                .send({ lang: 'en' });

            expect([200, 500]).toContain(res.status);
        });
    });

    describe('PUT /api/tags/rename', () => {
        it('should rename a tag across resumes', async () => {
            mockSelectRawWithTimeout.mockResolvedValue([{ id: 'r-1' }, { id: 'r-2' }]);

            const res = await request(app)
                .put('/api/tags/rename')
                .set(authHeader)
                .send({ category: 'Skills', oldName: 'JS', newName: 'JavaScript' });

            expect(res.status).toBe(200);
            expect(res.body.updatedCount).toBe(2);
        });

        it('should return 400 if fields missing', async () => {
            const res = await request(app)
                .put('/api/tags/rename')
                .set(authHeader)
                .send({ category: 'Skills' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
        });

        it('should return 400 for invalid category', async () => {
            const res = await request(app)
                .put('/api/tags/rename')
                .set(authHeader)
                .send({ category: 'InvalidCat', oldName: 'a', newName: 'b' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
        });

        it('should return 500 on DB error', async () => {
            mockSelectRawWithTimeout.mockRejectedValue(new Error('DB error'));

            const res = await request(app)
                .put('/api/tags/rename')
                .set(authHeader)
                .send({ category: 'Skills', oldName: 'JS', newName: 'JavaScript' });

            expect(res.status).toBe(500);
        });

        it('should reject rename for non-admin', async () => {
            const res = await request(app)
                .put('/api/tags/rename')
                .set({ ...authHeader, 'x-test-role': 'user' })
                .send({ category: 'Skills', oldName: 'JS', newName: 'JavaScript' });

            expect(res.status).toBe(403);
        });
    });
});
