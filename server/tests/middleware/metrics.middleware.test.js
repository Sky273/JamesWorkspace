/**
 * Tests for Metrics Middleware
 * Tests request/response tracking and error detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/metrics.service.js', () => ({
    metrics: {
        trackRequest: vi.fn(),
        trackResponse: vi.fn(),
        trackError: vi.fn()
    }
}));

import { metrics } from '../../services/metrics.service.js';
import { metricsMiddleware } from '../../middleware/metrics.middleware.js';

function createMockReqRes(statusCode = 200) {
    const listeners = {};
    const res = {
        statusCode,
        on: vi.fn((event, handler) => { listeners[event] = handler; }),
        removeListener: vi.fn()
    };
    const req = { method: 'GET', path: '/api/test' };
    return { req, res, next: vi.fn(), emit: (event) => listeners[event]?.() };
}

describe('Metrics Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call next()', () => {
        const { req, res, next } = createMockReqRes();

        metricsMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('should track request on invocation', () => {
        const { req, res, next } = createMockReqRes();

        metricsMiddleware(req, res, next);

        expect(metrics.trackRequest).toHaveBeenCalledWith('GET', '/api/test');
    });

    it('should track response on finish', () => {
        const { req, res, next, emit } = createMockReqRes(200);

        metricsMiddleware(req, res, next);
        emit('finish');

        expect(metrics.trackResponse).toHaveBeenCalledWith(200, expect.any(Number));
    });

    it('should track errors for 4xx status codes', () => {
        const { req, res, next, emit } = createMockReqRes(404);

        metricsMiddleware(req, res, next);
        emit('finish');

        expect(metrics.trackError).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'HTTP404Error' }),
            '/api/test'
        );
    });

    it('should track errors for 5xx status codes', () => {
        const { req, res, next, emit } = createMockReqRes(500);

        metricsMiddleware(req, res, next);
        emit('finish');

        expect(metrics.trackError).toHaveBeenCalled();
    });

    it('should not track errors for 2xx status codes', () => {
        const { req, res, next, emit } = createMockReqRes(200);

        metricsMiddleware(req, res, next);
        emit('finish');

        expect(metrics.trackError).not.toHaveBeenCalled();
    });

    it('should remove finish listener after firing', () => {
        const { req, res, next, emit } = createMockReqRes(200);

        metricsMiddleware(req, res, next);
        emit('finish');

        expect(res.removeListener).toHaveBeenCalledWith('finish', expect.any(Function));
    });
});
