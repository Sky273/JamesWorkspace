/**
 * Integration tests for health routes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../services/cache.service.js', () => ({
    settingsCache: { size: () => 5 },
    templatesCache: { size: () => 3 },
    firmsCache: { size: () => 2 },
    getCacheRegistryStats: () => ({
        settings: { name: 'settings', size: 5, backend: 'redis', effectiveBackend: 'redis', connected: true, disabledReason: null },
        templates: { name: 'templates', size: 3, backend: 'redis', effectiveBackend: 'redis', connected: true, disabledReason: null },
        firms: { name: 'firms', size: 2, backend: 'redis', effectiveBackend: 'redis', connected: true, disabledReason: null }
    })
}));

vi.mock('../../config/constants.js', () => ({
    OPENAI_API_KEY: 'test-openai-key',
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    DEEPSEEK_API_KEY: 'test-deepseek-key',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
    GLM_API_KEY: 'test-glm-key',
    GLM_BASE_URL: 'https://api.z.ai/api/paas/v4',
    MINIMAX_API_KEY: 'test-minimax-key',
    MINIMAX_ANTHROPIC_BASE_URL: 'https://api.minimax.io/anthropic',
    OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
    UPLOAD_DIR: './test-uploads'
}));

vi.mock('../../utils/fileCleanup.js', () => ({
    getStorageStats: vi.fn().mockResolvedValue({}),
    getFileCleanupStats: vi.fn().mockReturnValue({ timerActive: false, cleanupStats: {} })
}));

vi.mock('../../services/jwt.service.js', () => ({
    verifyToken: vi.fn((token) => {
        if (token === 'valid-admin-token') {
            return { id: 'admin-1', role: 'admin', email: 'admin@test.com' };
        }
        return null;
    })
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => next(),
    requireAdmin: (req, res, next) => next()
}));

vi.mock('../../services/marketTrends.service.js', () => ({
    getTrendsCacheStats: vi.fn(() => ({ size: 0 }))
}));
vi.mock('../../services/marketFacts.service.js', () => ({
    getFactsCacheStats: vi.fn(() => ({ size: 0 }))
}));
vi.mock('../../services/rome.service.js', () => ({
    getMetiersCacheStats: vi.fn(() => ({ size: 0 }))
}));
vi.mock('../../services/escoService.js', () => ({
    getEscoCacheStats: vi.fn(() => ({ size: 0 }))
}));
vi.mock('../../routes/tags.routes.js', () => ({
    getTagsCacheStats: vi.fn(() => ({}))
}));
vi.mock('../../services/tokenBlacklist.service.js', () => ({
    getBlacklistStats: vi.fn(() => ({ blacklistedTokens: 0, blacklistedUsers: 0 }))
}));

vi.mock('../../services/pdfTextExtraction.service.js', () => ({
    getOcrRuntimeDiagnostics: vi.fn(() => ({
        status: 'ok',
        preferredEngine: 'tesseract-cli',
        tesseractCliAvailable: true,
        pdftoppmAvailable: true,
        pythonCommand: 'python3',
        advancedBackend: 'paddleocr',
        advancedBackendAvailable: true,
        notes: 'CLI OCR pipeline available'
    }))
}));

vi.mock('../../services/wordTextExtraction.service.js', () => ({
    getWordExtractionRuntimeDiagnostics: vi.fn(() => ({
        sofficeAvailable: true,
        wordOcrFallbackAvailable: true,
        notes: 'LibreOffice CLI available for Word to PDF OCR fallback'
    }))
}));

import { query as dbQuery } from '../../config/database.js';

describe('Health Routes', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

        mockReq = {
            query: {},
            cookies: { accessToken: 'valid-admin-token' }
        };
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };
    });

    describe('GET /health', () => {
        it('should return healthy status when all checks pass', async () => {
            dbQuery.mockResolvedValueOnce({ rows: [{ connected: 1 }] });
            dbQuery.mockResolvedValueOnce({
                rows: [{
                    resumes_count: '100',
                    users_count: '10',
                    missions_count: '50',
                    db_size: '52428800'
                }]
            });

            const healthRouter = (await import('../../routes/health.routes.js')).default;
            const routeHandler = healthRouter.stack.find(r => r.route?.path === '/').route.stack[0].handle;

            await routeHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            const response = mockRes.json.mock.calls[0][0];
            expect(response.status).toBe('healthy');
            expect(response.checks.server.status).toBe('ok');
            expect(response.checks.database.status).toBe('ok');
            expect(response.checks.openai.status).toBe('configured');
            expect(response.checks.anthropic.status).toBe('configured');
            expect(response.checks.deepseek.status).toBe('configured');
            expect(response.checks.glm.status).toBe('configured');
            expect(response.checks.minimax.status).toBe('configured');
            expect(response.checks.cache.status).toBe('ok');
            expect(response.checks.cache.backend).toBe('redis');
            expect(response.checks.cache.connected).toBe(true);
            expect(response.checks.cache.fallbackReason).toBeNull();
            expect(response.checks.ocr.status).toBe('ok');
            expect(response.checks.ocr.preferredEngine).toBe('tesseract-cli');
            expect(response.checks.ocr.advancedBackend).toBe('paddleocr');
            expect(response.checks.ocr.sofficeAvailable).toBe(true);
            expect(response.checks.ocr.wordOcrFallbackAvailable).toBe(true);
        });

        it('should return unhealthy status when database fails', async () => {
            dbQuery.mockRejectedValue(new Error('Connection refused'));

            const healthRouter = (await import('../../routes/health.routes.js')).default;
            const routeHandler = healthRouter.stack.find(r => r.route?.path === '/').route.stack[0].handle;

            await routeHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(503);
            const response = mockRes.json.mock.calls[0][0];
            expect(response.status).toBe('unhealthy');
            expect(response.checks.database.status).toBe('error');
        });

        it('should return minimal response for non-admin users', async () => {
            mockReq.cookies = {};

            dbQuery.mockResolvedValueOnce({ rows: [{ connected: 1 }] });
            dbQuery.mockResolvedValueOnce({
                rows: [{ resumes_count: '10', users_count: '2', missions_count: '5', db_size: '1048576' }]
            });

            const healthRouter = (await import('../../routes/health.routes.js')).default;
            const routeHandler = healthRouter.stack.find(r => r.route?.path === '/').route.stack[0].handle;

            await routeHandler(mockReq, mockRes);

            const response = mockRes.json.mock.calls[0][0];
            expect(response.status).toBe('healthy');
            expect(response.responseTime).toBeDefined();
            expect(response.checks).toBeUndefined();
        });

        it('should ignore deep checks for non-admin users', async () => {
            mockReq.cookies = {};
            mockReq.query = { deep: 'true' };
            global.fetch = vi.fn();

            dbQuery.mockResolvedValueOnce({ rows: [{ connected: 1 }] });
            dbQuery.mockResolvedValueOnce({
                rows: [{ resumes_count: '10', users_count: '2', missions_count: '5', db_size: '1048576' }]
            });

            const healthRouter = (await import('../../routes/health.routes.js')).default;
            const routeHandler = healthRouter.stack.find(r => r.route?.path === '/').route.stack[0].handle;

            await routeHandler(mockReq, mockRes);

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(global.fetch.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/tags');
            const response = mockRes.json.mock.calls[0][0];
            expect(response.checks).toBeUndefined();
        });

        it('should include memory usage information', async () => {
            dbQuery.mockResolvedValueOnce({ rows: [{ connected: 1 }] });
            dbQuery.mockResolvedValueOnce({
                rows: [{
                    resumes_count: '100',
                    users_count: '10',
                    missions_count: '50',
                    db_size: '52428800'
                }]
            });

            const healthRouter = (await import('../../routes/health.routes.js')).default;
            const routeHandler = healthRouter.stack.find(r => r.route?.path === '/').route.stack[0].handle;

            await routeHandler(mockReq, mockRes);

            const response = mockRes.json.mock.calls[0][0];
            expect(response.checks.memory).toBeDefined();
            expect(response.checks.memory.heapUsed).toBeDefined();
            expect(response.checks.memory.heapTotal).toBeDefined();
            expect(response.checks.memory.heapPercent).toBeDefined();
        });

        it('should include response time', async () => {
            dbQuery.mockResolvedValueOnce({ rows: [{ connected: 1 }] });
            dbQuery.mockResolvedValueOnce({
                rows: [{
                    resumes_count: '100',
                    users_count: '10',
                    missions_count: '50',
                    db_size: '52428800'
                }]
            });

            const healthRouter = (await import('../../routes/health.routes.js')).default;
            const routeHandler = healthRouter.stack.find(r => r.route?.path === '/').route.stack[0].handle;

            await routeHandler(mockReq, mockRes);

            const response = mockRes.json.mock.calls[0][0];
            expect(response.responseTime).toBeDefined();
            expect(response.responseTime).toMatch(/\d+ms/);
        });

        it('should run deep connectivity checks for hosted providers including DeepSeek and MiniMax', async () => {
            mockReq.query = { deep: 'true' };
            global.fetch = vi.fn()
                .mockResolvedValueOnce({ ok: true, status: 200 })
                .mockResolvedValueOnce({ ok: true, status: 200 })
                .mockResolvedValueOnce({ ok: true, status: 200 })
                .mockResolvedValueOnce({ ok: true, status: 200 })
                .mockResolvedValueOnce({ ok: true, status: 200 })
                .mockResolvedValueOnce({ ok: true, status: 200 });

            dbQuery.mockResolvedValueOnce({ rows: [{ connected: 1 }] });
            dbQuery.mockResolvedValueOnce({
                rows: [{ resumes_count: '100', users_count: '10', missions_count: '50', db_size: '52428800' }]
            });

            const healthRouter = (await import('../../routes/health.routes.js')).default;
            const routeHandler = healthRouter.stack.find(r => r.route?.path === '/').route.stack[0].handle;

            await routeHandler(mockReq, mockRes);

            const response = mockRes.json.mock.calls[0][0];
            expect(response.checks.openai.status).toBe('ok');
            expect(response.checks.anthropic.status).toBe('ok');
            expect(response.checks.deepseek.status).toBe('ok');
            expect(response.checks.glm.status).toBe('ok');
            expect(response.checks.minimax.status).toBe('ok');
            expect(global.fetch).toHaveBeenCalledTimes(6);
            expect(global.fetch.mock.calls[2][0]).toBe('https://api.deepseek.com/chat/completions');
            expect(global.fetch.mock.calls[3][0]).toBe('https://api.z.ai/api/paas/v4/chat/completions');
            expect(global.fetch.mock.calls[4][0]).toBe('https://api.minimax.io/anthropic/v1/messages');
        });
    });
});
