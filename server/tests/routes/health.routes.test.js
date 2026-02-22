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
    ANTHROPIC_API_KEY: 'test-anthropic-key'
}));

import { query as dbQuery } from '../../config/database.js';

describe('Health Routes', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        vi.clearAllMocks();
        
        mockReq = {};
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
            // Mock DB failure
            dbQuery.mockRejectedValueOnce(new Error('Connection refused'));

            const healthRouter = (await import('../../routes/health.routes.js')).default;
            const routeHandler = healthRouter.stack.find(r => r.route?.path === '/').route.stack[0].handle;
            
            await routeHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(503);
            
            const response = mockRes.json.mock.calls[0][0];
            expect(response.status).toBe('unhealthy');
            expect(response.checks.database.status).toBe('error');
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
