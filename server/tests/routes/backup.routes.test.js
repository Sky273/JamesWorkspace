/**
 * Tests for Backup routes
 * GET /settings, PUT /settings, POST /run, GET /history,
 * DELETE /history/:id, POST /test-connection, POST /restore,
 * GET /scheduler-status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Mock constants
vi.mock('../../config/constants.js', () => ({
    JWT_SECRET: 'test-jwt-secret-for-vitest-minimum-32-chars-long',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret-for-vitest-min-32-chars',
    CSRF_SECRET: 'test-csrf-secret-for-vitest-minimum-32-chars',
    SALT_ROUNDS: 10,
    MAX_TEXT_LENGTH: 50000,
    MAX_PROMPT_LENGTH: 100000,
    MAX_STRING_FIELD_LENGTH: 1000,
    RATE_LIMIT: { AUTH: { windowMs: 900000, max: 20 }, USER: { windowMs: 900000, max: 50 } },
    MAX_LOGS: 1000
}));

// Mock backup service
const mockGetBackupSettings = vi.fn();
const mockSaveBackupSettings = vi.fn();
const mockGetBackupHistory = vi.fn();
const mockDeleteHistoryEntry = vi.fn();
const mockTestConnection = vi.fn();
const mockListRemoteBackups = vi.fn();
const mockCreateBackup = vi.fn();
const mockRestoreBackup = vi.fn();
vi.mock('../../services/backup.service.js', () => ({
    getBackupSettings: (...args) => mockGetBackupSettings(...args),
    saveBackupSettings: (...args) => mockSaveBackupSettings(...args),
    getBackupHistory: (...args) => mockGetBackupHistory(...args),
    deleteHistoryEntry: (...args) => mockDeleteHistoryEntry(...args),
    testConnection: (...args) => mockTestConnection(...args),
    listRemoteBackups: (...args) => mockListRemoteBackups(...args),
    createBackup: (...args) => mockCreateBackup(...args),
    restoreBackup: (...args) => mockRestoreBackup(...args)
}));

// Mock backup scheduler
const mockReloadBackupScheduler = vi.fn();
const mockGetSchedulerStatus = vi.fn();
vi.mock('../../services/backup-scheduler.service.js', () => ({
    reloadBackupScheduler: (...args) => mockReloadBackupScheduler(...args),
    getSchedulerStatus: (...args) => mockGetSchedulerStatus(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: vi.fn(() => vi.fn())
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: (...paramNames) => (req, res, next) => {
        for (const paramName of paramNames) {
            const value = req.params[paramName];
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: [{ field: paramName, message: 'Invalid record ID format' }]
                });
            }
        }
        next();
    },
    updateBackupSettingsSchema: {},
    testBackupConnectionSchema: {},
    restoreBackupSchema: {}
}));

vi.mock('../../utils/networkHostSecurity.js', () => ({
    assertSafeOutboundHost: vi.fn(async (host) => {
        if (host === '127.0.0.1' || host === 'localhost' || host === '::1') {
            throw new Error('Private or loopback hosts are not allowed');
        }
        return true;
    })
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = { id: 'admin-123', email: 'admin@example.com', role: 'admin' };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    },
    requireAdmin: (req, res, next) => {
        if (req.user?.role === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Admin access required' });
        }
    }
}));

import backupRoutes from '../../routes/backup.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/backup', backupRoutes);
    return app;
}

describe('Backup Routes', () => {
    let app;
    const authHeader = { Authorization: 'Bearer valid-token' };

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    describe('GET /api/backup/settings', () => {
        it('should return settings without password', async () => {
            mockGetBackupSettings.mockResolvedValue({
                host: 'ftp.example.com',
                protocol: 'ftp',
                username: 'user',
                password: 'secret123'
            });
            mockGetSchedulerStatus.mockReturnValue({ running: true });

            const res = await request(app).get('/api/backup/settings').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.host).toBe('ftp.example.com');
            expect(res.body.password).toBeUndefined();
            expect(res.body.hasPassword).toBe(true);
            expect(res.body.schedulerStatus).toEqual({ running: true });
        });

        it('should return null when no settings exist', async () => {
            mockGetBackupSettings.mockResolvedValue(null);
            mockGetSchedulerStatus.mockReturnValue({ running: false });

            const res = await request(app).get('/api/backup/settings').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.settings).toBeNull();
        });

        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/backup/settings');
            expect(res.status).toBe(401);
        });

        it('should return 500 on error', async () => {
            mockGetBackupSettings.mockRejectedValue(new Error('DB error'));

            const res = await request(app).get('/api/backup/settings').set(authHeader);
            expect(res.status).toBe(500);
        });
    });

    describe('PUT /api/backup/settings', () => {
        it('should save settings and reload scheduler', async () => {
            mockGetBackupSettings.mockResolvedValue(null);
            mockSaveBackupSettings.mockResolvedValue({
                host: 'ftp.example.com',
                protocol: 'ftp',
                password: 'secret'
            });
            mockReloadBackupScheduler.mockResolvedValue(undefined);
            mockGetSchedulerStatus.mockReturnValue({ running: true });

            const res = await request(app)
                .put('/api/backup/settings')
                .set(authHeader)
                .send({ host: 'ftp.example.com', protocol: 'ftp', password: 'secret' });

            expect(res.status).toBe(200);
            expect(res.body.password).toBeUndefined();
            expect(res.body.hasPassword).toBe(true);
            expect(mockReloadBackupScheduler).toHaveBeenCalled();
        });

        it('should return 500 on error', async () => {
            mockGetBackupSettings.mockResolvedValue(null);
            mockSaveBackupSettings.mockRejectedValue(new Error('Save failed'));

            const res = await request(app)
                .put('/api/backup/settings')
                .set(authHeader)
                .send({ host: 'test' });

            expect(res.status).toBe(500);
        });
    });

    describe('POST /api/backup/run', () => {
        it('should trigger manual backup', async () => {
            mockCreateBackup.mockResolvedValue({ filename: 'backup-2026.sql.gz', size: 1024 });

            const res = await request(app).post('/api/backup/run').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.filename).toBe('backup-2026.sql.gz');
            expect(mockCreateBackup).toHaveBeenCalledWith('manual');
        });

        it('should return 500 on failure', async () => {
            mockCreateBackup.mockRejectedValue(new Error('Backup failed'));

            const res = await request(app).post('/api/backup/run').set(authHeader);

            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Manual backup failed');
        });
    });

    describe('GET /api/backup/history', () => {
        it('should return backup history', async () => {
            mockGetBackupHistory.mockResolvedValue([
                { id: 'h-1', backup_type: 'manual', filename: 'backup.sql.gz' }
            ]);

            const res = await request(app).get('/api/backup/history').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body).toBeInstanceOf(Array);
            expect(res.body[0].backup_type).toBe('manual');
        });

        it('should pass limit and offset', async () => {
            mockGetBackupHistory.mockResolvedValue([]);

            await request(app).get('/api/backup/history?limit=10&offset=5').set(authHeader);

            expect(mockGetBackupHistory).toHaveBeenCalledWith(10, 5);
        });

        it('should clamp oversized limit and sanitize offset', async () => {
            mockGetBackupHistory.mockResolvedValue([]);

            await request(app).get('/api/backup/history?limit=9999&offset=-4').set(authHeader);

            expect(mockGetBackupHistory).toHaveBeenCalledWith(200, 0);
        });
    });

    describe('DELETE /api/backup/history/:id', () => {
        it('should delete history entry', async () => {
            mockDeleteHistoryEntry.mockResolvedValue(undefined);

            const res = await request(app)
                .delete('/api/backup/history/123e4567-e89b-12d3-a456-426614174000')
                .set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should reject an invalid history entry id', async () => {
            const res = await request(app).delete('/api/backup/history/not-a-uuid').set(authHeader);

            expect(res.status).toBe(400);
            expect(mockDeleteHistoryEntry).not.toHaveBeenCalled();
        });
    });

    describe('POST /api/backup/test-connection', () => {
        it('should test connection successfully', async () => {
            mockTestConnection.mockResolvedValue({ success: true, message: 'Connected' });

            const res = await request(app)
                .post('/api/backup/test-connection')
                .set(authHeader)
                .send({ host: 'ftp.test.com', username: 'user', password: 'pass' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 400 if host or username missing', async () => {
            const res = await request(app)
                .post('/api/backup/test-connection')
                .set(authHeader)
                .send({ protocol: 'ftp' });

            expect(res.status).toBe(400);
        });

        it('should reject private backup hosts', async () => {
            const res = await request(app)
                .post('/api/backup/test-connection')
                .set(authHeader)
                .send({ host: '127.0.0.1', username: 'user', password: 'pass' });

            expect(res.status).toBe(400);
            expect(mockTestConnection).not.toHaveBeenCalled();
        });

        it('should reject localhost backup hosts', async () => {
            const res = await request(app)
                .post('/api/backup/test-connection')
                .set(authHeader)
                .send({ host: 'localhost', username: 'user', password: 'pass' });

            expect(res.status).toBe(400);
            expect(mockTestConnection).not.toHaveBeenCalled();
        });

        it('should reject IPv6 loopback backup hosts', async () => {
            const res = await request(app)
                .post('/api/backup/test-connection')
                .set(authHeader)
                .send({ host: '::1', username: 'user', password: 'pass' });

            expect(res.status).toBe(400);
            expect(mockTestConnection).not.toHaveBeenCalled();
        });
    });

    describe('POST /api/backup/restore', () => {
        it('should restore from backup', async () => {
            mockRestoreBackup.mockResolvedValue({ success: true });

            const res = await request(app)
                .post('/api/backup/restore')
                .set(authHeader)
                .send({ filename: 'backup-daily-testdb-2026-03-31T10-30-00.sql.gz', confirmText: 'RESTORE' });

            expect(res.status).toBe(200);
            expect(mockRestoreBackup).toHaveBeenCalledWith('backup-daily-testdb-2026-03-31T10-30-00.sql.gz');
        });

        it('should return 400 if filename missing', async () => {
            const res = await request(app)
                .post('/api/backup/restore')
                .set(authHeader)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should return 500 on restore failure', async () => {
            mockRestoreBackup.mockRejectedValue(new Error('Restore failed'));

            const res = await request(app)
                .post('/api/backup/restore')
                .set(authHeader)
                .send({ filename: 'backup-daily-testdb-2026-03-31T10-30-00.sql.gz', confirmText: 'RESTORE' });

            expect(res.status).toBe(500);
            expect(res.body.message).toBe('Database restore failed');
        });
    });

    describe('GET /api/backup/scheduler-status', () => {
        it('should return scheduler status', async () => {
            mockGetSchedulerStatus.mockReturnValue({ running: true, nextRun: '2026-04-01' });

            const res = await request(app).get('/api/backup/scheduler-status').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.running).toBe(true);
        });
    });
});
