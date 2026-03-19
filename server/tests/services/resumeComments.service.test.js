/**
 * Tests for Resume Comments Service
 * Tests CRUD, privacy filtering, counting, and recent comments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { query } from '../../config/database.js';
import {
    initResumeCommentsTable,
    addComment,
    getComments,
    updateComment,
    deleteComment,
    getCommentCount,
    getRecentComments
} from '../../services/resumeComments.service.js';

describe('Resume Comments Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('initResumeCommentsTable', () => {
        it('should create table and indexes', async () => {
            query.mockResolvedValue({ rows: [] });

            expect(await initResumeCommentsTable()).toBe(true);
            expect(query.mock.calls.length).toBeGreaterThanOrEqual(4);
            expect(query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS resume_comments');
        });

        it('should throw on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(initResumeCommentsTable()).rejects.toThrow('DB error');
        });
    });

    describe('addComment', () => {
        it('should insert and return comment', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'c1', content: 'Great CV' }] });

            const result = await addComment({
                resumeId: 'r1', userId: 'u1', userName: 'Admin', content: 'Great CV'
            });

            expect(result.content).toBe('Great CV');
            expect(query.mock.calls[0][0]).toContain('INSERT INTO resume_comments');
        });

        it('should trim content', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });

            await addComment({ resumeId: 'r1', userId: 'u1', userName: 'A', content: '  Hello  ' });

            expect(query.mock.calls[0][1][3]).toBe('Hello');
        });

        it('should throw if required fields missing', async () => {
            await expect(addComment({ resumeId: 'r1', userId: 'u1', content: '' })).rejects.toThrow('required');
            await expect(addComment({ resumeId: null, userId: 'u1', content: 'x' })).rejects.toThrow('required');
        });

        it('should support private comments', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'c1', is_private: true }] });

            await addComment({ resumeId: 'r1', userId: 'u1', userName: 'A', content: 'Private', isPrivate: true });

            expect(query.mock.calls[0][1][4]).toBe(true);
        });
    });

    describe('getComments', () => {
        it('should return non-private + own private comments', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'c1' }, { id: 'c2' }] });

            const result = await getComments('r1', 'u1');

            expect(result).toHaveLength(2);
            expect(query.mock.calls[0][0]).toContain('is_private = FALSE OR user_id = $2');
        });

        it('should throw if resumeId missing', async () => {
            await expect(getComments(null)).rejects.toThrow('Resume ID is required');
        });
    });

    describe('updateComment', () => {
        it('should update comment owned by user', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'c1', content: 'Updated' }] });

            const result = await updateComment('c1', 'u1', 'Updated');

            expect(result.content).toBe('Updated');
            expect(query.mock.calls[0][0]).toContain('WHERE id = $2 AND user_id = $3');
        });

        it('should return null if not found or not owner', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await updateComment('c1', 'u2', 'X')).toBeNull();
        });

        it('should throw if required fields missing', async () => {
            await expect(updateComment('c1', 'u1', '')).rejects.toThrow('required');
        });
    });

    describe('deleteComment', () => {
        it('should delete own comment', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });

            expect(await deleteComment('c1', 'u1')).toBe(true);
            expect(query.mock.calls[0][0]).toContain('WHERE id = $1 AND user_id = $2');
        });

        it('should allow admin to delete any comment', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });

            expect(await deleteComment('c1', 'u1', true)).toBe(true);
            expect(query.mock.calls[0][0]).toContain('WHERE id = $1');
            expect(query.mock.calls[0][0]).not.toContain('user_id');
        });

        it('should return false if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await deleteComment('c1', 'u1')).toBe(false);
        });

        it('should throw if required fields missing', async () => {
            await expect(deleteComment(null, 'u1')).rejects.toThrow('required');
        });
    });

    describe('getCommentCount', () => {
        it('should return count', async () => {
            query.mockResolvedValueOnce({ rows: [{ count: '5' }] });
            expect(await getCommentCount('r1', 'u1')).toBe(5);
        });
    });

    describe('getRecentComments', () => {
        it('should return recent comments with resume info', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'c1', candidate_name: 'CV' }] });

            const result = await getRecentComments('u1', 10);

            expect(result).toHaveLength(1);
            expect(query.mock.calls[0][0]).toContain('JOIN resumes r');
        });

        it('should use default limit', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getRecentComments('u1');

            expect(query.mock.calls[0][1][1]).toBe(10);
        });
    });
});
