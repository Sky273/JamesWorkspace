import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockAuthenticateToken = vi.fn((req, res, next) => {
    if (req.headers['x-test-auth'] === 'ok') {
        req.user = { id: 'user-123', role: 'user', email: 'test@example.com' };
        return next();
    }

    return res.status(401).json({ error: 'Unauthorized' });
});

const mockUserRateLimit = vi.fn(() => (req, _res, next) => next());

vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (...args) => mockAuthenticateToken(...args)
}));

vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    userRateLimit: (...args) => mockUserRateLimit(...args)
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

const mockRouter = express.Router();
mockRouter.use((_req, res) => res.status(501).json({ error: 'not used in this test' }));

vi.mock('../../routes/health.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/metrics.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/auth.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/settings.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/missions.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/resumes.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/templates.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/firms.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/llm.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/admin.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/adaptations.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/tags.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/users.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/chatbot.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/marketRadar.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/rome.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/docs.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/clients.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/resumeSubmissions.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/mail.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/emailTemplates.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/consent.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/gdprMail.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/twofa.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/gdprAudit.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/resumeComments.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/share.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/pipeline.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/calendar.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/backup.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/batchExport.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/batchJobs.routes.js', () => ({ default: mockRouter }));
vi.mock('../../routes/deals.routes.js', () => ({ default: mockRouter }));
vi.mock('../../config/swagger.js', () => ({ swaggerDocument: {} }));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const { registerProxyRoutes } = await import('../../config/routeRegistry.js');

function createTestApp() {
    const app = express();
    app.use(express.json());
    registerProxyRoutes(app);
    return app;
}

describe('Proxy Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects generate-pdf without authentication', async () => {
        const app = createTestApp();

        const res = await request(app)
            .post('/generate-pdf')
            .send({ htmlContent: '<p>test</p>' });

        expect(res.status).toBe(401);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('proxies generate-pdf when authenticated with a sanitized payload', async () => {
        const app = createTestApp();
        mockFetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({
                'Content-Disposition': 'attachment; filename="test.pdf"'
            }),
            arrayBuffer: () => Promise.resolve(new TextEncoder().encode('pdf').buffer)
        });

        const res = await request(app)
            .post('/generate-pdf')
            .set('x-test-auth', 'ok')
            .send({
                htmlContent: '<div onclick="alert(1)">Test<script>alert(1)</script><img src="data:image/png;base64,AAAA" onerror="alert(2)" /></div>',
                filename: '../my evil file',
                stylesheet: 'body{background-image:url(https://evil.test/x)} </style><script>alert(1)</script>',
                headerContent: '<header onclick="alert(1)"><span style="color:#333">Head</span></header>',
                footerContent: '<a href="javascript:alert(1)">Footer</a>',
                footerHeight: '25',
                format: 'pdf'
            });

        expect(res.status).toBe(200);
        expect(mockUserRateLimit).toHaveBeenCalledWith(20, 15 * 60 * 1000);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch.mock.calls[0][1].headers['x-internal-service-token']).toBeDefined();

        const forwardedBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(forwardedBody.filename).toBe('my_evil_file.pdf');
        expect(forwardedBody.htmlContent).toContain('<img');
        expect(forwardedBody.htmlContent).not.toContain('onclick');
        expect(forwardedBody.htmlContent).not.toContain('<script');
        expect(forwardedBody.stylesheet).not.toContain('https://evil.test');
        expect(forwardedBody.stylesheet).not.toContain('</style>');
        expect(forwardedBody.stylesheet).not.toContain('<script');
        expect(forwardedBody.headerContent).toContain('style="color:#333"');
        expect(forwardedBody.footerContent).not.toContain('javascript:');
        expect(forwardedBody.footerHeight).toBe(25);
        expect(forwardedBody.format).toBeUndefined();
        expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('rejects unexpected fields on generate-pdf', async () => {
        const app = createTestApp();

        const res = await request(app)
            .post('/generate-pdf')
            .set('x-test-auth', 'ok')
            .send({
                htmlContent: '<p>test</p>',
                filename: 'resume.pdf',
                unexpected: 'value'
            });

        expect(res.status).toBe(400);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects generate-docx without authentication', async () => {
        const app = createTestApp();

        const res = await request(app)
            .post('/generate-docx')
            .send({ htmlContent: '<p>test</p>' });

        expect(res.status).toBe(401);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('normalizes docx payload before proxying', async () => {
        const app = createTestApp();
        mockFetch.mockResolvedValueOnce({
            ok: true,
            headers: new Headers({
                'Content-Type': 'application/msword',
                'Content-Disposition': 'attachment; filename="resume.doc"'
            }),
            arrayBuffer: () => Promise.resolve(new TextEncoder().encode('doc').buffer)
        });

        const res = await request(app)
            .post('/generate-docx')
            .set('x-test-auth', 'ok')
            .send({
                htmlContent: '<p>Doc</p>',
                filename: 'resume.pdf',
                format: 'DOC'
            });

        expect(res.status).toBe(200);
        const forwardedBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(forwardedBody.format).toBe('doc');
        expect(forwardedBody.filename).toBe('resume.doc');
    });
});

