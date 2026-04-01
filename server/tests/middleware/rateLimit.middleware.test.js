/**
 * Tests for Rate Limit Middleware
 * Tests userRateLimit, combinedRateLimit, and cleanup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('express-rate-limit', () => ({
    default: vi.fn((opts) => {
        const mw = (req, res, next) => next();
        mw._options = opts;
        return mw;
    })
}));

vi.mock('../../config/constants.js', () => ({
    RATE_LIMIT: {
        GLOBAL: { windowMs: 60000, max: 200 },
        AUTH: { windowMs: 900000, max: 10 },
        USER: { windowMs: 60000, max: 60 }
    }
}));

import {
    userRateLimit,
    combinedRateLimit,
    cleanupRateLimitStore
} from '../../middleware/rateLimit.middleware.js';

function mockReqRes(userOverrides = {}, reqOverrides = {}) {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn()
    };
    const req = {
        user: { id: 'u1', role: 'user', email: 'u@t.com', ...userOverrides },
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        headers: {},
        connection: { remoteAddress: '127.0.0.1' },
        ...reqOverrides
    };
    return { req, res, next: vi.fn() };
}

describe('Rate Limit Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cleanupRateLimitStore();
    });

    describe('userRateLimit', () => {
        it('should call next for unauthenticated requests', () => {
            const mw = userRateLimit();
            const { req, res, next } = mockReqRes();
            req.user = null;

            mw(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should allow requests under limit', () => {
            const mw = userRateLimit(100, 60000);
            const { req, res, next } = mockReqRes();

            mw(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
        });

        it('should give admins 3x the limit', () => {
            const mw = userRateLimit(10, 60000);
            const { req, res, next } = mockReqRes({ role: 'admin' });

            mw(req, res, next);

            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 30);
        });

        it('should block requests over limit', () => {
            const mw = userRateLimit(2, 60000);

            for (let i = 0; i < 3; i++) {
                const { req, res, next } = mockReqRes();
                mw(req, res, next);

                if (i < 2) {
                    expect(next).toHaveBeenCalledTimes(1);
                    expect(res.status).not.toHaveBeenCalled();
                } else {
                    expect(res.status).toHaveBeenCalledWith(429);
                    expect(res.json).toHaveBeenCalled();
                }
            }
        });
    });

    describe('combinedRateLimit', () => {
        it('should allow requests under limit', () => {
            const mw = combinedRateLimit(100, 60000);
            const { req, res, next } = mockReqRes();

            mw(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
        });

        it('should block requests over limit', () => {
            const mw = combinedRateLimit(2, 60000);

            for (let i = 0; i < 3; i++) {
                const { req, res, next } = mockReqRes();
                mw(req, res, next);

                if (i < 2) {
                    expect(next).toHaveBeenCalledTimes(1);
                    expect(res.status).not.toHaveBeenCalled();
                } else {
                    expect(res.status).toHaveBeenCalledWith(429);
                }
            }
        });

        it('should handle anonymous users', () => {
            const mw = combinedRateLimit(100, 60000);
            const { req, res, next } = mockReqRes();
            req.user = undefined;

            mw(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('cleanupRateLimitStore', () => {
        it('should not throw', () => {
            expect(() => cleanupRateLimitStore()).not.toThrow();
        });
    });
});
