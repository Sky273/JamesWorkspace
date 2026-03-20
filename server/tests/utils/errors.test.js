/**
 * Tests for error handling utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { sendError, AppError, ValidationError, NotFoundError, sanitizeErrorMessage } from '../../utils/errors.js';

describe('Error Handling Utilities', () => {
    let mockRes;

    beforeEach(() => {
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };
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
