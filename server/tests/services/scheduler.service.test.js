/**
 * Tests for Scheduler Service
 * Tests start/stop scheduler and manual runAllChecks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/consent.service.js', () => ({
    checkExpiredConsents: vi.fn(() => Promise.resolve(0)),
    sendConsentReminders: vi.fn(() => Promise.resolve(0)),
    purgeExpiredResumes: vi.fn(() => Promise.resolve(0))
}));

vi.mock('../../services/mail/gdprMailService.js', () => ({
    proactiveTokenRefresh: vi.fn(() => Promise.resolve({ success: true, message: 'OK' }))
}));

vi.mock('../../services/passwordReset.service.js', () => ({
    cleanupExpiredTokens: vi.fn(() => Promise.resolve(0))
}));

import { checkExpiredConsents, sendConsentReminders, purgeExpiredResumes } from '../../services/consent.service.js';
import { proactiveTokenRefresh } from '../../services/mail/gdprMailService.js';
import { cleanupExpiredTokens } from '../../services/passwordReset.service.js';
import {
    startScheduler,
    stopScheduler,
    runAllChecks
} from '../../services/scheduler.service.js';

describe('Scheduler Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        stopScheduler();
        vi.useRealTimers();
    });

    describe('startScheduler / stopScheduler', () => {
        it('should start and stop without errors', () => {
            expect(() => startScheduler()).not.toThrow();
            expect(() => stopScheduler()).not.toThrow();
        });

        it('should be safe to stop when not started', () => {
            expect(() => stopScheduler()).not.toThrow();
        });

        it('should not schedule duplicate timers when started twice', async () => {
            expect(() => startScheduler()).not.toThrow();
            expect(() => startScheduler()).not.toThrow();

            await vi.advanceTimersByTimeAsync(30000);

            expect(checkExpiredConsents).toHaveBeenCalledTimes(1);
            expect(purgeExpiredResumes).toHaveBeenCalledTimes(1);
            expect(cleanupExpiredTokens).toHaveBeenCalledTimes(1);
            expect(proactiveTokenRefresh).toHaveBeenCalledTimes(1);
        });
    });

    describe('runAllChecks', () => {
        it('should run all checks and return results', async () => {
            checkExpiredConsents.mockResolvedValueOnce(3);
            sendConsentReminders.mockResolvedValueOnce(1);
            purgeExpiredResumes.mockResolvedValueOnce(2);
            proactiveTokenRefresh.mockResolvedValueOnce({ success: true, message: 'refreshed' });
            cleanupExpiredTokens.mockResolvedValueOnce(5);

            const results = await runAllChecks();

            expect(results.expiredCount).toBe(3);
            expect(results.remindersSent).toBe(1);
            expect(results.purgedCount).toBe(2);
            expect(results.tokenRefresh.success).toBe(true);
            expect(results.resetTokensCleanup).toBe(5);
        });

        it('should handle errors in individual checks gracefully', async () => {
            checkExpiredConsents.mockRejectedValueOnce(new Error('DB down'));
            sendConsentReminders.mockResolvedValueOnce(0);
            purgeExpiredResumes.mockResolvedValueOnce(0);
            proactiveTokenRefresh.mockRejectedValueOnce(new Error('Token error'));
            cleanupExpiredTokens.mockResolvedValueOnce(0);

            const results = await runAllChecks();

            // Should not throw, results should have defaults where errors occurred
            expect(results.expiredCount).toBe(0);
            expect(results.tokenRefresh).toEqual({ success: false, message: 'Token error' });
        });
    });
});
