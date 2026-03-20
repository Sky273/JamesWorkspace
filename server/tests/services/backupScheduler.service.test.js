/**
 * Tests for Backup Scheduler Service
 * Tests init, reload, stop, and status
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/backup.service.js', () => ({
    getBackupSettings: vi.fn(),
    createBackup: vi.fn()
}));

vi.mock('../../services/consent/operations.js', () => ({
    getDpoSettings: vi.fn().mockResolvedValue(null)
}));

import { getBackupSettings } from '../../services/backup.service.js';
import {
    initBackupScheduler,
    reloadBackupScheduler,
    stopBackupScheduler,
    getSchedulerStatus
} from '../../services/backup-scheduler.service.js';

describe('Backup Scheduler Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        stopBackupScheduler();
    });

    afterEach(() => {
        stopBackupScheduler();
    });

    describe('initBackupScheduler', () => {
        it('should not start if no settings found', async () => {
            getBackupSettings.mockResolvedValueOnce(null);

            await initBackupScheduler();

            expect(getSchedulerStatus().running).toBe(false);
        });

        it('should not start if no backups enabled', async () => {
            getBackupSettings.mockResolvedValueOnce({
                daily_enabled: false,
                weekly_enabled: false,
                monthly_enabled: false
            });

            await initBackupScheduler();

            expect(getSchedulerStatus().running).toBe(false);
        });

        it('should start if daily backup enabled', async () => {
            getBackupSettings.mockResolvedValueOnce({
                daily_enabled: true,
                daily_time: '02:00',
                weekly_enabled: false,
                monthly_enabled: false,
                host: 'backup.example.com'
            });

            await initBackupScheduler();

            expect(getSchedulerStatus().running).toBe(true);
        });

        it('should handle DB error gracefully', async () => {
            getBackupSettings.mockRejectedValueOnce(new Error('DB down'));

            await initBackupScheduler();

            expect(getSchedulerStatus().running).toBe(false);
        });
    });

    describe('stopBackupScheduler', () => {
        it('should stop running scheduler', async () => {
            getBackupSettings.mockResolvedValueOnce({
                daily_enabled: true, daily_time: '02:00',
                weekly_enabled: false, monthly_enabled: false
            });

            await initBackupScheduler();
            expect(getSchedulerStatus().running).toBe(true);

            stopBackupScheduler();
            expect(getSchedulerStatus().running).toBe(false);
        });

        it('should be safe to call when not running', () => {
            expect(() => stopBackupScheduler()).not.toThrow();
        });
    });

    describe('reloadBackupScheduler', () => {
        it('should reload settings', async () => {
            getBackupSettings.mockResolvedValueOnce({
                daily_enabled: true, daily_time: '03:00',
                weekly_enabled: false, monthly_enabled: false
            });

            await reloadBackupScheduler();

            expect(getSchedulerStatus().running).toBe(true);
        });
    });

    describe('getSchedulerStatus', () => {
        it('should return status with lastExecuted', () => {
            const status = getSchedulerStatus();

            expect(status).toHaveProperty('running');
            expect(status).toHaveProperty('lastExecuted');
        });
    });
});
