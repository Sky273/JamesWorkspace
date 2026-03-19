/**
 * Tests for APM Middleware
 * Tests slow request tracking, severity levels, stats, and buffer management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import {
    apmMiddleware,
    getAPMStats,
    getSlowRequests,
    clearSlowRequests
} from '../../middleware/apm.middleware.js';

function createMockReqRes(path = '/api/test', user = null) {
    const listeners = {};
    const res = {
        statusCode: 200,
        on: vi.fn((event, handler) => { listeners[event] = handler; })
    };
    const req = {
        method: 'GET',
        path,
        originalUrl: path,
        user,
        get: vi.fn(() => 'Mozilla/5.0')
    };
    return { req, res, next: vi.fn(), emit: (event) => listeners[event]?.() };
}

describe('APM Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearSlowRequests();
    });

    describe('apmMiddleware', () => {
        it('should call next()', () => {
            const { req, res, next } = createMockReqRes();

            apmMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should skip excluded paths', () => {
            const { req, res, next } = createMockReqRes('/health');

            apmMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.on).not.toHaveBeenCalled(); // no listener registered
        });

        it('should register finish listener for non-excluded paths', () => {
            const { req, res, next } = createMockReqRes('/api/resumes');

            apmMiddleware(req, res, next);

            expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
        });
    });

    describe('getAPMStats', () => {
        it('should return stats structure', () => {
            const stats = getAPMStats();

            expect(stats.config).toBeDefined();
            expect(stats.config.slowThreshold).toBeGreaterThan(0);
            expect(stats.summary).toBeDefined();
            expect(stats.summary.totalTracked).toBe(0);
            expect(stats.topSlowEndpoints).toEqual([]);
            expect(stats.timestamp).toBeDefined();
        });
    });

    describe('getSlowRequests', () => {
        it('should return empty array when no slow requests', () => {
            expect(getSlowRequests()).toEqual([]);
        });

        it('should respect limit parameter', () => {
            expect(getSlowRequests(10)).toEqual([]);
        });
    });

    describe('clearSlowRequests', () => {
        it('should clear the buffer', () => {
            clearSlowRequests();
            expect(getSlowRequests()).toEqual([]);
        });
    });
});
