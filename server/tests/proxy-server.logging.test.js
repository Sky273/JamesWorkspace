import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mockSafeLog = vi.fn();

vi.mock('../utils/logger.backend.js', () => ({
    safeLog: (...args) => mockSafeLog(...args)
}));

vi.mock('../config/envValidation.js', () => ({
    validateEnvironmentOrExit: vi.fn()
}));

vi.mock('../config/axios.js', () => ({
    configureAxios: vi.fn()
}));

vi.mock('../config/security.js', () => ({
    configureHelmet: vi.fn(),
    configureCors: vi.fn(),
    configureCsrf: vi.fn()
}));

vi.mock('../config/staticFiles.js', () => ({
    configureStaticFiles: vi.fn()
}));

vi.mock('../config/lifecycle.js', () => ({
    startServer: vi.fn(() => ({}))
}));

vi.mock('../middleware/metrics.middleware.js', () => ({
    default: (_req, _res, next) => next()
}));

vi.mock('../middleware/apm.middleware.js', () => ({
    apmMiddleware: (_req, _res, next) => next()
}));

vi.mock('../middleware/rateLimit.middleware.js', () => ({
    globalLimiter: (_req, _res, next) => next()
}));

vi.mock('../services/metrics.service.js', () => ({
    metrics: {
        trackError: vi.fn()
    }
}));

vi.mock('../config/routeRegistry.js', () => ({
    registerSwaggerRoutes: vi.fn(),
    registerCacheControl: vi.fn(),
    registerProxyRoutes: vi.fn(),
    registerApiRoutes: vi.fn((app) => {
        app.post('/api/test-400', (req, res) => {
            res.status(400).json({
                error: 'Validation failed',
                details: [
                    { field: 'password', message: 'required' }
                ],
                providedKeys: Object.keys(req.body || {})
            });
        });
        app.get('/api/test-400-send', (_req, res) => {
            res.status(400);
            res.type('application/json');
            res.send({
                error: 'Validation failed via send',
                details: [
                    { field: 'origin', message: 'invalid' }
                ]
            });
        });
    })
}));

describe('proxy-server 400 diagnostics', () => {
    let app;

    beforeEach(async () => {
        vi.resetModules();
        mockSafeLog.mockReset();
        ({ default: app } = await import('../proxy-server.js'));
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('logs bounded request diagnostics without auth or CSRF cookie metadata', async () => {
        const response = await request(app)
            .post('/api/test-400')
            .set('Content-Type', 'application/json')
            .set('Origin', 'https://example.test')
            .set('Cookie', [
                'accessToken=secret-token',
                'x-csrf-token=csrf-secret'
            ])
            .send({
                password: 'super-secret',
                token: 'another-secret'
            });

        expect(response.status).toBe(400);

        const diagnosticCall = mockSafeLog.mock.calls.find(([level, message]) => (
            level === 'warn' && message === '400 Bad Request diagnostic'
        ));

        expect(diagnosticCall).toBeTruthy();
        const [, , payload] = diagnosticCall;

        expect(payload).toMatchObject({
            path: '/api/test-400',
            method: 'POST',
            origin: 'https://example.test',
            contentType: 'application/json'
        });
        expect(payload.responseSummary).toMatchObject({
            type: 'object',
            keyCount: 3,
            detailCount: 1
        });
        expect(payload).not.toHaveProperty('hasAccessToken');
        expect(payload).not.toHaveProperty('hasCsrfCookie');
        expect(payload).not.toHaveProperty('userAgent');
    });

    it('logs JSON 400 diagnostics sent via res.send without duplicating the diagnostic', async () => {
        const response = await request(app)
            .get('/api/test-400-send')
            .set('Origin', 'https://example.test');

        expect(response.status).toBe(400);

        const diagnosticCalls = mockSafeLog.mock.calls.filter(([level, message]) => (
            level === 'warn' && message === '400 Bad Request diagnostic'
        ));

        expect(diagnosticCalls).toHaveLength(1);
        const [, , payload] = diagnosticCalls[0];
        expect(payload).toMatchObject({
            path: '/api/test-400-send',
            method: 'GET',
            origin: 'https://example.test'
        });
        expect(payload).not.toHaveProperty('hasAccessToken');
        expect(payload).not.toHaveProperty('hasCsrfCookie');
        expect(payload).not.toHaveProperty('userAgent');
    });
});
