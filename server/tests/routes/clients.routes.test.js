/**
 * Comprehensive tests for Clients routes
 * GET /, GET /:id, POST /, PUT /:id, DELETE /:id
 * Contacts: GET /:id/contacts, POST /:id/contacts, PUT /contacts/:contactId, DELETE /contacts/:contactId
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Mock constants module FIRST
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

// Mock database
const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
    query: (...args) => mockQuery(...args)
}));

// Mock postgresHelpers
vi.mock('../../utils/postgresHelpers.js', () => ({
    escapeLike: (str) => str.replace(/[%_\\]/g, '\\$&')
}));

// Mock firmHelpers
const mockGetUserFirmId = vi.fn();
vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: vi.fn(() => vi.fn())
}));

// Mock rate limiter (userRateLimit is a factory function)
vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    userRateLimit: () => (req, res, next) => next()
}));

// Mock validation middleware
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    createClientSchema: {},
    updateClientSchema: {},
    createContactSchema: {},
    updateContactSchema: {}
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
    isUserAdmin: (req) => req.user?.role === 'admin'
}));

// Import routes after mocks
import clientsRoutes from '../../routes/clients.routes.js';

// Create test app
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/clients', clientsRoutes);
    return app;
}

describe('Clients Routes - GET /api/clients', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/clients');

        expect(res.status).toBe(401);
    });

    it('should return paginated clients for authenticated user', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockQuery
            .mockResolvedValueOnce({ 
                rows: [
                    { id: 'client-1', name: 'Client A', type: 'client', firm_id: 'firm-123' },
                    { id: 'client-2', name: 'Client B', type: 'prospect', firm_id: 'firm-123' }
                ] 
            })
            .mockResolvedValueOnce({ rows: [{ count: '2' }] }); // count query

        const res = await request(app)
            .get('/api/clients')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
    });

    it('should filter by search term', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockQuery
            .mockResolvedValueOnce({ rows: [{ id: 'client-1', name: 'Acme Corp' }] })
            .mockResolvedValueOnce({ rows: [{ count: '1' }] });

        const res = await request(app)
            .get('/api/clients?search=acme')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should filter by type', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockQuery
            .mockResolvedValueOnce({ rows: [{ id: 'client-1', name: 'Client A', type: 'client' }] })
            .mockResolvedValueOnce({ rows: [{ count: '1' }] });

        const res = await request(app)
            .get('/api/clients?type=client')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should support pagination', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .get('/api/clients?page=2&limit=10')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });
});

describe('Clients Routes - GET /api/clients/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/clients/client-123');

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent client', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .get('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should return client for authorized user', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockQuery
            .mockResolvedValueOnce({ rows: [{ id: 'client-123', name: 'Acme Corp', type: 'client', firm_id: 'firm-123' }] }) // client query
            .mockResolvedValueOnce({ rows: [{ id: 'contact-1', name: 'John' }] }) // contacts query
            .mockResolvedValueOnce({ rows: [] }); // submissions query

        const res = await request(app)
            .get('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('client-123');
    });

    it('should return 403 for client from different firm', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockQuery.mockResolvedValueOnce({ 
            rows: [{ 
                id: 'client-123', 
                name: 'Other Corp',
                firm_id: 'firm-other'
            }] 
        });

        const res = await request(app)
            .get('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });
});

describe('Clients Routes - POST /api/clients', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .post('/api/clients')
            .send({ name: 'New Client' });

        expect(res.status).toBe(401);
    });

    it('should create client with valid data', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockQuery.mockResolvedValueOnce({ 
            rows: [{ 
                id: 'new-client-123',
                name: 'New Client Corp',
                type: 'prospect',
                firm_id: 'firm-123'
            }] 
        });

        const res = await request(app)
            .post('/api/clients')
            .set('Authorization', 'Bearer valid-token')
            .send({ 
                name: 'New Client Corp',
                type: 'prospect',
                industry: 'Technology'
            });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe('new-client-123');
    });

    it('should reject client without name', async () => {
        const res = await request(app)
            .post('/api/clients')
            .set('Authorization', 'Bearer valid-token')
            .send({ type: 'client' });

        expect(res.status).toBe(400);
    });
});

describe('Clients Routes - PUT /api/clients/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .put('/api/clients/client-123')
            .send({ name: 'Updated Name' });

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent client', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .put('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ name: 'Updated Name' });

        expect(res.status).toBe(404);
    });

    it('should update client for authorized user', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockQuery
            .mockResolvedValueOnce({ rows: [{ id: 'client-123', firm_id: 'firm-123' }] }) // check exists
            .mockResolvedValueOnce({ rows: [{ id: 'client-123', name: 'Updated Name', firm_id: 'firm-123' }] }); // update

        const res = await request(app)
            .put('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ name: 'Updated Name' });

        expect(res.status).toBe(200);
    });

    it('should return 403 for client from different firm', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'client-123', firm_id: 'firm-other' }] });

        const res = await request(app)
            .put('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ name: 'Updated Name' });

        expect(res.status).toBe(403);
    });
});

describe('Clients Routes - DELETE /api/clients/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .delete('/api/clients/client-123');

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent client', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .delete('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should delete client for authorized user', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockQuery
            .mockResolvedValueOnce({ rows: [{ id: 'client-123', firm_id: 'firm-123' }] }) // check exists
            .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // check submissions count
            .mockResolvedValueOnce({ rows: [] }); // delete

        const res = await request(app)
            .delete('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should return 403 for client from different firm', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'client-123', firm_id: 'firm-other' }] });

        const res = await request(app)
            .delete('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });
});

describe('Clients Routes - Contacts', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    describe('GET /api/clients/:id/contacts', () => {
        it('should return contacts for client', async () => {
            mockGetUserFirmId.mockResolvedValueOnce('firm-123');
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'client-123', firm_id: 'firm-123' }] }) // check client
                .mockResolvedValueOnce({ 
                    rows: [
                        { id: 'contact-1', name: 'John Doe', email: 'john@acme.com' },
                        { id: 'contact-2', name: 'Jane Smith', email: 'jane@acme.com' }
                    ] 
                });

            const res = await request(app)
                .get('/api/clients/client-123/contacts')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.length).toBe(2);
        });
    });

    describe('POST /api/clients/:id/contacts', () => {
        it('should create contact for client', async () => {
            mockGetUserFirmId.mockResolvedValueOnce('firm-123');
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'client-123', firm_id: 'firm-123' }] }) // check client
                .mockResolvedValueOnce({ 
                    rows: [{ 
                        id: 'new-contact-123',
                        name: 'New Contact',
                        email: 'new@acme.com',
                        client_id: 'client-123'
                    }] 
                });

            const res = await request(app)
                .post('/api/clients/client-123/contacts')
                .set('Authorization', 'Bearer valid-token')
                .send({ name: 'New Contact', email: 'new@acme.com' });

            expect(res.status).toBe(201);
        });

        it('should reject contact without name', async () => {
            mockGetUserFirmId.mockResolvedValueOnce('firm-123');
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'client-123', firm_id: 'firm-123' }] });

            const res = await request(app)
                .post('/api/clients/client-123/contacts')
                .set('Authorization', 'Bearer valid-token')
                .send({ email: 'test@acme.com' });

            expect(res.status).toBe(400);
        });
    });
});

describe('Clients Routes - Input Validation', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should reject client creation without firm association', async () => {
        mockGetUserFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .post('/api/clients')
            .set('Authorization', 'Bearer valid-token')
            .send({ name: 'Test', type: 'client' });

        expect(res.status).toBe(400);
    });

    it('should reject empty name', async () => {
        const res = await request(app)
            .post('/api/clients')
            .set('Authorization', 'Bearer valid-token')
            .send({ name: '', type: 'client' });

        expect(res.status).toBe(400);
    });

    it('should reject name too long', async () => {
        const res = await request(app)
            .post('/api/clients')
            .set('Authorization', 'Bearer valid-token')
            .send({ name: 'a'.repeat(256), type: 'client' });

        expect(res.status).toBe(400);
    });
});
