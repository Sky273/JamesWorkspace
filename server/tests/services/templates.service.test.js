/**
 * Tests for Templates Service (CV templates)
 * Tests CRUD operations, listing with filters, and firm validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

import { query } from '../../config/database.js';
import {
    listTemplates,
    getTemplateById,
    getFirmIfExists,
    createTemplate,
    updateTemplate,
    deleteTemplate
} from '../../services/templates.service.js';

describe('Templates Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('listTemplates', () => {
        it('should return paginated templates for admin', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '5' }] })
                .mockResolvedValueOnce({ rows: [{ id: 't1' }, { id: 't2' }] });

            const result = await listTemplates({ isAdmin: true, page: 1, limit: 100 });

            expect(result.templates).toHaveLength(2);
            expect(result.totalCount).toBe(5);
        });

        it('should filter by firm for non-admin', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await listTemplates({ isAdmin: false, userFirmId: 'f1' });

            expect(query.mock.calls[0][0]).toContain('t.firm_id = $');
            expect(query.mock.calls[0][0]).toContain('t.firm_id IS NULL');
        });

        it('should apply status filter', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await listTemplates({ isAdmin: true, status: 'active' });

            expect(query.mock.calls[0][0]).toContain('t.status = $');
        });

        it('should apply search filter', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await listTemplates({ isAdmin: true, search: 'modern' });

            expect(query.mock.calls[0][0]).toContain('LOWER(t.name) LIKE');
        });

        it('should detect hasMore', async () => {
            const templates = Array(101).fill(null).map((_, i) => ({ id: `t${i}` }));
            query
                .mockResolvedValueOnce({ rows: [{ total: '200' }] })
                .mockResolvedValueOnce({ rows: templates });

            const result = await listTemplates({ isAdmin: true, limit: 100 });

            expect(result.templates).toHaveLength(100);
            expect(result.hasMore).toBe(true);
        });
    });

    describe('getTemplateById', () => {
        it('should return template', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1', name: 'Modern' }] });
            expect(await getTemplateById('t1')).toEqual({ id: 't1', name: 'Modern' });
        });

        it('should throw 404 if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            try {
                await getTemplateById('missing');
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.statusCode).toBe(404);
            }
        });
    });

    describe('getFirmIfExists', () => {
        it('should return firm data', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'f1', name: 'Acme' }] });
            expect(await getFirmIfExists('f1')).toEqual({ id: 'f1', name: 'Acme' });
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getFirmIfExists('missing')).toBeNull();
        });
    });

    describe('createTemplate', () => {
        it('should create and return template', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1', name: 'New' }] });

            const result = await createTemplate({ name: 'New', status: 'active' });

            expect(result.name).toBe('New');
            expect(query.mock.calls[0][0]).toContain('INSERT INTO templates');
        });

        it('should skip undefined values', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1' }] });

            await createTemplate({ name: 'X', description: undefined });

            expect(query.mock.calls[0][1]).toHaveLength(1);
        });
    });

    describe('updateTemplate', () => {
        it('should update and return template', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1', name: 'Updated' }] });

            const result = await updateTemplate('t1', { name: 'Updated' });

            expect(result.name).toBe('Updated');
        });

        it('should return existing if no fields', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1', name: 'Same' }] });

            const result = await updateTemplate('t1', {});

            expect(result.name).toBe('Same');
        });

        it('should throw 404 if not found on update', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            try {
                await updateTemplate('missing', { name: 'X' });
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.statusCode).toBe(404);
            }
        });
    });

    describe('deleteTemplate', () => {
        it('should return true when deleted', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1' }] });
            expect(await deleteTemplate('t1')).toBe(true);
        });

        it('should throw 404 if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            try {
                await deleteTemplate('missing');
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.statusCode).toBe(404);
            }
        });
    });
});
