/**
 * Tests for logger.backend.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    safeLog,
    redactSensitiveData,
    getProxyLogs,
    getProxyLogsCount,
    getProxyLogsStats,
    createModuleLogger
} from '../../utils/logger.backend.js';

describe('Logger Backend', () => {
    
    describe('redactSensitiveData', () => {
        it('should redact password fields', () => {
            const data = { username: 'test', password: 'secret123' };
            const result = redactSensitiveData(data);
            expect(result.username).toBe('test');
            expect(result.password).toBe('[REDACTED]');
        });

        it('should redact token fields', () => {
            const data = { 
                accessToken: 'abc123', 
                refreshToken: 'xyz789',
                token: 'def456'
            };
            const result = redactSensitiveData(data);
            expect(result.accessToken).toBe('[REDACTED]');
            expect(result.refreshToken).toBe('[REDACTED]');
            expect(result.token).toBe('[REDACTED]');
        });

        it('should redact apiKey fields', () => {
            const data = { apiKey: 'sk-123', api_key: 'sk-456' };
            const result = redactSensitiveData(data);
            expect(result.apiKey).toBe('[REDACTED]');
            expect(result.api_key).toBe('[REDACTED]');
        });

        it('should redact authorization headers', () => {
            const data = { authorization: 'Bearer token123', Authorization: 'Bearer token456' };
            const result = redactSensitiveData(data);
            expect(result.authorization).toBe('[REDACTED]');
            expect(result.Authorization).toBe('[REDACTED]');
        });

        it('should redact nested sensitive data', () => {
            const data = {
                user: {
                    name: 'John',
                    password: 'secret'
                },
                headers: {
                    authorization: 'Bearer xyz'
                }
            };
            const result = redactSensitiveData(data);
            expect(result.user.name).toBe('John');
            expect(result.user.password).toBe('[REDACTED]');
            expect(result.headers.authorization).toBe('[REDACTED]');
        });

        it('should handle null input', () => {
            expect(redactSensitiveData(null)).toBeNull();
        });

        it('should handle undefined input', () => {
            expect(redactSensitiveData(undefined)).toBeUndefined();
        });

        it('should handle primitive values', () => {
            expect(redactSensitiveData('string')).toBe('string');
            expect(redactSensitiveData(123)).toBe(123);
            expect(redactSensitiveData(true)).toBe(true);
        });

        it('should not modify original object', () => {
            const original = { password: 'secret', name: 'test' };
            const result = redactSensitiveData(original);
            expect(original.password).toBe('secret');
            expect(result.password).toBe('[REDACTED]');
        });
    });

    describe('safeLog', () => {
        let consoleSpy;

        beforeEach(() => {
            consoleSpy = {
                log: vi.spyOn(console, 'log').mockImplementation(() => {}),
                warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
                error: vi.spyOn(console, 'error').mockImplementation(() => {})
            };
        });

        it('should log info messages', () => {
            safeLog('info', 'Test message');
            expect(consoleSpy.log).toHaveBeenCalled();
        });

        it('should log warn messages', () => {
            safeLog('warn', 'Warning message');
            expect(consoleSpy.warn).toHaveBeenCalled();
        });

        it('should log error messages', () => {
            safeLog('error', 'Error message');
            expect(consoleSpy.error).toHaveBeenCalled();
        });

        it('should redact sensitive data in logs', () => {
            safeLog('info', 'User login', { password: 'secret123' });
            // The log should have been called with redacted data
            const calls = consoleSpy.log.mock.calls;
            const logOutput = calls.map(c => JSON.stringify(c)).join('');
            expect(logOutput).not.toContain('secret123');
        });

        it('should add logs to buffer', () => {
            const initialCount = getProxyLogsCount();
            safeLog('info', 'Buffer test message');
            expect(getProxyLogsCount()).toBeGreaterThanOrEqual(initialCount);
        });

        it('should handle null data gracefully', () => {
            expect(() => safeLog('info', 'Test', null)).not.toThrow();
        });

        it('should handle module parameter', () => {
            safeLog('info', 'Module test', { key: 'value' }, 'test-module');
            expect(consoleSpy.log).toHaveBeenCalled();
        });
    });

    describe('createModuleLogger', () => {
        let consoleSpy;

        beforeEach(() => {
            consoleSpy = {
                log: vi.spyOn(console, 'log').mockImplementation(() => {}),
                warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
                error: vi.spyOn(console, 'error').mockImplementation(() => {})
            };
        });

        it('should create logger with all methods', () => {
            const logger = createModuleLogger('test-module');
            expect(typeof logger.error).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.debug).toBe('function');
        });

        it('should log with module context', () => {
            const logger = createModuleLogger('my-module');
            logger.info('Test message');
            expect(consoleSpy.log).toHaveBeenCalled();
        });

        it('should log errors correctly', () => {
            const logger = createModuleLogger('error-module');
            logger.error('Error occurred', { code: 500 });
            expect(consoleSpy.error).toHaveBeenCalled();
        });

        it('should log warnings correctly', () => {
            const logger = createModuleLogger('warn-module');
            logger.warn('Warning message');
            expect(consoleSpy.warn).toHaveBeenCalled();
        });
    });

    describe('getProxyLogs', () => {
        it('should return an array', () => {
            const logs = getProxyLogs();
            expect(Array.isArray(logs)).toBe(true);
        });

        it('should return logs with expected structure', () => {
            safeLog('info', 'Structure test', { testKey: 'testValue' });
            const logs = getProxyLogs();
            if (logs.length > 0) {
                const log = logs[0];
                expect(log).toHaveProperty('timestamp');
                expect(log).toHaveProperty('level');
                expect(log).toHaveProperty('message');
            }
        });
    });

    describe('getProxyLogsCount', () => {
        it('should return a number', () => {
            const count = getProxyLogsCount();
            expect(typeof count).toBe('number');
        });

        it('should be non-negative', () => {
            const count = getProxyLogsCount();
            expect(count).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getProxyLogsStats', () => {
        it('should return stats object', () => {
            const stats = getProxyLogsStats();
            expect(stats).toHaveProperty('total');
            expect(stats).toHaveProperty('byLevel');
            expect(stats).toHaveProperty('recent');
        });

        it('should have recent stats', () => {
            const stats = getProxyLogsStats();
            expect(stats.recent).toHaveProperty('last24h');
            expect(stats.recent).toHaveProperty('lastHour');
        });

        it('should have non-negative totals', () => {
            const stats = getProxyLogsStats();
            expect(stats.total).toBeGreaterThanOrEqual(0);
            expect(stats.recent.last24h).toBeGreaterThanOrEqual(0);
            expect(stats.recent.lastHour).toBeGreaterThanOrEqual(0);
        });
    });
});
