/**
 * Integration tests for health routes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database query
vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

// Mock cache service
vi.mock('../../services/cache.service.js', () => ({
    settingsCache: { size: () => 5 },
    templatesCache: { size: () => 3 },
    firmsCache: { size: () => 2 }
}));

// Mock constants
vi.mock('../../config/constants.js', () => ({
    OPENAI_API_KEY: 'test-openai-key',
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    UPLOAD_DIR: './test-uploads'
}));

// Mock fileCleanup
vi.mock('../../utils/fileCleanup.js', () => ({
    getStorageStats: vi.fn().mockResolvedValue({}),
    getFileCleanupStats: vi.fn().mockReturnValue({ timerActive: false, cleanupStats: {} })
}));

// Mock jwt.service.js for admin detection in health route
vi.mock('../../services/jwt.service.js', () => ({
    verifyToken: vi.fn((token) => {
        if (token === 'valid-admin-token') {
            return { id: 'admin-1', role: 'admin', email: 'admin@test.com' };
        }
        return null;
    })
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => next(),
    requireAdmin: (req, res, next) => next()
}));

// Mock market/cache services used by /memory endpoint
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

import { query as dbQuery } from '../../config/database.js';

describe('Health Routes', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        vi.clearAllMocks();
        
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
            // Mock successful DB queries
            dbQuery.mockResolvedValueOnce({ rows: [{ connected: 1 }] });
            dbQuery.mockResolvedValueOnce({ 
                rows: [{ 
                    resumes_count: '100', 
                    users_count: '10', 
                    missions_count: '50',
                    db_size: '52428800' // 50MB
                }] 
            });

            // Import the router after mocks are set up
            const healthRouter = (await import('../../routes/health.routes.js')).default;
            
            // Get the route handler
            const routeHandler = healthRouter.stack.find(r => r.route?.path === '/').route.stack[0].handle;
            
            await routeHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalled();
            
            const response = mockRes.json.mock.calls[0][0];
            expect(response.status).toBe('healthy');
            expect(response.checks.server.status).toBe('ok');
            expect(response.checks.database.status).toBe('ok');
            expect(response.checks.openai.status).toBe('configured');
            expect(response.checks.anthropic.status).toBe('configured');
            expect(response.checks.cache.status).toBe('ok');
        });

        it('should return unhealthy status when database fails', async () => {
            // Mock DB failure - Promise.all inside Promise.race rejects
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
            // Non-admin: no cookies
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
            // Non-admin should NOT see checks
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

            expect(global.fetch).not.toHaveBeenCalled();
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
    });
});
