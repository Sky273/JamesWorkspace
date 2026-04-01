/**
 * Tests for Batch Export Service
 * Tests template and resume retrieval for export
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

import { query } from '../../config/database.js';
import {
    getTemplateById,
    getResumeById,
    getTemplateByIdForExport,
    getResumeByIdForExport
} from '../../services/batchExport.service.js';

describe('Batch Export Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getTemplateById', () => {
        it('should return template', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1', name: 'Modern' }] });
            expect(await getTemplateById('t1')).toEqual({ id: 't1', name: 'Modern' });
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getTemplateById('missing')).toBeNull();
        });
    });

    describe('getResumeById', () => {
        it('should return resume', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'r1', name: 'CV' }] });
            expect(await getResumeById('r1')).toEqual({ id: 'r1', name: 'CV' });
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getResumeById('missing')).toBeNull();
        });
    });

    describe('getTemplateByIdForExport', () => {
        it('should allow admin access', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1', firm_id: 'firm-other' }] });
            expect(await getTemplateByIdForExport('t1', { isAdmin: true, userFirmId: null })).toEqual({ id: 't1', firm_id: 'firm-other' });
        });

        it('should reject cross-firm non-admin access', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1', firm_id: 'firm-other' }] });
            expect(await getTemplateByIdForExport('t1', { isAdmin: false, userFirmId: 'firm-123' })).toBeNull();
        });
    });

    describe('getResumeByIdForExport', () => {
        it('should allow same-firm resume access', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'r1', firm_id: 'firm-123' }] });
            expect(await getResumeByIdForExport('r1', { isAdmin: false, userFirmId: 'firm-123' })).toEqual({ id: 'r1', firm_id: 'firm-123' });
        });

        it('should reject cross-firm resume access', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'r1', firm_id: 'firm-other' }] });
            expect(await getResumeByIdForExport('r1', { isAdmin: false, userFirmId: 'firm-123' })).toBeNull();
        });
    });
});
