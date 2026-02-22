/**
 * Tests for error handling utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { handleAirtableError, sendError, AppError, ValidationError, NotFoundError, sanitizeErrorMessage } from '../../utils/errors.js';

describe('Error Handling Utilities', () => {
    let mockRes;

    beforeEach(() => {
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };
    });

    describe('handleAirtableError', () => {
        it('should handle 404 NOT_FOUND errors', () => {
            const error = { statusCode: 404, message: 'NOT_FOUND' };
            handleAirtableError(error, mockRes, 'fetch');
            
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Resource not found'
            }));
        });

        it('should handle 403 FORBIDDEN errors', () => {
            const error = { statusCode: 403, message: 'FORBIDDEN' };
            handleAirtableError(error, mockRes, 'update');
            
            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Access denied'
            }));
        });

        it('should handle 429 RATE_LIMIT errors', () => {
            const error = { statusCode: 429, message: 'RATE_LIMIT' };
            handleAirtableError(error, mockRes, 'query');
            
            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Rate limit exceeded',
                retryAfter: 60
            }));
        });

        it('should handle 422 INVALID_REQUEST errors', () => {
            const error = { statusCode: 422, message: 'INVALID_REQUEST' };
            handleAirtableError(error, mockRes, 'create');
            
            expect(mockRes.status).toHaveBeenCalledWith(422);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Invalid request'
            }));
        });

        it('should handle 503 SERVICE_UNAVAILABLE errors', () => {
            const error = { statusCode: 503, message: 'SERVICE_UNAVAILABLE' };
            handleAirtableError(error, mockRes, 'sync');
            
            expect(mockRes.status).toHaveBeenCalledWith(503);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Service unavailable'
            }));
        });

        it('should handle timeout errors (ECONNABORTED)', () => {
            const error = { code: 'ECONNABORTED', message: 'timeout' };
            handleAirtableError(error, mockRes, 'request');
            
            expect(mockRes.status).toHaveBeenCalledWith(504);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Request timeout'
            }));
        });

        it('should handle timeout errors (ETIMEDOUT)', () => {
            const error = { code: 'ETIMEDOUT', message: 'timeout' };
            handleAirtableError(error, mockRes, 'request');
            
            expect(mockRes.status).toHaveBeenCalledWith(504);
        });

        it('should handle generic errors with 500', () => {
            const error = { message: 'Unknown error' };
            handleAirtableError(error, mockRes, 'operation');
            
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Internal server error'
            }));
        });
    });

    describe('sendError', () => {
        it('should send error with status code and message', () => {
            sendError(mockRes, 400, 'Bad request');
            
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Bad request'
            }));
        });

        it('should include details when provided in development', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            
            sendError(mockRes, 400, 'Validation failed', { field: 'email' });
            
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Validation failed',
                details: { field: 'email' }
            }));
            
            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('AppError', () => {
        it('should create an error with statusCode', () => {
            const error = new AppError('Not found', 404);
            
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('Not found');
            expect(error.statusCode).toBe(404);
            expect(error.isOperational).toBe(true);
        });

        it('should default to 500 status code', () => {
            const error = new AppError('Server error');
            
            expect(error.statusCode).toBe(500);
        });
    });

    describe('ValidationError', () => {
        it('should create a validation error with details', () => {
            const error = new ValidationError('Invalid input', { field: 'email' });
            
            expect(error.statusCode).toBe(400);
            expect(error.details).toEqual({ field: 'email' });
            expect(error.isOperational).toBe(true);
        });
    });

    describe('NotFoundError', () => {
        it('should create a not found error', () => {
            const error = new NotFoundError('User');
            
            expect(error.statusCode).toBe(404);
            expect(error.message).toBe('User not found');
        });

        it('should use default resource name', () => {
            const error = new NotFoundError();
            
            expect(error.message).toBe('Resource not found');
        });
    });

    describe('sanitizeErrorMessage', () => {
        it('should return fallback for dangerous patterns', () => {
            const error = new Error('connect ECONNREFUSED 127.0.0.1:5432');
            const result = sanitizeErrorMessage(error, 'Connection failed');
            
            expect(result).toBe('Connection failed');
        });

        it('should return fallback for stack traces', () => {
            const error = new Error('Error at Object.test (/path/to/file.js:10:5)');
            const result = sanitizeErrorMessage(error, 'An error occurred');
            
            expect(result).toBe('An error occurred');
        });

        it('should return original message if safe', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            
            const error = new Error('User not found');
            const result = sanitizeErrorMessage(error, 'An error occurred');
            
            expect(result).toBe('User not found');
            
            process.env.NODE_ENV = originalEnv;
        });

        it('should return fallback for null error', () => {
            const result = sanitizeErrorMessage(null, 'Default message');
            
            expect(result).toBe('Default message');
        });
    });
});
