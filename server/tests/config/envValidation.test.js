/**
 * Tests for config/envValidation.js
 * validateEnvironment, getEnvironmentInfo
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({ safeLog: vi.fn() }));

import { validateEnvironment, getEnvironmentInfo } from '../../config/envValidation.js';

describe('envValidation', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Set all required vars to valid values
        process.env.JWT_SECRET = 'a'.repeat(32);
        process.env.REFRESH_TOKEN_SECRET = 'b'.repeat(32);
        process.env.POSTGRES_HOST = 'localhost';
        process.env.POSTGRES_DB = 'testdb';
        process.env.POSTGRES_USER = 'user';
        process.env.POSTGRES_PASSWORD = 'pass';
        process.env.CSRF_SECRET = 'c'.repeat(32);
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('validateEnvironment', () => {
        it('should pass when all required vars are set', () => {
            const result = validateEnvironment();
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should report error for missing required var', () => {
            delete process.env.JWT_SECRET;
            const result = validateEnvironment();
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('JWT_SECRET'))).toBe(true);
        });

        it('should report error for short JWT_SECRET', () => {
            process.env.JWT_SECRET = 'short';
            const result = validateEnvironment();
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('JWT_SECRET') && e.includes('32'))).toBe(true);
        });

        it('should report warning for missing recommended vars', () => {
            delete process.env.OPENAI_API_KEY;
            delete process.env.NODE_ENV;
            const result = validateEnvironment();
            expect(result.warnings.some(w => w.includes('OPENAI_API_KEY'))).toBe(true);
        });

        it('should allow REFRESH_TOKEN_SECRET to fall back to JWT_SECRET with a warning', () => {
            delete process.env.REFRESH_TOKEN_SECRET;
            const result = validateEnvironment();
            expect(result.valid).toBe(true);
            expect(result.warnings.some(w => w.includes('REFRESH_TOKEN_SECRET'))).toBe(true);
        });

        it('should report multiple errors for multiple missing vars', () => {
            delete process.env.JWT_SECRET;
            delete process.env.POSTGRES_HOST;
            delete process.env.CSRF_SECRET;
            const result = validateEnvironment();
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('getEnvironmentInfo', () => {
        it('should return redacted environment info', () => {
            process.env.OPENAI_API_KEY = 'sk-test';
            const info = getEnvironmentInfo();
            expect(info.nodeVersion).toBeDefined();
            expect(info.platform).toBeDefined();
            expect(info.hasJwtSecret).toBe(true);
            expect(info.hasOpenAI).toBe(true);
            // Should not contain actual secret values
            expect(JSON.stringify(info)).not.toContain('a'.repeat(32));
        });

        it('should reflect missing keys', () => {
            delete process.env.OPENAI_API_KEY;
            delete process.env.ANTHROPIC_API_KEY;
            delete process.env.DEEPSEEK_API_KEY;
            delete process.env.GLM_API_KEY;
            const info = getEnvironmentInfo();
            expect(info.hasOpenAI).toBe(false);
            expect(info.hasAnthropic).toBe(false);
            expect(info.hasDeepSeek).toBe(false);
            expect(info.hasGlm).toBe(false);
        });
    });
});
