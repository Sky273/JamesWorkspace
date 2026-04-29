/**
 * Comprehensive tests for Templates CRUD routes
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

// Mock templates service
const mockListTemplates = vi.fn();
const mockGetTemplateById = vi.fn();
const mockGetTemplateByIdWithAccess = vi.fn();
const mockGetFirmIfExists = vi.fn();
const mockCreateTemplate = vi.fn();
const mockUpdateTemplate = vi.fn();
const mockDeleteTemplate = vi.fn();
const mockDuplicateTemplate = vi.fn();
vi.mock('../../services/templates.service.js', () => ({
    listTemplates: (...args) => mockListTemplates(...args),
    getTemplateById: (...args) => mockGetTemplateById(...args),
    getTemplateByIdWithAccess: (...args) => mockGetTemplateByIdWithAccess(...args),
    getFirmIfExists: (...args) => mockGetFirmIfExists(...args),
    createTemplate: (...args) => mockCreateTemplate(...args),
    updateTemplate: (...args) => mockUpdateTemplate(...args),
    deleteTemplate: (...args) => mockDeleteTemplate(...args),
    duplicateTemplate: (...args) => mockDuplicateTemplate(...args)
}));

// Mock cache service
vi.mock('../../services/cache.service.js', () => ({
    invalidateTemplatesCaches: vi.fn(),
    templatesCache: {
        get: vi.fn(() => null),
        set: vi.fn(),
        invalidate: vi.fn()
    }
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

// Mock validation middleware
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    createTemplateSchema: {},
    updateTemplateSchema: {},
    normalizeRequestBodyAliases: (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return value;
        }

        const normalized = { ...value };
        if (normalized.Name !== undefined && normalized.name === undefined) normalized.name = normalized.Name;
        if (normalized.Description !== undefined && normalized.description === undefined) normalized.description = normalized.Description;
        if (normalized.Popular !== undefined && normalized.popular === undefined) normalized.popular = normalized.Popular;
        if (normalized.Status !== undefined && normalized.status === undefined) normalized.status = normalized.Status;
        if (normalized.Tags !== undefined && normalized.tags === undefined) normalized.tags = normalized.Tags;
        if (normalized.PreviewImage !== undefined && normalized.previewImage === undefined) normalized.previewImage = normalized.PreviewImage;
        if (normalized.HeaderContent !== undefined && normalized.headerContent === undefined) normalized.headerContent = normalized.HeaderContent;
        if (normalized.TemplateContent !== undefined && normalized.templateContent === undefined) normalized.templateContent = normalized.TemplateContent;
        if (normalized.FooterContent !== undefined && normalized.footerContent === undefined) normalized.footerContent = normalized.FooterContent;
        if (normalized.FooterHeight !== undefined && normalized.footerHeight === undefined) normalized.footerHeight = normalized.FooterHeight;
        if (normalized.Stylesheet !== undefined && normalized.stylesheet === undefined) normalized.stylesheet = normalized.Stylesheet;
        if (normalized['Firm ID'] !== undefined && normalized.firmId === undefined) normalized.firmId = normalized['Firm ID'];
        if (normalized.FirmId !== undefined && normalized.firmId === undefined) normalized.firmId = normalized.FirmId;
        if (normalized.firm_id !== undefined && normalized.firmId === undefined) normalized.firmId = normalized.firm_id;
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
            res.status(403).json({ error: 'Admin access required' });
        }
    },
    isUserAdmin: (req) => req.user?.role === 'admin'
}));

// Import routes after mocks
import templateRoutes from '../../routes/templates/crud.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/templates', templateRoutes);
    return app;
}

// Helper: a sample DB row in snake_case
const sampleTemplateRow = {
    id: 'tpl-123',
    name: 'Modern CV',
    description: 'A modern template',
    popular: true,
    status: 'active',
    tags: ['modern', 'clean'],
    preview_image_url: 'https://example.com/preview.png',
    header_content: '<header>Test</header>',
    template_content: '<main>{{content}}</main>',
    footer_content: '<footer>Page {{page}}</footer>',
    footer_height: 30,
    stylesheet: 'body { font-family: sans-serif; }',
    firm_id: 'firm-123',
    firm_name: 'Test Firm',
    updated_at: '2026-01-15T10:00:00Z',
    created_at: '2026-01-01T10:00:00Z'
};

describe('Templates CRUD Routes', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
        mockGetUserFirmId.mockResolvedValue('firm-123');
    });

    // ==========================================
    // GET /api/templates
    // ==========================================
    describe('GET /api/templates', () => {
        it('should return 401 without authentication', async () => {
            const res = await request(app).get('/api/templates');
            expect(res.status).toBe(401);
        });

        it('should return paginated templates', async () => {
            mockListTemplates.mockResolvedValueOnce({
                templates: [sampleTemplateRow, { ...sampleTemplateRow, id: 'tpl-456', name: 'Classic CV' }],
                totalCount: 2,
                hasMore: false
            });

            const res = await request(app)
                .get('/api/templates')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.pagination).toBeDefined();
            expect(res.body.pagination.totalCount).toBe(2);
        });

        it('should map DB rows to PascalCase frontend format', async () => {
            mockListTemplates.mockResolvedValueOnce({
                templates: [sampleTemplateRow],
                totalCount: 1,
                hasMore: false
            });

            const res = await request(app)
                .get('/api/templates')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            const tpl = res.body.data[0];
            expect(tpl.id).toBe('tpl-123');
            expect(tpl.Name).toBe('Modern CV');
            expect(tpl.Description).toBe('A modern template');
            expect(tpl.Popular).toBe(true);
            expect(tpl.Status).toBe('active');
            expect(tpl.Tags).toEqual(['modern', 'clean']);
            expect(tpl.HeaderContent).toBe('<header>Test</header>');
            expect(tpl.TemplateContent).toBe('<main>{{content}}</main>');
            expect(tpl.FooterContent).toBe('<footer>Page {{page}}</footer>');
            expect(tpl.FooterHeight).toBe(30);
            expect(tpl.Stylesheet).toBe('body { font-family: sans-serif; }');
            expect(tpl.FirmId).toBe('firm-123');
            expect(tpl.FirmName).toBe('Test Firm');
        });

        it('should filter by search term', async () => {
            mockListTemplates.mockResolvedValueOnce({
                templates: [sampleTemplateRow],
                totalCount: 1,
                hasMore: false
            });

            const res = await request(app)
                .get('/api/templates?search=modern')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(mockListTemplates).toHaveBeenCalledWith(
                expect.objectContaining({ search: 'modern' })
            );
        });

        it('should filter by status', async () => {
            mockListTemplates.mockResolvedValueOnce({
                templates: [sampleTemplateRow],
                totalCount: 1,
                hasMore: false
            });

            const res = await request(app)
                .get('/api/templates?status=active')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
        });

        it('should bypass cache on explicit refresh', async () => {
            mockListTemplates.mockResolvedValueOnce({
                templates: [sampleTemplateRow],
                totalCount: 1,
                hasMore: false
            });

            const res = await request(app)
                .get('/api/templates?refresh=1')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(mockListTemplates).toHaveBeenCalledWith(
                expect.objectContaining({ bypassCache: true })
            );
        });

        it('should support pagination params', async () => {
            mockListTemplates.mockResolvedValueOnce({
                templates: [],
                totalCount: 50,
                hasMore: false
            });

            const res = await request(app)
                .get('/api/templates?page=3&limit=10')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.pagination.page).toBe(3);
            expect(res.body.pagination.limit).toBe(10);
        });

        it('should reject invalid pagination params', async () => {
            const res = await request(app)
                .get('/api/templates?page=0&limit=-1')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid pagination parameters');
        });

        it('should reject non-admin users without firm association', async () => {
            mockGetUserFirmId.mockResolvedValueOnce(null);

            const res = await request(app)
                .get('/api/templates')
                .set('Authorization', 'Bearer valid-token')
                .set('x-test-role', 'user');

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('No firm association');
            expect(mockListTemplates).not.toHaveBeenCalled();
        });

        it('should handle hasMore pagination correctly', async () => {
            const rows = Array.from({ length: 10 }, (_, i) => ({
                ...sampleTemplateRow, id: `tpl-${i}`
            }));
            mockListTemplates.mockResolvedValueOnce({
                templates: rows,
                totalCount: 50,
                hasMore: true
            });

            const res = await request(app)
                .get('/api/templates?limit=10')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(10);
            expect(res.body.pagination.hasMore).toBe(true);
            expect(res.body.pagination.nextPage).toBe(2);
        });

        it('should return 500 on database error', async () => {
            mockListTemplates.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/templates')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch templates');
        });
    });

    // ==========================================
    // GET /api/templates/:id
    // ==========================================
    describe('GET /api/templates/:id', () => {
        it('should return 401 without authentication', async () => {
            const res = await request(app).get('/api/templates/tpl-123');
            expect(res.status).toBe(401);
        });

        it('should return template by ID', async () => {
            mockGetTemplateByIdWithAccess.mockResolvedValueOnce(sampleTemplateRow);

            const res = await request(app)
                .get('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.id).toBe('tpl-123');
            expect(res.body.Name).toBe('Modern CV');
            expect(res.body.HeaderContent).toBe('<header>Test</header>');
        });

        it('should return 404 for non-existent template', async () => {
            const notFoundError = new Error('Not found');
            notFoundError.statusCode = 404;
            mockGetTemplateByIdWithAccess.mockRejectedValueOnce(notFoundError);

            const res = await request(app)
                .get('/api/templates/nonexistent')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Template not found');
        });

        it('should return 500 on unexpected error', async () => {
            mockGetTemplateByIdWithAccess.mockRejectedValueOnce(new Error('Connection lost'));

            const res = await request(app)
                .get('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch template');
        });

        it('should pass access context when fetching template by ID', async () => {
            mockGetTemplateByIdWithAccess.mockResolvedValueOnce(sampleTemplateRow);

            const res = await request(app)
                .get('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token')
                .set('x-test-role', 'user');

            expect(res.status).toBe(200);
            expect(mockGetTemplateByIdWithAccess).toHaveBeenCalledWith('tpl-123', {
                isAdmin: false,
                userFirmId: 'firm-123',
                bypassCache: false
            });
        });

        it('should bypass cache on explicit detail refresh', async () => {
            mockGetTemplateByIdWithAccess.mockResolvedValueOnce(sampleTemplateRow);

            const res = await request(app)
                .get('/api/templates/tpl-123?refresh=1')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(mockGetTemplateByIdWithAccess).toHaveBeenCalledWith('tpl-123', {
                isAdmin: true,
                userFirmId: 'firm-123',
                bypassCache: true
            });
        });
    });

    // ==========================================
    // POST /api/templates
    // ==========================================
    describe('POST /api/templates', () => {
        const newTemplateBody = {
            Name: 'New Template',
            Description: 'A brand new template',
            Popular: false,
            Status: 'active',
            Tags: ['new'],
            HeaderContent: '<header>New</header>',
            TemplateContent: '<main>New content</main>',
            FooterContent: '<footer></footer>',
            FooterHeight: 25,
            Stylesheet: 'body {}'
        };

        it('should return 401 without authentication', async () => {
            const res = await request(app)
                .post('/api/templates')
                .send(newTemplateBody);
            expect(res.status).toBe(401);
        });

        it('should return 403 for non-admin users', async () => {
            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', 'Bearer valid-token')
                .set('x-test-role', 'user')
                .send(newTemplateBody);
            expect(res.status).toBe(403);
        });

        it('should create template with valid data', async () => {
            const createdRow = {
                ...sampleTemplateRow,
                id: 'tpl-new',
                name: 'New Template',
                description: 'A brand new template'
            };
            mockCreateTemplate.mockResolvedValueOnce(createdRow);

            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', 'Bearer valid-token')
                .send(newTemplateBody);

            expect(res.status).toBe(200);
            expect(res.body.Name).toBe('New Template');
            expect(mockCreateTemplate).toHaveBeenCalled();
        });

        it('should force local admin template creation to their own firm', async () => {
            mockCreateTemplate.mockResolvedValueOnce({
                ...sampleTemplateRow,
                id: 'tpl-local-admin',
                name: 'Local Admin Template'
            });

            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', 'Bearer valid-token')
                .set('x-test-role', 'localAdmin')
                .send({
                    ...newTemplateBody,
                    firmId: 'other-firm'
                });

            expect(res.status).toBe(200);
            const createArgs = mockCreateTemplate.mock.calls[0][0];
            expect(createArgs.firm_id).toBe('firm-123');
        });

        it('should create template with camelCase payload', async () => {
            mockCreateTemplate.mockResolvedValueOnce({ ...sampleTemplateRow, name: 'Camel Template' });

            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    name: 'Camel Template',
                    description: 'Camel description',
                    templateContent: '<main>Camel</main>',
                    headerContent: '<header>Camel</header>',
                    footerContent: '<footer>Camel</footer>',
                    footerHeight: 35,
                    stylesheet: 'body { color: black; }',
                    status: 'active',
                    tags: ['camel'],
                    popular: true,
                    previewImage: 'https://example.com/camel.png',
                    firmId: 'firm-123'
                });

            expect(res.status).toBe(200);
            const createArgs = mockCreateTemplate.mock.calls[0][0];
            expect(createArgs.name).toBe('Camel Template');
            expect(createArgs.template_content).toBe('<main>Camel</main>');
            expect(createArgs.preview_image_url).toBe('https://example.com/camel.png');
            expect(createArgs.status).toBe('active');
        });

        it('should pass mapped snake_case fields to createTemplate', async () => {
            mockCreateTemplate.mockResolvedValueOnce(sampleTemplateRow);

            await request(app)
                .post('/api/templates')
                .set('Authorization', 'Bearer valid-token')
                .send(newTemplateBody);

            const createArgs = mockCreateTemplate.mock.calls[0][0];
            expect(createArgs.name).toBe('New Template');
            expect(createArgs.description).toBe('A brand new template');
            expect(createArgs.header_content).toBe('<header>New</header>');
            expect(createArgs.template_content).toBe('<main>New content</main>');
            expect(createArgs.stylesheet).toBe('body {}');
            expect(createArgs.firm_id).toBe('firm-123');
        });

        it('should strip null bytes from template payloads before inserting', async () => {
            mockCreateTemplate.mockResolvedValueOnce(sampleTemplateRow);

            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    Name: 'Imported\u0000 Template',
                    Description: 'Generated\u0000 template',
                    HeaderContent: '<header>Logo\u0000</header>',
                    TemplateContent: '<main>Body\u0000</main>',
                    FooterContent: '<footer>Page\u0000</footer>',
                    FooterHeight: 25,
                    Stylesheet: '.cv::before { content: "\\0000"; }\u0000',
                    Tags: ['imported\u0000', 'cv']
                });

            expect(res.status).toBe(200);
            const createArgs = mockCreateTemplate.mock.calls[0][0];
            expect(createArgs.name).toBe('Imported Template');
            expect(createArgs.description).toBe('Generated template');
            expect(createArgs.header_content).toBe('<header>Logo</header>');
            expect(createArgs.template_content).toBe('<main>Body</main>');
            expect(createArgs.footer_content).toBe('<footer>Page</footer>');
            expect(createArgs.stylesheet).toBe('.cv::before { content: "\\0000"; }');
            expect(createArgs.tags).toEqual(['imported', 'cv']);
        });

        it('should create global template when admin sets firm_id to empty string', async () => {
            // Route uses: req.body.firm_id || req.body['Firm ID']
            // Then checks: requestedFirmId === '' || requestedFirmId === null
            // To hit the empty-string path, use 'Firm ID' key directly (avoids || short-circuit)
            mockCreateTemplate.mockResolvedValueOnce({ ...sampleTemplateRow, firm_id: null });

            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', 'Bearer valid-token')
                .send({ ...newTemplateBody, 'Firm ID': '' });

            expect(res.status).toBe(200);
            const createArgs = mockCreateTemplate.mock.calls[0][0];
            expect(createArgs.firm_id).toBeNull();
        });

        it('should validate firm exists when admin specifies another firm', async () => {
            mockGetFirmIfExists.mockResolvedValueOnce(null); // firm not found

            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', 'Bearer valid-token')
                .send({ ...newTemplateBody, firm_id: 'other-firm' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Specified firm not found');
        });

        it('should return 400 on duplicate name', async () => {
            const dupError = new Error('duplicate key');
            dupError.code = '23505';
            mockCreateTemplate.mockRejectedValueOnce(dupError);

            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', 'Bearer valid-token')
                .send(newTemplateBody);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Template with this name already exists');
        });

        it('should invalidate cache on create', async () => {
            const { invalidateTemplatesCaches } = await import('../../services/cache.service.js');
            mockCreateTemplate.mockResolvedValueOnce(sampleTemplateRow);

            await request(app)
                .post('/api/templates')
                .set('Authorization', 'Bearer valid-token')
                .send(newTemplateBody);

            expect(invalidateTemplatesCaches).toHaveBeenCalled();
        });
    });

    // ==========================================
    // PUT /api/templates/:id
    // ==========================================
    describe('PUT /api/templates/:id', () => {
        const updateBody = {
            Name: 'Updated Template',
            Description: 'Updated description'
        };

        it('should return 401 without authentication', async () => {
            const res = await request(app)
                .put('/api/templates/tpl-123')
                .send(updateBody);
            expect(res.status).toBe(401);
        });

        it('should return 403 for non-admin users', async () => {
            const res = await request(app)
                .put('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token')
                .set('x-test-role', 'user')
                .send(updateBody);
            expect(res.status).toBe(403);
        });

        it('should update template with camelCase payload', async () => {
            mockGetTemplateById.mockResolvedValueOnce(sampleTemplateRow);
            mockUpdateTemplate.mockResolvedValueOnce({ ...sampleTemplateRow, name: 'Camel Updated', description: 'Camel updated description' });

            const res = await request(app)
                .put('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    name: 'Camel Updated',
                    description: 'Camel updated description',
                    status: 'inactive',
                    templateContent: '<main>Updated</main>',
                    previewImage: 'https://example.com/updated.png',
                    firmId: 'firm-123'
                });

            expect(res.status).toBe(200);
            const updateArgs = mockUpdateTemplate.mock.calls[0];
            expect(updateArgs[1].name).toBe('Camel Updated');
            expect(updateArgs[1].status).toBe('inactive');
            expect(updateArgs[1].template_content).toBe('<main>Updated</main>');
            expect(updateArgs[1].preview_image_url).toBe('https://example.com/updated.png');
            expect(updateArgs[1].firm_id).toBe('firm-123');
        });

        it('should update template with valid data', async () => {
            mockGetTemplateById.mockResolvedValueOnce(sampleTemplateRow);
            const updatedRow = { ...sampleTemplateRow, name: 'Updated Template', description: 'Updated description' };
            mockUpdateTemplate.mockResolvedValueOnce(updatedRow);

            const res = await request(app)
                .put('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token')
                .send(updateBody);

            expect(res.status).toBe(200);
            expect(res.body.Name).toBe('Updated Template');
            expect(res.body.Description).toBe('Updated description');
        });

        it('should return 404 when template does not exist', async () => {
            const notFoundError = new Error('Not found');
            notFoundError.statusCode = 404;
            mockGetTemplateById.mockRejectedValueOnce(notFoundError);

            const res = await request(app)
                .put('/api/templates/nonexistent')
                .set('Authorization', 'Bearer valid-token')
                .send(updateBody);

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Template not found');
        });

        it('should return 400 on duplicate name conflict', async () => {
            mockGetTemplateById.mockResolvedValueOnce(sampleTemplateRow);
            const dupError = new Error('duplicate key');
            dupError.code = '23505';
            mockUpdateTemplate.mockRejectedValueOnce(dupError);

            const res = await request(app)
                .put('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token')
                .send({ Name: 'Existing Template Name' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Template with this name already exists');
        });

        it('should allow admin to change firm_id', async () => {
            mockGetTemplateById.mockResolvedValueOnce(sampleTemplateRow);
            mockGetFirmIfExists.mockResolvedValueOnce({ id: 'firm-other', name: 'Other Firm' });
            mockUpdateTemplate.mockResolvedValueOnce({ ...sampleTemplateRow, firm_id: 'firm-other' });

            const res = await request(app)
                .put('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token')
                .send({ ...updateBody, FirmId: 'firm-other' });

            expect(res.status).toBe(200);
            const updateArgs = mockUpdateTemplate.mock.calls[0];
            expect(updateArgs[1].firm_id).toBe('firm-other');
        });

        it('should update firm_id from normalized alias payloads', async () => {
            mockGetTemplateById.mockResolvedValueOnce(sampleTemplateRow);
            mockGetFirmIfExists.mockResolvedValueOnce({ id: 'firm-other', name: 'Other Firm' });
            mockUpdateTemplate.mockResolvedValueOnce({ ...sampleTemplateRow, firm_id: 'firm-other' });

            const res = await request(app)
                .put('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token')
                .send({ ...updateBody, 'Firm ID': 'firm-other' });

            expect(res.status).toBe(200);
            const updateArgs = mockUpdateTemplate.mock.calls[0];
            expect(updateArgs[1].firm_id).toBe('firm-other');
        });

        it('should allow admin to make template global', async () => {
            mockGetTemplateById.mockResolvedValueOnce(sampleTemplateRow);
            mockUpdateTemplate.mockResolvedValueOnce({ ...sampleTemplateRow, firm_id: null });

            const res = await request(app)
                .put('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token')
                .send({ ...updateBody, FirmId: null });

            expect(res.status).toBe(200);
            const updateArgs = mockUpdateTemplate.mock.calls[0];
            expect(updateArgs[1].firm_id).toBeNull();
        });

        it('should invalidate cache on update', async () => {
            const { invalidateTemplatesCaches } = await import('../../services/cache.service.js');
            mockGetTemplateById.mockResolvedValueOnce(sampleTemplateRow);
            mockUpdateTemplate.mockResolvedValueOnce(sampleTemplateRow);

            await request(app)
                .put('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token')
                .send(updateBody);

            expect(invalidateTemplatesCaches).toHaveBeenCalled();
        });
    });

    // ==========================================
    // POST /api/templates/:id/duplicate
    // ==========================================
    describe('POST /api/templates/:id/duplicate', () => {
        it('should require a target firm for super admin duplication', async () => {
            const res = await request(app)
                .post('/api/templates/tpl-123/duplicate')
                .set('Authorization', 'Bearer valid-token')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Target firm is required');
        });

        it('should duplicate template into the requested firm for super admin', async () => {
            mockGetTemplateById.mockResolvedValueOnce(sampleTemplateRow);
            mockGetFirmIfExists.mockResolvedValueOnce({ id: 'firm-456', name: 'Other Firm' });
            mockDuplicateTemplate.mockResolvedValueOnce({ ...sampleTemplateRow, id: 'tpl-dup', firm_id: 'firm-456' });

            const res = await request(app)
                .post('/api/templates/tpl-123/duplicate')
                .set('Authorization', 'Bearer valid-token')
                .send({ firmId: 'firm-456' });

            expect(res.status).toBe(201);
            expect(mockDuplicateTemplate).toHaveBeenCalledWith('tpl-123', { firm_id: 'firm-456' });
            expect(res.body.FirmId).toBe('firm-456');
        });

        it('should reject duplication when target firm does not exist', async () => {
            mockGetTemplateById.mockResolvedValueOnce(sampleTemplateRow);
            mockGetFirmIfExists.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/templates/tpl-123/duplicate')
                .set('Authorization', 'Bearer valid-token')
                .send({ firmId: 'missing-firm' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Specified firm not found');
            expect(mockDuplicateTemplate).not.toHaveBeenCalled();
        });

        it('should force local admin duplication to their own firm', async () => {
            mockGetTemplateById.mockResolvedValueOnce(sampleTemplateRow);
            mockDuplicateTemplate.mockResolvedValueOnce({ ...sampleTemplateRow, id: 'tpl-local-dup', firm_id: 'firm-123' });

            const res = await request(app)
                .post('/api/templates/tpl-123/duplicate')
                .set('Authorization', 'Bearer valid-token')
                .set('x-test-role', 'localAdmin')
                .send({ firmId: 'firm-999' });

            expect(res.status).toBe(201);
            expect(mockDuplicateTemplate).toHaveBeenCalledWith('tpl-123', { firm_id: 'firm-123' });
        });

        it('should reject local admin duplication for a template from another firm', async () => {
            mockGetTemplateById.mockResolvedValueOnce({ ...sampleTemplateRow, firm_id: 'other-firm' });

            const res = await request(app)
                .post('/api/templates/tpl-123/duplicate')
                .set('Authorization', 'Bearer valid-token')
                .set('x-test-role', 'localAdmin')
                .send({ firmId: 'firm-123' });

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Template not found');
        });
    });

    // ==========================================
    // DELETE /api/templates/:id
    // ==========================================
    describe('DELETE /api/templates/:id', () => {
        it('should return 401 without authentication', async () => {
            const res = await request(app).delete('/api/templates/tpl-123');
            expect(res.status).toBe(401);
        });

        it('should return 403 for non-admin users', async () => {
            const res = await request(app)
                .delete('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token')
                .set('x-test-role', 'user');
            expect(res.status).toBe(403);
        });

        it('should delete template successfully', async () => {
            mockDeleteTemplate.mockResolvedValueOnce(true);

            const res = await request(app)
                .delete('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Template deleted successfully');
            expect(mockDeleteTemplate).toHaveBeenCalledWith('tpl-123');
        });

        it('should return 404 for non-existent template', async () => {
            const notFoundError = new Error('Not found');
            notFoundError.statusCode = 404;
            mockDeleteTemplate.mockRejectedValueOnce(notFoundError);

            const res = await request(app)
                .delete('/api/templates/nonexistent')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Template not found');
        });

        it('should return 500 on unexpected error', async () => {
            mockDeleteTemplate.mockRejectedValueOnce(new Error('DB failure'));

            const res = await request(app)
                .delete('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to delete template');
        });

        it('should invalidate cache on delete', async () => {
            const { invalidateTemplatesCaches } = await import('../../services/cache.service.js');
            mockDeleteTemplate.mockResolvedValueOnce(true);

            await request(app)
                .delete('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token');

            expect(invalidateTemplatesCaches).toHaveBeenCalled();
        });

        it('should invalidate cache only after successful deletion', async () => {
            const { invalidateTemplatesCaches } = await import('../../services/cache.service.js');
            const callOrder = [];
            mockDeleteTemplate.mockImplementationOnce(async () => {
                callOrder.push('delete');
                return true;
            });
            vi.mocked(invalidateTemplatesCaches).mockImplementationOnce(async () => {
                callOrder.push('invalidate');
            });

            const res = await request(app)
                .delete('/api/templates/tpl-123')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(callOrder).toEqual(['delete', 'invalidate']);
        });
    });

    // ==========================================
    // Error message safety
    // ==========================================
    describe('Error message safety', () => {
        it('should not leak internal error details in GET list response', async () => {
            mockListTemplates.mockRejectedValueOnce(new Error('relation "templates" does not exist'));

            const res = await request(app)
                .get('/api/templates')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch templates');
            expect(res.body.message).toBeUndefined();
        });

        it('should not leak internal error details in POST response', async () => {
            mockCreateTemplate.mockRejectedValueOnce(new Error('column "bad_col" does not exist'));

            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', 'Bearer valid-token')
                .send({ Name: 'Test', TemplateContent: '<p>test</p>' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to create template');
            expect(res.body.message).toBeUndefined();
        });
    });
});
