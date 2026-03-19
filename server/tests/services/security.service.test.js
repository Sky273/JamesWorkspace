/**
 * Tests for Security Service
 * Tests circular buffer logging, log levels, events, and request metadata
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    createModuleLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    })),
    safeLog: vi.fn()
}));

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(() => true),
        mkdirSync: vi.fn(),
        appendFileSync: vi.fn(),
        statSync: vi.fn(() => ({ size: 0 })),
        renameSync: vi.fn(),
        unlinkSync: vi.fn()
    }
}));

import {
    LOG_LEVELS,
    SECURITY_EVENTS,
    getSecurityLogs,
    getSecurityLogsCount,
    securityLog,
    getRequestMetadata
} from '../../services/security.service.js';

describe('Security Service', () => {
    describe('LOG_LEVELS', () => {
        it('should define standard log levels', () => {
            expect(LOG_LEVELS.INFO).toBe('INFO');
            expect(LOG_LEVELS.WARNING).toBe('WARNING');
            expect(LOG_LEVELS.ERROR).toBe('ERROR');
            expect(LOG_LEVELS.SECURITY).toBe('SECURITY');
        });
    });

    describe('SECURITY_EVENTS', () => {
        it('should define security event types', () => {
            expect(SECURITY_EVENTS.AUTH_SUCCESS).toBe('AUTH_SUCCESS');
            expect(SECURITY_EVENTS.AUTH_FAILURE).toBe('AUTH_FAILURE');
            expect(SECURITY_EVENTS.RATE_LIMIT_HIT).toBe('RATE_LIMIT_HIT');
            expect(SECURITY_EVENTS.SUSPICIOUS_ACTIVITY).toBe('SUSPICIOUS_ACTIVITY');
        });
    });

    describe('securityLog', () => {
        it('should add log entry to buffer', () => {
            const countBefore = getSecurityLogsCount();

            securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.AUTH_SUCCESS, {
                ip: '127.0.0.1', email: 'test@test.com'
            });

            expect(getSecurityLogsCount()).toBe(countBefore + 1);
        });

        it('should include only non-null fields', () => {
            securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.AUTH_SUCCESS, {
                ip: '1.2.3.4', email: 'a@b.com'
            });

            const logs = getSecurityLogs();
            const latest = logs[0];
            expect(latest.ip).toBe('1.2.3.4');
            expect(latest.email).toBe('a@b.com');
            expect(latest.customer).toBeUndefined(); // not provided
        });
    });

    describe('getSecurityLogs', () => {
        it('should return logs in newest-first order', () => {
            securityLog(LOG_LEVELS.INFO, 'EVT_A', { ip: '1.1.1.1' });
            securityLog(LOG_LEVELS.INFO, 'EVT_B', { ip: '2.2.2.2' });

            const logs = getSecurityLogs();
            // Most recent should be first
            expect(logs[0].event).toBe('EVT_B');
        });
    });

    describe('getRequestMetadata', () => {
        it('should extract metadata from request', () => {
            const req = {
                ip: '10.0.0.1',
                path: '/api/test',
                method: 'GET',
                get: vi.fn(() => 'Mozilla/5.0'),
                user: { id: 'u1', email: 'admin@test.com' },
                connection: { remoteAddress: '10.0.0.1' }
            };

            const meta = getRequestMetadata(req);

            expect(meta.ip).toBe('10.0.0.1');
            expect(meta.endpoint).toBe('/api/test');
            expect(meta.method).toBe('GET');
            expect(meta.userId).toBe('u1');
        });

        it('should handle missing user', () => {
            const req = {
                ip: '10.0.0.1',
                path: '/api/test',
                method: 'POST',
                get: vi.fn(() => null),
                connection: { remoteAddress: '10.0.0.1' }
            };

            const meta = getRequestMetadata(req);

            expect(meta.userId).toBeNull();
            expect(meta.email).toBeNull();
        });
    });
});
