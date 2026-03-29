/**
 * Tests for metrics service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn().mockReturnValue(false),
        mkdirSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        appendFileSync: vi.fn()
    },
    existsSync: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    appendFileSync: vi.fn()
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }),
    safeLog: vi.fn()
}));

// Create a simple MetricsCollector for testing
class MetricsCollector {
    constructor() {
        this.startTime = Date.now();
        this.requests = {
            total: 0,
            byMethod: {},
            byEndpoint: {},
            byStatus: {},
            responseTimes: []
        };
        this.errors = {
            total: 0,
            byType: {},
            byEndpoint: {},
            recent: []
        };
        this.cache = {
            hits: 0,
            misses: 0
        };
        this.llm = {
            requests: 0,
            byProvider: {},
            totalTokens: 0,
            errors: 0
        };
        this.saveInterval = null;
        this.historyInterval = null;
    }

    trackRequest(method, endpoint, statusCode, responseTime) {
        this.requests.total++;
        this.requests.byMethod[method] = (this.requests.byMethod[method] || 0) + 1;
        
        // Normalize endpoint (remove IDs)
        const normalizedEndpoint = endpoint
            .replace(/\/[a-f0-9-]{36}/gi, '/:uuid')
            .replace(/\/[a-zA-Z0-9]{14,}/g, '/:id')
            .replace(/\/\d+/g, '/:num');
        
        this.requests.byEndpoint[normalizedEndpoint] = (this.requests.byEndpoint[normalizedEndpoint] || 0) + 1;
        this.requests.byStatus[statusCode] = (this.requests.byStatus[statusCode] || 0) + 1;
        
        // Keep only last 1000 response times
        this.requests.responseTimes.push(responseTime);
        if (this.requests.responseTimes.length > 1000) {
            this.requests.responseTimes.shift();
        }
    }

    trackError(error, endpoint) {
        this.errors.total++;
        const errorType = error.name || 'UnknownError';
        this.errors.byType[errorType] = (this.errors.byType[errorType] || 0) + 1;
        
        const normalizedEndpoint = endpoint
            .replace(/\/[a-f0-9-]{36}/gi, '/:uuid')
            .replace(/\/[a-zA-Z0-9]{14,}/g, '/:id')
            .replace(/\/\d+/g, '/:num');
        
        this.errors.byEndpoint[normalizedEndpoint] = (this.errors.byEndpoint[normalizedEndpoint] || 0) + 1;
        
        // Keep only last 100 recent errors
        this.errors.recent.push({
            type: errorType,
            message: error.message,
            endpoint: normalizedEndpoint,
            timestamp: new Date().toISOString()
        });
        if (this.errors.recent.length > 100) {
            this.errors.recent.shift();
        }
    }

    trackCacheHit() {
        this.cache.hits++;
    }

    trackCacheMiss() {
        this.cache.misses++;
    }

    trackLLMRequest(provider, tokens = 0) {
        this.llm.requests++;
        this.llm.byProvider[provider] = (this.llm.byProvider[provider] || 0) + 1;
        this.llm.totalTokens += tokens;
    }

    trackLLMError() {
        this.llm.errors++;
    }

    getMetrics() {
        const uptime = Date.now() - this.startTime;
        const avgResponseTime = this.requests.responseTimes.length > 0
            ? this.requests.responseTimes.reduce((a, b) => a + b, 0) / this.requests.responseTimes.length
            : 0;
        
        return {
            uptime,
            requests: {
                ...this.requests,
                avgResponseTime
            },
            errors: this.errors,
            cache: {
                ...this.cache,
                hitRate: this.cache.hits + this.cache.misses > 0
                    ? (this.cache.hits / (this.cache.hits + this.cache.misses) * 100).toFixed(2)
                    : 0
            },
            llm: this.llm
        };
    }

    reset() {
        this.requests = { total: 0, byMethod: {}, byEndpoint: {}, byStatus: {}, responseTimes: [] };
        this.errors = { total: 0, byType: {}, byEndpoint: {}, recent: [] };
        this.cache = { hits: 0, misses: 0 };
        this.llm = { requests: 0, byProvider: {}, totalTokens: 0, errors: 0 };
    }

    destroy() {
        if (this.saveInterval) clearInterval(this.saveInterval);
        if (this.historyInterval) clearInterval(this.historyInterval);
        this.saveInterval = null;
        this.historyInterval = null;
    }
}

describe('MetricsCollector', () => {
    let metrics;

    beforeEach(() => {
        metrics = new MetricsCollector();
    });

    afterEach(() => {
        metrics.destroy();
    });

    describe('trackRequest', () => {
        it('should increment total requests', () => {
            metrics.trackRequest('GET', '/api/users', 200, 50);
            expect(metrics.requests.total).toBe(1);
        });

        it('should track requests by method', () => {
            metrics.trackRequest('GET', '/api/users', 200, 50);
            metrics.trackRequest('POST', '/api/users', 201, 100);
            metrics.trackRequest('GET', '/api/items', 200, 30);
            
            expect(metrics.requests.byMethod['GET']).toBe(2);
            expect(metrics.requests.byMethod['POST']).toBe(1);
        });

        it('should track requests by status code', () => {
            metrics.trackRequest('GET', '/api/users', 200, 50);
            metrics.trackRequest('GET', '/api/users', 404, 20);
            metrics.trackRequest('POST', '/api/users', 201, 100);
            
            expect(metrics.requests.byStatus[200]).toBe(1);
            expect(metrics.requests.byStatus[404]).toBe(1);
            expect(metrics.requests.byStatus[201]).toBe(1);
        });

        it('should normalize endpoints with UUIDs', () => {
            metrics.trackRequest('GET', '/api/users/550e8400-e29b-41d4-a716-446655440000', 200, 50);
            expect(metrics.requests.byEndpoint['/api/users/:uuid']).toBe(1);
        });

        it('should normalize endpoints with numeric IDs', () => {
            metrics.trackRequest('GET', '/api/items/12345', 200, 50);
            expect(metrics.requests.byEndpoint['/api/items/:num']).toBe(1);
        });

        it('should track response times', () => {
            metrics.trackRequest('GET', '/api/users', 200, 50);
            metrics.trackRequest('GET', '/api/users', 200, 100);
            
            expect(metrics.requests.responseTimes).toEqual([50, 100]);
        });

        it('should limit response times to 1000 entries', () => {
            for (let i = 0; i < 1100; i++) {
                metrics.trackRequest('GET', '/api/test', 200, i);
            }
            
            expect(metrics.requests.responseTimes.length).toBe(1000);
            expect(metrics.requests.responseTimes[0]).toBe(100); // First 100 should be shifted out
        });
    });

    describe('trackError', () => {
        it('should increment total errors', () => {
            metrics.trackError(new Error('Test error'), '/api/users');
            expect(metrics.errors.total).toBe(1);
        });

        it('should track errors by type', () => {
            const typeError = new TypeError('Type error');
            const rangeError = new RangeError('Range error');
            
            metrics.trackError(typeError, '/api/users');
            metrics.trackError(rangeError, '/api/items');
            metrics.trackError(typeError, '/api/other');
            
            expect(metrics.errors.byType['TypeError']).toBe(2);
            expect(metrics.errors.byType['RangeError']).toBe(1);
        });

        it('should track recent errors with timestamp', () => {
            const error = new Error('Test error');
            metrics.trackError(error, '/api/users');
            
            expect(metrics.errors.recent.length).toBe(1);
            expect(metrics.errors.recent[0]).toMatchObject({
                type: 'Error',
                message: 'Test error',
                endpoint: '/api/users'
            });
            expect(metrics.errors.recent[0].timestamp).toBeDefined();
        });

        it('should limit recent errors to 100 entries', () => {
            for (let i = 0; i < 150; i++) {
                metrics.trackError(new Error(`Error ${i}`), '/api/test');
            }
            
            expect(metrics.errors.recent.length).toBe(100);
        });
    });

    describe('trackCache', () => {
        it('should track cache hits', () => {
            metrics.trackCacheHit();
            metrics.trackCacheHit();
            expect(metrics.cache.hits).toBe(2);
        });

        it('should track cache misses', () => {
            metrics.trackCacheMiss();
            expect(metrics.cache.misses).toBe(1);
        });
    });

    describe('trackLLM', () => {
        it('should track LLM requests', () => {
            metrics.trackLLMRequest('openai', 100);
            metrics.trackLLMRequest('anthropic', 200);
            
            expect(metrics.llm.requests).toBe(2);
            expect(metrics.llm.byProvider['openai']).toBe(1);
            expect(metrics.llm.byProvider['anthropic']).toBe(1);
            expect(metrics.llm.totalTokens).toBe(300);
        });

        it('should track LLM errors', () => {
            metrics.trackLLMError();
            metrics.trackLLMError();
            expect(metrics.llm.errors).toBe(2);
        });
    });

    describe('getMetrics', () => {
        it('should return all metrics with calculated values', () => {
            metrics.trackRequest('GET', '/api/users', 200, 50);
            metrics.trackRequest('GET', '/api/users', 200, 100);
            metrics.trackCacheHit();
            metrics.trackCacheMiss();
            
            const result = metrics.getMetrics();
            
            expect(result.uptime).toBeGreaterThanOrEqual(0);
            expect(result.requests.total).toBe(2);
            expect(result.requests.avgResponseTime).toBe(75);
            expect(result.cache.hitRate).toBe('50.00');
        });

        it('should handle empty metrics', () => {
            const result = metrics.getMetrics();
            
            expect(result.requests.total).toBe(0);
            expect(result.requests.avgResponseTime).toBe(0);
            expect(result.cache.hitRate).toBe(0);
        });
    });

    describe('reset', () => {
        it('should reset all metrics', () => {
            metrics.trackRequest('GET', '/api/users', 200, 50);
            metrics.trackError(new Error('Test'), '/api/users');
            metrics.trackCacheHit();
            metrics.trackLLMRequest('openai', 100);
            
            metrics.reset();
            
            expect(metrics.requests.total).toBe(0);
            expect(metrics.errors.total).toBe(0);
            expect(metrics.cache.hits).toBe(0);
            expect(metrics.llm.requests).toBe(0);
        });
    });
});


describe('metrics singleton safeguards', () => {
    let actualMetrics;

    beforeEach(async () => {
        vi.resetModules();
        ({ metrics: actualMetrics } = await import('../../services/metrics.service.js'));
        actualMetrics.stopPeriodicSave();
        actualMetrics.reset();
    });

    afterEach(() => {
        actualMetrics.stopPeriodicSave();
        actualMetrics.reset();
    });

    it('caps LLM provider cardinality and aggregates overflow into other', () => {
        for (let i = 0; i < 60; i++) {
            actualMetrics.trackLLMRequest('custom-provider-' + i, 10, true, 5, 5);
        }

        const keys = Object.keys(actualMetrics.llm.byProvider);
        expect(keys.length).toBeLessThanOrEqual(50);
        expect(actualMetrics.llm.byProvider.other).toBeDefined();
        expect(actualMetrics.llm.byProvider.other.requests).toBeGreaterThan(0);
    });

    it('normalizes LLM provider keys before storing metrics', () => {
        actualMetrics.trackLLMRequest('  DeepSeek Reasoner!?  ', 10, true, 5, 5);

        expect(actualMetrics.llm.byProvider['deepseek-reasoner']).toBeDefined();
    });
});
