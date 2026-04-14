/**
 * Tests for Rate Limit Middleware
 * Tests userRateLimit, combinedRateLimit, and cleanup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeLog } from '../../utils/logger.backend.js';

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
    globalLimiter,
    authLimiter,
    userRateLimit,
    combinedRateLimit,
    cleanupRateLimitStore,
    __rateLimitTestUtils
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
        delete process.env.E2E_RELAX_RATE_LIMITING;
        delete process.env.E2E_QUIET_EXPECTED_WARNINGS;
        cleanupRateLimitStore();
    });

    describe('authLimiter', () => {
        it('should suppress expected auth rate-limit warnings when e2e quiet mode is enabled', () => {
            process.env.E2E_QUIET_EXPECTED_WARNINGS = 'true';
            const { req, res } = mockReqRes();
            req.rateLimit = { resetTime: 1000 };

            authLimiter._options.handler(req, res);

            expect(safeLog).not.toHaveBeenCalledWith('warn', 'Auth rate limit exceeded', expect.anything());
            expect(res.status).toHaveBeenCalledWith(429);
        });
    });

    describe('globalLimiter', () => {
        it('should skip auth routes because they have a dedicated auth limiter', () => {
            const { req } = mockReqRes({}, { path: '/auth/signin' });

            expect(globalLimiter._options.skip(req)).toBe(true);
        });

        it('should give authenticated sessions a much higher global allowance', () => {
            const { req } = mockReqRes({}, {
                cookies: {
                    accessToken: 'access-token'
                }
            });

            expect(__rateLimitTestUtils.getGlobalRateLimitMax(req)).toBe(2000);
            expect(globalLimiter._options.max(req)).toBe(2000);
        });

        it('should keep the baseline global allowance for anonymous traffic', () => {
            const { req } = mockReqRes({}, { cookies: {} });

            expect(__rateLimitTestUtils.getGlobalRateLimitMax(req)).toBe(200);
            expect(globalLimiter._options.max(req)).toBe(200);
        });
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

        it('should skip user rate limiting when E2E relaxation is enabled', () => {
            process.env.E2E_RELAX_RATE_LIMITING = 'true';
            const mw = userRateLimit(1, 60000);
            const { req, res, next } = mockReqRes();

            for (let i = 0; i < 3; i++) {
                mw(req, res, next);
            }

            expect(next).toHaveBeenCalledTimes(3);
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should allow requests under limit', () => {
            const mw = userRateLimit(100, 60000);
            const { req, res, next } = mockReqRes();

            mw(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 500);
        });

        it('should give authenticated users a 5x uplift', () => {
            const mw = userRateLimit(10, 60000);
            const { req, res, next } = mockReqRes({ role: 'user' });

            mw(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 50);
        });

        it('should give admins 15x the baseline limit', () => {
            const mw = userRateLimit(10, 60000);
            const { req, res, next } = mockReqRes({ role: 'admin' });

            mw(req, res, next);

            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 150);
        });

        it('should give local admins and superadmins the same elevated limit', () => {
            const mw = userRateLimit(10, 60000);
            const localAdmin = mockReqRes({ role: 'localAdmin' });
            const superAdmin = mockReqRes({ role: 'superadmin' });

            mw(localAdmin.req, localAdmin.res, localAdmin.next);
            mw(superAdmin.req, superAdmin.res, superAdmin.next);

            expect(localAdmin.res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 150);
            expect(superAdmin.res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 150);
        });

        it('should block requests over limit', () => {
            const mw = userRateLimit(2, 60000);

            for (let i = 0; i < 11; i++) {
                const { req, res, next } = mockReqRes();
                mw(req, res, next);

                if (i < 10) {
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

        it('should skip combined rate limiting when E2E relaxation is enabled', () => {
            process.env.E2E_RELAX_RATE_LIMITING = 'true';
            const mw = combinedRateLimit(1, 60000);
            const { req, res, next } = mockReqRes();

            for (let i = 0; i < 3; i++) {
                mw(req, res, next);
            }

            expect(next).toHaveBeenCalledTimes(3);
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('cleanupRateLimitStore', () => {
        it('should not throw', () => {
            expect(() => cleanupRateLimitStore()).not.toThrow();
        });
    });
});
