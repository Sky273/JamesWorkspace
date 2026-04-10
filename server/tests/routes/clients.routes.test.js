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

// Mock clients service
const mockListClients = vi.fn();
const mockListIndustries = vi.fn();
const mockGetClientById = vi.fn();
const mockValidateFirm = vi.fn();
const mockCreateClient = vi.fn();
const mockFindClient = vi.fn();
const mockUpdateClient = vi.fn();
const mockCountClientSubmissions = vi.fn();
const mockDeleteClient = vi.fn();
const mockGetClientFirmId = vi.fn();
const mockListContacts = vi.fn();
const mockCreateContact = vi.fn();
const mockUpdateContact = vi.fn();
const mockCountContactSubmissions = vi.fn();
const mockDeleteContact = vi.fn();
vi.mock('../../services/clients.service.js', () => ({
    listClients: (...args) => mockListClients(...args),
    listIndustries: (...args) => mockListIndustries(...args),
    getClientById: (...args) => mockGetClientById(...args),
    validateFirm: (...args) => mockValidateFirm(...args),
    createClient: (...args) => mockCreateClient(...args),
    findClient: (...args) => mockFindClient(...args),
    updateClient: (...args) => mockUpdateClient(...args),
    countClientSubmissions: (...args) => mockCountClientSubmissions(...args),
    deleteClient: (...args) => mockDeleteClient(...args),
    getClientFirmId: (...args) => mockGetClientFirmId(...args),
    listContacts: (...args) => mockListContacts(...args),
    createContact: (...args) => mockCreateContact(...args),
    updateContact: (...args) => mockUpdateContact(...args),
    countContactSubmissions: (...args) => mockCountContactSubmissions(...args),
    deleteContact: (...args) => mockDeleteContact(...args)
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
    updateContactSchema: {},
    normalizeRequestBodyAliases: (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return value;
        }

        const normalized = { ...value };
        if (Object.prototype.hasOwnProperty.call(normalized, 'firm_id') && normalized.firmId === undefined) {
            normalized.firmId = normalized.firm_id;
        }
        if (Object.prototype.hasOwnProperty.call(normalized, 'is_primary') && normalized.isPrimary === undefined) {
            normalized.isPrimary = normalized.is_primary;
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
        mockGetUserFirmId.mockResolvedValue('firm-123');
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/clients');

        expect(res.status).toBe(401);
    });

    it('should return paginated clients for authenticated user', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockListClients.mockResolvedValueOnce({
            data: [
                { id: 'client-1', name: 'Client A', type: 'client', firm_id: 'firm-123' },
                { id: 'client-2', name: 'Client B', type: 'prospect', firm_id: 'firm-123' }
            ],
            pagination: { page: 1, limit: 20, hasMore: false, totalCount: 2, nextPage: null }
        });

        const res = await request(app)
            .get('/api/clients')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.length).toBe(2);
        expect(mockListClients).toHaveBeenCalledWith(expect.objectContaining({ firmId: 'firm-123' }));
    });

    it('should filter by search term', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockListClients.mockResolvedValueOnce({
            data: [{ id: 'client-1', name: 'Acme Corp' }],
            pagination: { page: 1, limit: 20, hasMore: false, totalCount: 1, nextPage: null }
        });

        const res = await request(app)
            .get('/api/clients?search=acme')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(mockListClients).toHaveBeenCalledWith(expect.objectContaining({ search: 'acme' }));
    });

    it('should filter by type', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockListClients.mockResolvedValueOnce({
            data: [{ id: 'client-1', name: 'Client A', type: 'client' }],
            pagination: { page: 1, limit: 20, hasMore: false, totalCount: 1, nextPage: null }
        });

        const res = await request(app)
            .get('/api/clients?type=client')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(mockListClients).toHaveBeenCalledWith(expect.objectContaining({ type: 'client' }));
    });

    it('should support pagination', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockListClients.mockResolvedValueOnce({
            data: [],
            pagination: { page: 2, limit: 10, hasMore: false, totalCount: null, nextPage: null }
        });

        const res = await request(app)
            .get('/api/clients?page=2&limit=10')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(mockListClients).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 10 }));
    });

    it('should pass null firmId for admin users', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockListClients.mockResolvedValueOnce({
            data: [],
            pagination: { page: 1, limit: 20, hasMore: false, totalCount: 0, nextPage: null }
        });

        const res = await request(app)
            .get('/api/clients')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
        expect(mockListClients).toHaveBeenCalledWith(expect.objectContaining({ firmId: null }));
    });

    it('should reject invalid pagination', async () => {
        const res = await request(app)
            .get('/api/clients?page=0&limit=-1')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid pagination parameters');
        expect(mockListClients).not.toHaveBeenCalled();
    });

    it('should reject non-admin list access without firm association', async () => {
        mockGetUserFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/clients')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
        expect(mockListClients).not.toHaveBeenCalled();
    });
});

describe('Clients Routes - GET /api/clients/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserFirmId.mockResolvedValue('firm-123');
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/clients/client-123');

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent client', async () => {
        mockGetClientById.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should return client for authorized user', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockGetClientById.mockResolvedValueOnce({
            id: 'client-123', name: 'Acme Corp', type: 'client', firm_id: 'firm-123',
            contacts: [{ id: 'contact-1', name: 'John' }],
            recentSubmissions: []
        });

        const res = await request(app)
            .get('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('client-123');
        expect(res.body.contacts).toBeDefined();
    });

    it('should return 403 for client from different firm', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockGetClientById.mockResolvedValueOnce({
            id: 'client-123', name: 'Other Corp', firm_id: 'firm-other',
            contacts: [], recentSubmissions: []
        });

        const res = await request(app)
            .get('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should reject non-admin detail access without firm association', async () => {
        mockGetUserFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
        expect(mockGetClientById).not.toHaveBeenCalled();
    });
});

describe('Clients Routes - POST /api/clients', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserFirmId.mockResolvedValue('firm-123');
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
        mockCreateClient.mockResolvedValueOnce({
            id: 'new-client-123',
            name: 'New Client Corp',
            type: 'prospect',
            firm_id: 'firm-123'
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
        expect(mockCreateClient).toHaveBeenCalledWith(expect.objectContaining({
            firmId: 'firm-123',
            name: 'New Client Corp'
        }));
    });

    it('should reject client without name', async () => {
        const res = await request(app)
            .post('/api/clients')
            .set('Authorization', 'Bearer valid-token')
            .send({ type: 'client' });

        expect(res.status).toBe(400);
    });

    it('should allow admin to create for another firm with camelCase firmId', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockValidateFirm.mockResolvedValueOnce({ id: 'firm-other', name: 'Other Firm' });
        mockCreateClient.mockResolvedValueOnce({
            id: 'new-client-camel',
            name: 'Camel Client',
            firm_id: 'firm-other'
        });

        const res = await request(app)
            .post('/api/clients')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin')
            .send({ name: 'Camel Client', firmId: 'firm-other' });

        expect(res.status).toBe(201);
        expect(mockCreateClient).toHaveBeenCalledWith(expect.objectContaining({ firmId: 'firm-other' }));
    });

    it('should allow admin to create for another firm', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockValidateFirm.mockResolvedValueOnce({ id: 'firm-other', name: 'Other Firm' });
        mockCreateClient.mockResolvedValueOnce({
            id: 'new-client-456',
            name: 'Other Client',
            firm_id: 'firm-other'
        });

        const res = await request(app)
            .post('/api/clients')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin')
            .send({ name: 'Other Client', firm_id: 'firm-other' });

        expect(res.status).toBe(201);
        expect(mockCreateClient).toHaveBeenCalledWith(expect.objectContaining({ firmId: 'firm-other' }));
    });
});

describe('Clients Routes - PUT /api/clients/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserFirmId.mockResolvedValue('firm-123');
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .put('/api/clients/client-123')
            .send({ name: 'Updated Name' });

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent client', async () => {
        mockFindClient.mockResolvedValueOnce(null);

        const res = await request(app)
            .put('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ name: 'Updated Name' });

        expect(res.status).toBe(404);
    });

    it('should update client for authorized user', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockFindClient.mockResolvedValueOnce({ id: 'client-123', firm_id: 'firm-123' });
        mockUpdateClient.mockResolvedValueOnce({ id: 'client-123', name: 'Updated Name', firm_id: 'firm-123' });

        const res = await request(app)
            .put('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ name: 'Updated Name' });

        expect(res.status).toBe(200);
        expect(mockUpdateClient).toHaveBeenCalled();
    });

    it('should return 403 for client from different firm', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockFindClient.mockResolvedValueOnce({ id: 'client-123', firm_id: 'firm-other' });

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
        mockGetUserFirmId.mockResolvedValue('firm-123');
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .delete('/api/clients/client-123');

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent client', async () => {
        mockFindClient.mockResolvedValueOnce(null);

        const res = await request(app)
            .delete('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should delete client for authorized user', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockFindClient.mockResolvedValueOnce({ id: 'client-123', firm_id: 'firm-123' });
        mockCountClientSubmissions.mockResolvedValueOnce(0);
        mockDeleteClient.mockResolvedValueOnce(undefined);

        const res = await request(app)
            .delete('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(mockDeleteClient).toHaveBeenCalledWith('client-123');
    });

    it('should return 403 for client from different firm', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockFindClient.mockResolvedValueOnce({ id: 'client-123', firm_id: 'firm-other' });

        const res = await request(app)
            .delete('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should prevent deletion of client with submissions', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockFindClient.mockResolvedValueOnce({ id: 'client-123', firm_id: 'firm-123' });
        mockCountClientSubmissions.mockResolvedValueOnce(5);

        const res = await request(app)
            .delete('/api/clients/client-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(400);
        expect(res.body.submissionsCount).toBe(5);
    });
});

describe('Clients Routes - Contacts', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserFirmId.mockResolvedValue('firm-123');
        app = createTestApp();
    });

    describe('GET /api/clients/:id/contacts', () => {
        it('should return contacts for client', async () => {
            mockGetUserFirmId.mockResolvedValueOnce('firm-123');
            mockGetClientFirmId.mockResolvedValueOnce({ firm_id: 'firm-123' });
            mockListContacts.mockResolvedValueOnce([
                { id: 'contact-1', name: 'John Doe', email: 'john@acme.com' },
                { id: 'contact-2', name: 'Jane Smith', email: 'jane@acme.com' }
            ]);

            const res = await request(app)
                .get('/api/clients/client-123/contacts')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.length).toBe(2);
        });

        it('should return 404 for non-existent client', async () => {
            mockGetClientFirmId.mockResolvedValueOnce(null);

            const res = await request(app)
                .get('/api/clients/client-123/contacts')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(404);
        });
    });

    describe('POST /api/clients/:id/contacts', () => {
        it('should create contact for client', async () => {
            mockGetUserFirmId.mockResolvedValueOnce('firm-123');
            mockGetClientFirmId.mockResolvedValueOnce({ firm_id: 'firm-123' });
            mockCreateContact.mockResolvedValueOnce({
                id: 'new-contact-123',
                name: 'New Contact',
                email: 'new@acme.com',
                client_id: 'client-123'
            });

            const res = await request(app)
                .post('/api/clients/client-123/contacts')
                .set('Authorization', 'Bearer valid-token')
                .send({ name: 'New Contact', email: 'new@acme.com' });

            expect(res.status).toBe(201);
        });

        it('should ignore deprecated jobTitle fields when creating contact', async () => {
            mockGetUserFirmId.mockResolvedValueOnce('firm-123');
            mockGetClientFirmId.mockResolvedValueOnce({ firm_id: 'firm-123' });
            mockCreateContact.mockResolvedValueOnce({
                id: 'new-contact-123',
                name: 'New Contact',
                client_id: 'client-123'
            });

            const res = await request(app)
                .post('/api/clients/client-123/contacts')
                .set('Authorization', 'Bearer valid-token')
                .send({ name: 'New Contact', jobTitle: 'Director', job_title: 'Director' });

            expect(res.status).toBe(201);
            expect(mockCreateContact).toHaveBeenCalledWith('client-123', {
                name: 'New Contact',
                role: undefined,
                email: undefined,
                phone: undefined,
                is_primary: undefined
            });
        });

        it('should reject contact without name', async () => {
            mockGetUserFirmId.mockResolvedValueOnce('firm-123');
            mockGetClientFirmId.mockResolvedValueOnce({ firm_id: 'firm-123' });

            const res = await request(app)
                .post('/api/clients/client-123/contacts')
                .set('Authorization', 'Bearer valid-token')
                .send({ email: 'test@acme.com' });

            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/clients/:id/contacts/:contactId', () => {
        it('should delete contact without submissions', async () => {
            mockGetUserFirmId.mockResolvedValueOnce('firm-123');
            mockGetClientFirmId.mockResolvedValueOnce({ firm_id: 'firm-123' });
            mockCountContactSubmissions.mockResolvedValueOnce(0);
            mockDeleteContact.mockResolvedValueOnce(true);

            const res = await request(app)
                .delete('/api/clients/client-123/contacts/contact-1')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
        });

        it('should prevent deletion of contact with submissions', async () => {
            mockGetUserFirmId.mockResolvedValueOnce('firm-123');
            mockGetClientFirmId.mockResolvedValueOnce({ firm_id: 'firm-123' });
            mockCountContactSubmissions.mockResolvedValueOnce(3);

            const res = await request(app)
                .delete('/api/clients/client-123/contacts/contact-1')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(400);
            expect(res.body.submissionsCount).toBe(3);
        });
    });
});

describe('Clients Routes - Input Validation', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserFirmId.mockResolvedValue('firm-123');
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

    it('should reject contact access without firm association for non-admin', async () => {
        mockGetUserFirmId.mockResolvedValueOnce(null);
        mockGetClientFirmId.mockResolvedValueOnce({ firm_id: 'firm-123' });

        const res = await request(app)
            .get('/api/clients/client-123/contacts')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
        expect(mockListContacts).not.toHaveBeenCalled();
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
