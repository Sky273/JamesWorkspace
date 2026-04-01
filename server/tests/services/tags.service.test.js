/**
 * Tests for Tags Service
 * Tests tag aggregation, batch fetching, renaming, and updating
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: vi.fn(),
    updateWithTimeout: vi.fn()
}));

import { selectWithTimeout, updateWithTimeout } from '../../utils/postgresHelpers.js';
import {
    aggregateRawTags,
    aggregateCleanedTags,
    aggregateEscoTags,
    fetchResumeBatch,
    updateResumeTags,
    renameTag
} from '../../services/tags.service.js';

describe('Tags Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('aggregateRawTags', () => {
        it('should return aggregated raw tags', async () => {
            const tags = { skills: ['React'], industries: ['IT'], tools: ['Git'], soft_skills: ['Communication'] };
            selectWithTimeout.mockResolvedValueOnce([tags]);

            const result = await aggregateRawTags();

            expect(result).toEqual(tags);
            expect(selectWithTimeout.mock.calls[0][0]).toBe('resumes');
            expect(selectWithTimeout.mock.calls[0][1].rawQuery).toContain('jsonb_array_elements_text');
        });

        it('should return empty object if no results', async () => {
            selectWithTimeout.mockResolvedValueOnce([]);
            expect(await aggregateRawTags()).toEqual({});
        });
    });

    describe('aggregateCleanedTags', () => {
        it('should return cleaned tags for admin (no firm filter)', async () => {
            const tags = { skills: ['React'], industries: [], tools: [], soft_skills: [] };
            selectWithTimeout.mockResolvedValueOnce([tags]);

            const result = await aggregateCleanedTags({ isAdmin: true });

            expect(result).toEqual(tags);
            expect(selectWithTimeout.mock.calls[0][1].rawParams).toEqual([]);
        });

        it('should apply firm filter for non-admin', async () => {
            selectWithTimeout.mockResolvedValueOnce([{}]);

            await aggregateCleanedTags({ isAdmin: false, userFirmId: 'f1' });

            expect(selectWithTimeout.mock.calls[0][1].rawParams).toEqual(['f1']);
            expect(selectWithTimeout.mock.calls[0][1].rawQuery).toContain('firm_id = $1');
        });

        it('should handle grouped-by-deal scope for admin', async () => {
            selectWithTimeout.mockResolvedValueOnce([{}]);

            await aggregateCleanedTags({ isAdmin: true, scope: 'grouped-by-deal' });

            expect(selectWithTimeout.mock.calls[0][1].rawQuery).toContain('visible_resumes');
            expect(selectWithTimeout.mock.calls[0][1].rawParams).toEqual([]);
        });

        it('should handle grouped-by-deal scope for non-admin', async () => {
            selectWithTimeout.mockResolvedValueOnce([{}]);

            await aggregateCleanedTags({ isAdmin: false, userFirmId: 'f1', scope: 'grouped-by-deal' });

            expect(selectWithTimeout.mock.calls[0][1].rawQuery).toContain('visible_resumes');
            expect(selectWithTimeout.mock.calls[0][1].rawQuery).toContain('d.firm_id = $1');
            expect(selectWithTimeout.mock.calls[0][1].rawParams).toEqual(['f1']);
        });

        it('should return empty object if no results', async () => {
            selectWithTimeout.mockResolvedValueOnce([]);
            expect(await aggregateCleanedTags({ isAdmin: true })).toEqual({});
        });
    });

    describe('aggregateEscoTags', () => {
        it('should return ESCO normalized tags', async () => {
            const tags = { skills: [{ label: 'React', uri: 'esco:1' }], industries: [], tools: [], soft_skills: [] };
            selectWithTimeout.mockResolvedValueOnce([tags]);

            const result = await aggregateEscoTags();

            expect(result).toEqual(tags);
            expect(selectWithTimeout.mock.calls[0][1].rawQuery).toContain('skills_esco');
        });
    });

    describe('fetchResumeBatch', () => {
        it('should fetch batch with columns, limit, and offset', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ id: 'r1', skills: [] }]);

            const result = await fetchResumeBatch(['id', 'skills'], 100, 0);

            expect(result).toHaveLength(1);
            expect(selectWithTimeout).toHaveBeenCalledWith('resumes', {
                columns: ['id', 'skills'],
                conditions: [],
                orderBy: 'id ASC',
                limit: 100,
                offset: 0,
                params: []
            });
        });
    });

    describe('updateResumeTags', () => {
        it('should delegate to updateWithTimeout', async () => {
            updateWithTimeout.mockResolvedValueOnce({ id: 'r1' });

            await updateResumeTags('r1', { skills_cleaned: ['React'] });

            expect(updateWithTimeout).toHaveBeenCalledWith('resumes', 'r1', { skills_cleaned: ['React'] });
        });
    });

    describe('renameTag', () => {
        it('should execute rename query and return updated IDs', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ id: 'r1' }, { id: 'r2' }]);

            const result = await renameTag('skills', 'React.js', 'React');

            expect(result).toHaveLength(2);
            expect(selectWithTimeout.mock.calls[0][1].rawQuery).toContain('UPDATE resumes');
            expect(selectWithTimeout.mock.calls[0][1].rawParams).toEqual(['React.js', 'React', JSON.stringify(['React.js'])]);
        });
    });
});
