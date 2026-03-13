/**
 * Tests for gdprAudit.service.js
 * GDPR audit logging functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';
import {
    GDPR_ACTIONS,
    GDPR_CATEGORIES,
    initGdprAuditTable,
    logGdprAction,
    getGdprAuditLogs,
    getGdprAuditStats,
    getGdprFirms,
    exportTargetLogs
} from '../../services/gdprAudit.service.js';

describe('gdprAudit.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GDPR_ACTIONS constants', () => {
        it('should have consent actions', () => {
            expect(GDPR_ACTIONS.CONSENT_REQUEST_SENT).toBe('consent_request_sent');
            expect(GDPR_ACTIONS.CONSENT_GRANTED).toBe('consent_granted');
            expect(GDPR_ACTIONS.CONSENT_REFUSED).toBe('consent_refused');
        });

        it('should have data actions', () => {
            expect(GDPR_ACTIONS.DATA_EXPORTED).toBe('data_exported');
            expect(GDPR_ACTIONS.DATA_DELETED).toBe('data_deleted');
            expect(GDPR_ACTIONS.DATA_ANONYMIZED).toBe('data_anonymized');
        });

        it('should have CV actions', () => {
            expect(GDPR_ACTIONS.CV_UPLOADED).toBe('cv_uploaded');
            expect(GDPR_ACTIONS.CV_PROCESSED).toBe('cv_processed');
            expect(GDPR_ACTIONS.CV_PURGED).toBe('cv_purged');
        });

        it('should have automated actions', () => {
            expect(GDPR_ACTIONS.AUTO_PURGE_EXECUTED).toBe('auto_purge_executed');
            expect(GDPR_ACTIONS.AUTO_REMINDER_SENT).toBe('auto_reminder_sent');
        });
    });

    describe('GDPR_CATEGORIES constants', () => {
        it('should have all categories', () => {
            expect(GDPR_CATEGORIES.CONSENT).toBe('consent');
            expect(GDPR_CATEGORIES.DATA).toBe('data');
            expect(GDPR_CATEGORIES.CV).toBe('cv');
            expect(GDPR_CATEGORIES.AUTOMATED).toBe('automated');
            expect(GDPR_CATEGORIES.ADMIN).toBe('admin');
        });
    });

    describe('initGdprAuditTable', () => {
        it('should create table and indexes', async () => {
            query.mockResolvedValue({ rows: [] });

            const result = await initGdprAuditTable();

            expect(result).toBe(true);
            expect(query).toHaveBeenCalledTimes(7); // 1 CREATE TABLE + 6 CREATE INDEX
            expect(query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS gdpr_audit_log'));
        });

        it('should throw error on database failure', async () => {
            query.mockRejectedValue(new Error('Database error'));

            await expect(initGdprAuditTable()).rejects.toThrow('Database error');
            expect(safeLog).toHaveBeenCalledWith('error', expect.any(String), expect.any(Object));
        });
    });

    describe('logGdprAction', () => {
        it('should log action with all parameters', async () => {
            query.mockResolvedValue({
                rows: [{ id: 'log-123', action: 'consent_granted' }]
            });

            const result = await logGdprAction({
                action: GDPR_ACTIONS.CONSENT_GRANTED,
                firmId: 'firm-123',
                firmName: 'Test Firm',
                userId: 'user-123',
                userName: 'John Doe',
                targetType: 'candidate',
                targetId: 'candidate-123',
                targetName: 'Jane Smith',
                targetEmail: 'jane@example.com',
                details: { source: 'email' },
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                isAutomated: false
            });

            expect(result).toEqual({ id: 'log-123', action: 'consent_granted' });
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO gdpr_audit_log'),
                expect.arrayContaining([
                    GDPR_ACTIONS.CONSENT_GRANTED,
                    'consent', // category
                    'firm-123',
                    'Test Firm'
                ])
            );
        });

        it('should log action with minimal parameters', async () => {
            query.mockResolvedValue({ rows: [{ id: 'log-123' }] });

            const result = await logGdprAction({
                action: GDPR_ACTIONS.CV_UPLOADED
            });

            expect(result).toBeDefined();
            expect(query).toHaveBeenCalled();
        });

        it('should warn for unknown action type', async () => {
            query.mockResolvedValue({ rows: [{ id: 'log-123' }] });

            await logGdprAction({ action: 'unknown_action' });

            expect(safeLog).toHaveBeenCalledWith('warn', 'Unknown GDPR action type', { action: 'unknown_action' });
        });

        it('should return null on database error (not throw)', async () => {
            query.mockRejectedValue(new Error('Database error'));

            const result = await logGdprAction({
                action: GDPR_ACTIONS.CONSENT_GRANTED
            });

            expect(result).toBeNull();
            expect(safeLog).toHaveBeenCalledWith('error', expect.any(String), expect.any(Object));
        });

        it('should set correct category for consent actions', async () => {
            query.mockResolvedValue({ rows: [{ id: 'log-123' }] });

            await logGdprAction({ action: GDPR_ACTIONS.CONSENT_GRANTED });

            expect(query).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining(['consent'])
            );
        });

        it('should set correct category for automated actions', async () => {
            query.mockResolvedValue({ rows: [{ id: 'log-123' }] });

            await logGdprAction({ action: GDPR_ACTIONS.AUTO_PURGE_EXECUTED, isAutomated: true });

            expect(query).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining(['automated', true])
            );
        });
    });

    describe('getGdprAuditLogs', () => {
        it('should return paginated logs', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '100' }] });
            query.mockResolvedValueOnce({
                rows: [
                    { id: 'log-1', action: 'consent_granted' },
                    { id: 'log-2', action: 'cv_uploaded' }
                ]
            });

            const result = await getGdprAuditLogs({ page: 1, limit: 50 });

            expect(result.logs).toHaveLength(2);
            expect(result.pagination.total).toBe(100);
            expect(result.pagination.totalPages).toBe(2);
        });

        it('should filter by firmId', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '10' }] });
            query.mockResolvedValueOnce({ rows: [] });

            await getGdprAuditLogs({ firmId: 'firm-123' });

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('firm_id = $1'),
                expect.arrayContaining(['firm-123'])
            );
        });

        it('should filter by action', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '5' }] });
            query.mockResolvedValueOnce({ rows: [] });

            await getGdprAuditLogs({ action: GDPR_ACTIONS.CONSENT_GRANTED });

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('action = $'),
                expect.arrayContaining([GDPR_ACTIONS.CONSENT_GRANTED])
            );
        });

        it('should filter by category', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '20' }] });
            query.mockResolvedValueOnce({ rows: [] });

            await getGdprAuditLogs({ category: GDPR_CATEGORIES.CONSENT });

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('category = $'),
                expect.arrayContaining([GDPR_CATEGORIES.CONSENT])
            );
        });

        it('should filter by targetEmail with ILIKE', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '3' }] });
            query.mockResolvedValueOnce({ rows: [] });

            await getGdprAuditLogs({ targetEmail: 'test@example.com' });

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('target_email ILIKE'),
                expect.arrayContaining(['%test@example.com%'])
            );
        });

        it('should filter by isAutomated', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '15' }] });
            query.mockResolvedValueOnce({ rows: [] });

            await getGdprAuditLogs({ isAutomated: true });

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('is_automated = $'),
                expect.arrayContaining([true])
            );
        });

        it('should filter by date range', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '8' }] });
            query.mockResolvedValueOnce({ rows: [] });

            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            await getGdprAuditLogs({ startDate, endDate });

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('created_at >='),
                expect.arrayContaining([startDate, endDate])
            );
        });

        it('should use safe sort parameters', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '10' }] });
            query.mockResolvedValueOnce({ rows: [] });

            await getGdprAuditLogs({ sortBy: 'action', sortOrder: 'asc' });

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY action ASC'),
                expect.any(Array)
            );
        });

        it('should default to created_at DESC for invalid sort', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '10' }] });
            query.mockResolvedValueOnce({ rows: [] });

            await getGdprAuditLogs({ sortBy: 'invalid_field; DROP TABLE--' });

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY created_at DESC'),
                expect.any(Array)
            );
        });

        it('should calculate pagination correctly', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '150' }] });
            query.mockResolvedValueOnce({ rows: [] });

            const result = await getGdprAuditLogs({ page: 2, limit: 50 });

            expect(result.pagination.page).toBe(2);
            expect(result.pagination.totalPages).toBe(3);
            expect(result.pagination.hasNext).toBe(true);
            expect(result.pagination.hasPrev).toBe(true);
        });

        it('should throw error on database failure', async () => {
            query.mockRejectedValue(new Error('Database error'));

            await expect(getGdprAuditLogs()).rejects.toThrow('Database error');
        });
    });

    describe('getGdprAuditStats', () => {
        it('should return statistics', async () => {
            query.mockResolvedValueOnce({ rows: [{ category: 'consent', count: '50' }] });
            query.mockResolvedValueOnce({ rows: [{ action: 'consent_granted', count: '30' }] });
            query.mockResolvedValueOnce({ rows: [
                { is_automated: true, count: '20' },
                { is_automated: false, count: '80' }
            ]});
            query.mockResolvedValueOnce({ rows: [{ date: '2024-01-15', count: '10' }] });
            query.mockResolvedValueOnce({ rows: [{ total: '100' }] });

            const result = await getGdprAuditStats(null, 30);

            expect(result.period).toBe('30 days');
            expect(result.total).toBe(100);
            expect(result.byCategory.consent).toBe(50);
            expect(result.byAction[0].action).toBe('consent_granted');
            expect(result.automated.automated).toBe(20);
            expect(result.automated.manual).toBe(80);
        });

        it('should filter by firmId', async () => {
            // 5 queries need mocks
            query.mockResolvedValueOnce({ rows: [] }); // categoryStats
            query.mockResolvedValueOnce({ rows: [] }); // actionStats
            query.mockResolvedValueOnce({ rows: [] }); // automatedStats
            query.mockResolvedValueOnce({ rows: [] }); // dailyStats
            query.mockResolvedValueOnce({ rows: [{ total: '0' }] }); // totalResult

            await getGdprAuditStats('firm-123', 7);

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('AND firm_id = $2'),
                [7, 'firm-123']
            );
        });

        it('should handle empty results', async () => {
            // 5 queries: categoryStats, actionStats, automatedStats, dailyStats, totalResult
            query.mockResolvedValueOnce({ rows: [] }); // categoryStats
            query.mockResolvedValueOnce({ rows: [] }); // actionStats
            query.mockResolvedValueOnce({ rows: [] }); // automatedStats
            query.mockResolvedValueOnce({ rows: [] }); // dailyStats
            query.mockResolvedValueOnce({ rows: [{ total: '0' }] }); // totalResult

            const result = await getGdprAuditStats();

            expect(result.total).toBe(0);
            expect(result.byCategory).toEqual({});
            expect(result.byAction).toEqual([]);
        });

        it('should throw error on database failure', async () => {
            query.mockRejectedValue(new Error('Database error'));

            await expect(getGdprAuditStats()).rejects.toThrow('Database error');
        });
    });

    describe('getGdprFirms', () => {
        it('should return list of firms with activity', async () => {
            query.mockResolvedValue({
                rows: [
                    { firm_id: 'firm-1', firm_name: 'Firm A', action_count: '50' },
                    { firm_id: 'firm-2', firm_name: 'Firm B', action_count: '30' }
                ]
            });

            const result = await getGdprFirms();

            expect(result).toHaveLength(2);
            expect(result[0].firm_name).toBe('Firm A');
        });

        it('should return empty array when no firms', async () => {
            query.mockResolvedValue({ rows: [] });

            const result = await getGdprFirms();

            expect(result).toEqual([]);
        });

        it('should throw error on database failure', async () => {
            query.mockRejectedValue(new Error('Database error'));

            await expect(getGdprFirms()).rejects.toThrow('Database error');
        });
    });

    describe('exportTargetLogs', () => {
        it('should export all logs for target email', async () => {
            query.mockResolvedValue({
                rows: [
                    { action: 'consent_granted', category: 'consent', created_at: new Date() },
                    { action: 'cv_uploaded', category: 'cv', created_at: new Date() }
                ]
            });

            const result = await exportTargetLogs('target@example.com');

            expect(result).toHaveLength(2);
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE target_email = $1'),
                ['target@example.com']
            );
        });

        it('should return empty array when no logs', async () => {
            query.mockResolvedValue({ rows: [] });

            const result = await exportTargetLogs('unknown@example.com');

            expect(result).toEqual([]);
        });

        it('should throw error on database failure', async () => {
            query.mockRejectedValue(new Error('Database error'));

            await expect(exportTargetLogs('test@example.com')).rejects.toThrow('Database error');
        });
    });
});
