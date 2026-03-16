/**
 * Tests for apiInterceptor utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    SessionRedirectError,
    isSessionRedirectError,
    setSessionExpiredHandler,
    resetSessionState,
    clearCsrfToken,
} from './apiInterceptor';

// Mock logger
vi.mock('./logger.frontend', () => ({
    default: {
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

describe('apiInterceptor', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        resetSessionState();
    });

    describe('SessionRedirectError', () => {
        it('should create error with correct name', () => {
            const error = new SessionRedirectError();
            expect(error.name).toBe('SessionRedirectError');
            expect(error.message).toBe('Session expired - redirecting to login');
        });

        it('should be an instance of Error', () => {
            const error = new SessionRedirectError();
            expect(error).toBeInstanceOf(Error);
        });
    });

    describe('isSessionRedirectError', () => {
        it('should return true for SessionRedirectError instance', () => {
            const error = new SessionRedirectError();
            expect(isSessionRedirectError(error)).toBe(true);
        });

        it('should return true for error with SessionRedirectError name', () => {
            const error = new Error('test');
            error.name = 'SessionRedirectError';
            expect(isSessionRedirectError(error)).toBe(true);
        });

        it('should return false for regular error', () => {
            const error = new Error('regular error');
            expect(isSessionRedirectError(error)).toBe(false);
        });

        it('should return false for non-error values', () => {
            expect(isSessionRedirectError(null)).toBe(false);
            expect(isSessionRedirectError(undefined)).toBe(false);
            expect(isSessionRedirectError('string')).toBe(false);
            expect(isSessionRedirectError(42)).toBe(false);
        });
    });

    describe('setSessionExpiredHandler', () => {
        it('should accept a callback function', () => {
            const handler = vi.fn();
            expect(() => setSessionExpiredHandler(handler)).not.toThrow();
        });

        it('should accept null to clear handler', () => {
            expect(() => setSessionExpiredHandler(null as unknown as () => void)).not.toThrow();
        });
    });

    describe('resetSessionState', () => {
        it('should not throw when called', () => {
            expect(() => resetSessionState()).not.toThrow();
        });

        it('should be callable multiple times', () => {
            resetSessionState();
            resetSessionState();
            expect(true).toBe(true);
        });
    });

    describe('clearCsrfToken', () => {
        it('should not throw when called', () => {
            expect(() => clearCsrfToken()).not.toThrow();
        });
    });
});
