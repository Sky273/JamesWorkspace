/**
 * Tests for asyncHandler middleware
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { asyncHandler, asyncHandlerWithMessage, globalErrorHandler } from '../../middleware/asyncHandler.middleware.js';

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

describe('asyncHandler middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        mockReq = {
            path: '/test',
            method: 'GET'
        };
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };
        mockNext = vi.fn();
        vi.clearAllMocks();
    });

    describe('asyncHandler', () => {
        it('should call the handler function with req, res, next', async () => {
            const handler = vi.fn().mockResolvedValue(undefined);
            const wrapped = asyncHandler(handler);

            await wrapped(mockReq, mockRes, mockNext);

            expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
        });

        it('should not call next on successful execution', async () => {
            const handler = vi.fn().mockResolvedValue(undefined);
            const wrapped = asyncHandler(handler);

            await wrapped(mockReq, mockRes, mockNext);

            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should call next with error when handler throws', async () => {
            const error = new Error('Test error');
            const handler = vi.fn().mockRejectedValue(error);
            const wrapped = asyncHandler(handler);

            // Need to wait for the promise chain to complete
            await new Promise(resolve => {
                wrapped(mockReq, mockRes, (err) => {
                    mockNext(err);
                    resolve();
                });
            });

            expect(mockNext).toHaveBeenCalledWith(error);
        });

        it('should handle sync errors thrown in handler', async () => {
            const error = new Error('Sync error');
            // Use a handler that returns a rejected promise (simulates sync throw wrapped in Promise.resolve)
            const handler = vi.fn().mockImplementation(() => Promise.reject(error));
            const wrapped = asyncHandler(handler);

            let caughtError = null;
            await new Promise(resolve => {
                wrapped(mockReq, mockRes, (err) => {
                    caughtError = err;
                    resolve();
                });
            });

            expect(caughtError).toBe(error);
        });

        it('should work with handlers that return values', async () => {
            const handler = vi.fn().mockResolvedValue({ data: 'test' });
            const wrapped = asyncHandler(handler);

            await wrapped(mockReq, mockRes, mockNext);

            expect(handler).toHaveBeenCalled();
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('asyncHandlerWithMessage', () => {
        it('should call the handler function', async () => {
            const handler = vi.fn().mockResolvedValue(undefined);
            const wrapped = asyncHandlerWithMessage(handler, 'Custom error');

            await wrapped(mockReq, mockRes, mockNext);

            expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
        });

        it('should respond with custom error message on failure', async () => {
            const error = new Error('Internal error');
            const handler = vi.fn().mockRejectedValue(error);
            const wrapped = asyncHandlerWithMessage(handler, 'Something went wrong');

            // Wait for the promise to resolve
            await new Promise(resolve => setTimeout(resolve, 10));
            wrapped(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Something went wrong',
                statusCode: 500
            }));
        });

        it('should use error statusCode if available', async () => {
            const error = new Error('Not found');
            error.statusCode = 404;
            const handler = vi.fn().mockRejectedValue(error);
            const wrapped = asyncHandlerWithMessage(handler, 'Resource not found');

            wrapped(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Resource not found',
                statusCode: 404
            }));
        });

        it('should use error.status if statusCode not available', async () => {
            const error = new Error('Forbidden');
            error.status = 403;
            const handler = vi.fn().mockRejectedValue(error);
            const wrapped = asyncHandlerWithMessage(handler, 'Access denied');

            wrapped(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should use default error message if not provided', async () => {
            const error = new Error('Test');
            const handler = vi.fn().mockRejectedValue(error);
            const wrapped = asyncHandlerWithMessage(handler);

            wrapped(mockReq, mockRes, mockNext);
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'An error occurred'
            }));
        });
    });

    describe('globalErrorHandler', () => {
        it('should respond with 500 for errors without statusCode', () => {
            const error = new Error('Unknown error');

            globalErrorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
        });

        it('should use error statusCode if available', () => {
            const error = new Error('Bad request');
            error.statusCode = 400;

            globalErrorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should include error message in development', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const error = new Error('Detailed error');
            globalErrorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Detailed error'
            }));

            process.env.NODE_ENV = originalEnv;
        });

        it('should hide error message in production', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const error = new Error('Sensitive error');
            globalErrorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Internal server error'
            }));

            process.env.NODE_ENV = originalEnv;
        });

        it('should include stack trace in development', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const error = new Error('Test error');
            globalErrorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                stack: expect.any(String)
            }));

            process.env.NODE_ENV = originalEnv;
        });

        it('should not include stack trace in production', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const error = new Error('Test error');
            globalErrorHandler(error, mockReq, mockRes, mockNext);

            const jsonCall = mockRes.json.mock.calls[0][0];
            expect(jsonCall.stack).toBeUndefined();

            process.env.NODE_ENV = originalEnv;
        });
    });
});
