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

vi.mock('fs/promises', () => ({
    default: {
        mkdir: vi.fn(() => Promise.resolve()),
        appendFile: vi.fn(() => Promise.resolve()),
        stat: vi.fn(() => Promise.resolve({ size: 0 })),
        rename: vi.fn(() => Promise.resolve()),
        unlink: vi.fn(() => Promise.resolve())
    },
    mkdir: vi.fn(() => Promise.resolve()),
    appendFile: vi.fn(() => Promise.resolve()),
    stat: vi.fn(() => Promise.resolve({ size: 0 })),
    rename: vi.fn(() => Promise.resolve()),
    unlink: vi.fn(() => Promise.resolve())
}));

import fsPromises from 'fs/promises';
import {
    LOG_LEVELS,
    SECURITY_EVENTS,
    flushSecurityLogPersistenceForTests,
    getSecurityLogs,
    getSecurityLogsCount,
    securityLog,
    securityLogs,
    getRequestMetadata
} from '../../services/security.service.js';

describe('Security Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fsPromises.mkdir.mockResolvedValue();
        fsPromises.stat.mockResolvedValue({ size: 0 });
        fsPromises.rename.mockResolvedValue();
        fsPromises.unlink.mockResolvedValue();
        fsPromises.appendFile.mockResolvedValue();
    });

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

    describe('securityLogs (legacy proxy)', () => {
        it('should expose length via getter', () => {
            expect(securityLogs.length).toBe(getSecurityLogsCount());
        });

        it('should support forEach', () => {
            const items = [];
            securityLogs.forEach(log => items.push(log));
            expect(items.length).toBe(getSecurityLogsCount());
        });

        it('should support filter', () => {
            securityLog(LOG_LEVELS.ERROR, SECURITY_EVENTS.AUTH_FAILURE, { ip: '9.9.9.9' });
            const errors = securityLogs.filter(l => l.level === LOG_LEVELS.ERROR);
            expect(errors.length).toBeGreaterThan(0);
        });

        it('should support map', () => {
            const events = securityLogs.map(l => l.event);
            expect(Array.isArray(events)).toBe(true);
        });
    });

    describe('file persistence', () => {
        it('should persist critical security events to file', async () => {
            fsPromises.appendFile.mockClear();

            securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_BLOCKED, {
                ip: '5.5.5.5', email: 'hacker@evil.com'
            });
            await flushSecurityLogPersistenceForTests();

            expect(fsPromises.appendFile).toHaveBeenCalled();
        });

        it('should persist ERROR level to file', async () => {
            fsPromises.appendFile.mockClear();

            securityLog(LOG_LEVELS.ERROR, SECURITY_EVENTS.AUTH_FAILURE, {
                ip: '6.6.6.6'
            });
            await flushSecurityLogPersistenceForTests();

            expect(fsPromises.appendFile).toHaveBeenCalled();
        });

        it('should persist RATE_LIMIT_HIT events to file', async () => {
            fsPromises.appendFile.mockClear();

            securityLog(LOG_LEVELS.WARNING, SECURITY_EVENTS.RATE_LIMIT_HIT, {
                ip: '7.7.7.7'
            });
            await flushSecurityLogPersistenceForTests();

            expect(fsPromises.appendFile).toHaveBeenCalled();
        });

        it('should not persist INFO level non-critical events to file', async () => {
            fsPromises.appendFile.mockClear();

            securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.DATA_ACCESS, {
                ip: '8.8.8.8'
            });
            await flushSecurityLogPersistenceForTests();

            expect(fsPromises.appendFile).not.toHaveBeenCalled();
        });

        it('should skip rotation checks when the log file does not exist yet', async () => {
            fsPromises.stat
                .mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }))
                .mockResolvedValueOnce({ size: 0 });

            securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.AUTH_BLOCKED, {
                ip: '5.5.5.5'
            });
            await flushSecurityLogPersistenceForTests();

            expect(fsPromises.appendFile).toHaveBeenCalled();
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

        it('should fallback to connection.remoteAddress when ip is missing', () => {
            const req = {
                ip: undefined,
                path: '/api/data',
                method: 'DELETE',
                get: vi.fn(() => 'curl/7.0'),
                user: { id: 'u2', email: 'del@test.com' },
                connection: { remoteAddress: '192.168.1.1' }
            };

            const meta = getRequestMetadata(req);

            expect(meta.ip).toBe('192.168.1.1');
            expect(meta.userAgent).toBe('curl/7.0');
        });
    });
});
