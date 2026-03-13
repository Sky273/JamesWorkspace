/**
 * Tests for postgresHelpers.js
 * PostgreSQL helper functions for database operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';


// Mock dependencies - must use inline functions, not external variables
vi.mock('../../config/database.js', () => {
    const client = {
        query: vi.fn(),
        release: vi.fn()
    };
    return {
        pool: {
            connect: vi.fn().mockResolvedValue(client)
        },
        getClientWithRetry: vi.fn().mockImplementation(() => Promise.resolve(client)),
        __mockClient: client
    };
});

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

import { safeLog } from '../../utils/logger.backend.js';
import { getClientWithRetry, __mockClient } from '../../config/database.js';
import {
    selectWithTimeout,
    findWithTimeout,
    createWithTimeout,
    updateWithTimeout,
    destroyWithTimeout,
    fetchPaginatedRecords,
    transaction,
    buildWhereClause,
    escapeLike,
    airtableToPostgres,
    postgrestoAirtable,
    validatePromptSize
} from '../../utils/postgresHelpers.js';

describe('postgresHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __mockClient.query.mockReset();
        __mockClient.release.mockReset();
    });

    describe('selectWithTimeout', () => {
        it('should execute SELECT query with valid table', async () => {
            __mockClient.query.mockResolvedValueOnce({}); // SET statement_timeout
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '1', name: 'Test' }] });

            const result = await selectWithTimeout('firms', {});

            expect(result).toEqual([{ id: '1', name: 'Test' }]);
            expect(__mockClient.release).toHaveBeenCalled();
        });

        it('should throw error for invalid table name', async () => {
            await expect(selectWithTimeout('invalid_table', {}))
                .rejects.toThrow('Invalid table name');
        });

        it('should throw error for SQL injection attempt', async () => {
            await expect(selectWithTimeout('firms; DROP TABLE users;--', {}))
                .rejects.toThrow('Invalid table name');
            
            expect(safeLog).toHaveBeenCalledWith('error', expect.stringContaining('SQL Injection'), expect.any(Object));
        });

        it('should apply WHERE clause', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [] });

            await selectWithTimeout('firms', { where: 'id = $1', params: ['123'] });

            expect(__mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE id = $1'),
                ['123']
            );
        });

        it('should apply ORDER BY clause', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [] });

            await selectWithTimeout('firms', { orderBy: 'name ASC' });

            expect(__mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY name ASC'),
                []
            );
        });

        it('should apply LIMIT and OFFSET', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [] });

            await selectWithTimeout('firms', { limit: 10, offset: 20 });

            expect(__mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('LIMIT 10'),
                []
            );
            expect(__mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('OFFSET 20'),
                []
            );
        });

        it('should validate column names', async () => {
            await expect(selectWithTimeout('firms', { columns: ['name; DROP TABLE--'] }))
                .rejects.toThrow('Invalid column name');
        });

        it('should allow wildcard column', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [] });

            await selectWithTimeout('firms', { columns: ['*'] });

            expect(__mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT *'),
                []
            );
        });

        it('should support raw queries', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ count: 5 }] });

            const result = await selectWithTimeout('firms', {
                rawQuery: 'SELECT COUNT(*) as count FROM firms',
                rawParams: []
            });

            expect(result).toEqual([{ count: 5 }]);
        });
    });

    describe('findWithTimeout', () => {
        it('should find record by ID', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '123', name: 'Test Firm' }] });

            const result = await findWithTimeout('firms', '123');

            expect(result).toEqual({ id: '123', name: 'Test Firm' });
        });

        it('should throw 404 when record not found', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [] });

            await expect(findWithTimeout('firms', '999'))
                .rejects.toThrow('Record not found');
        });

        it('should support legacy timeout signature', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '123' }] });

            const result = await findWithTimeout('firms', '123', 5000);

            expect(result).toEqual({ id: '123' });
        });

        it('should support columns option', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '123', name: 'Test' }] });

            await findWithTimeout('firms', '123', { columns: ['id', 'name'] });

            expect(__mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT id, name'),
                ['123']
            );
        });
    });

    describe('createWithTimeout', () => {
        it('should create a single record', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '123', name: 'New Firm' }] });

            const result = await createWithTimeout('firms', { name: 'New Firm' });

            expect(result).toEqual({ id: '123', name: 'New Firm' });
        });

        it('should create multiple records', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '1', name: 'Firm 1' }] });
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '2', name: 'Firm 2' }] });

            const result = await createWithTimeout('firms', [
                { name: 'Firm 1' },
                { name: 'Firm 2' }
            ]);

            expect(result).toHaveLength(2);
        });

        it('should throw error for empty records array', async () => {
            await expect(createWithTimeout('firms', []))
                .rejects.toThrow('Records must be a non-empty array');
        });

        it('should serialize objects to JSON', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '1' }] });

            await createWithTimeout('firms', { name: 'Test', metadata: { key: 'value' } });

            expect(__mockClient.query).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([JSON.stringify({ key: 'value' })])
            );
        });

        it('should pass arrays directly for TEXT[] columns', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '1' }] });

            await createWithTimeout('resumes', { skills: ['JavaScript', 'Python'] });

            expect(__mockClient.query).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([['JavaScript', 'Python']])
            );
        });

        it('should support Airtable-style fields format', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '1' }] });

            await createWithTimeout('firms', { fields: { name: 'Test' } });

            expect(__mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO firms'),
                ['Test']
            );
        });
    });

    describe('updateWithTimeout', () => {
        it('should update record with simple format', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '123', name: 'Updated' }] });

            const result = await updateWithTimeout('firms', '123', { name: 'Updated' });

            expect(result).toEqual({ id: '123', name: 'Updated' });
        });

        it('should update records with array format', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '1' }] });
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '2' }] });

            const result = await updateWithTimeout('firms', [
                { id: '1', fields: { name: 'Firm 1' } },
                { id: '2', fields: { name: 'Firm 2' } }
            ]);

            expect(result).toHaveLength(2);
        });

        it('should throw error when record not found', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [] });

            await expect(updateWithTimeout('firms', '999', { name: 'Test' }))
                .rejects.toThrow('Record not found');
        });

        it('should throw error for empty records array', async () => {
            await expect(updateWithTimeout('firms', []))
                .rejects.toThrow('Records must be a non-empty array');
        });

        it('should throw error when record ID is missing', async () => {
            await expect(updateWithTimeout('firms', [{ fields: { name: 'Test' } }]))
                .rejects.toThrow('Record ID is required');
        });
    });

    describe('destroyWithTimeout', () => {
        it('should delete record by ID', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '123' }] });

            const result = await destroyWithTimeout('firms', '123');

            expect(result).toEqual(['123']);
        });

        it('should delete multiple records', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '1' }] });
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '2' }] });

            const result = await destroyWithTimeout('firms', ['1', '2']);

            expect(result).toEqual(['1', '2']);
        });

        it('should throw error when record not found', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [] });

            await expect(destroyWithTimeout('firms', '999'))
                .rejects.toThrow('Record not found');
        });

        it('should throw error for empty IDs array', async () => {
            await expect(destroyWithTimeout('firms', []))
                .rejects.toThrow('IDs must be a non-empty array');
        });
    });

    describe('fetchPaginatedRecords', () => {
        it('should fetch paginated records', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ id: '1' }, { id: '2' }] });
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });

            const result = await fetchPaginatedRecords('firms', { pageSize: 10 });

            expect(result.records).toHaveLength(2);
            expect(result.hasMore).toBe(false);
            expect(result.totalCount).toBe(10);
        });

        it('should detect hasMore when more records exist', async () => {
            const records = Array(11).fill(null).map((_, i) => ({ id: String(i) }));
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: records });
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ count: '100' }] });

            const result = await fetchPaginatedRecords('firms', { pageSize: 10 });

            expect(result.records).toHaveLength(10);
            expect(result.hasMore).toBe(true);
        });

        it('should apply sort configuration', async () => {
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [] });
            __mockClient.query.mockResolvedValueOnce({});
            __mockClient.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

            await fetchPaginatedRecords('firms', {
                sort: [{ field: 'name', direction: 'ASC' }]
            });

            expect(__mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY name ASC'),
                []
            );
        });

        it('should validate sort field names', async () => {
            await expect(fetchPaginatedRecords('firms', {
                sort: [{ field: 'name; DROP TABLE--', direction: 'ASC' }]
            })).rejects.toThrow('Invalid column name');
        });
    });

    describe('transaction', () => {
        it('should commit on success', async () => {
            __mockClient.query.mockResolvedValue({});

            const result = await transaction(async (client) => {
                await client.query('SELECT 1');
                return 'success';
            });

            expect(result).toBe('success');
            expect(__mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(__mockClient.query).toHaveBeenCalledWith('COMMIT');
            expect(__mockClient.release).toHaveBeenCalled();
        });

        it('should rollback on error', async () => {
            __mockClient.query.mockImplementation((sql) => {
                if (sql === 'FAIL') throw new Error('Query failed');
                return {};
            });

            await expect(transaction(async (client) => {
                await client.query('FAIL');
            })).rejects.toThrow('Query failed');

            expect(__mockClient.query).toHaveBeenCalledWith('ROLLBACK');
            expect(__mockClient.release).toHaveBeenCalled();
        });
    });

    describe('buildWhereClause', () => {
        it('should build WHERE clause from filters', () => {
            const result = buildWhereClause({ name: 'Test', status: 'active' });

            expect(result.where).toBe('name = $1 AND status = $2');
            expect(result.params).toEqual(['Test', 'active']);
        });

        it('should skip null and undefined values', () => {
            const result = buildWhereClause({ name: 'Test', status: null, type: undefined });

            expect(result.where).toBe('name = $1');
            expect(result.params).toEqual(['Test']);
        });

        it('should return empty string for empty filters', () => {
            const result = buildWhereClause({});

            expect(result.where).toBe('');
            expect(result.params).toEqual([]);
        });

        it('should support custom start index', () => {
            const result = buildWhereClause({ name: 'Test' }, 5);

            expect(result.where).toBe('name = $5');
        });

        it('should validate column names', () => {
            expect(() => buildWhereClause({ 'name; DROP TABLE--': 'Test' }))
                .toThrow('Invalid column name');
        });
    });

    describe('escapeLike', () => {
        it('should escape percent sign', () => {
            expect(escapeLike('100%')).toBe('100\\%');
        });

        it('should escape underscore', () => {
            expect(escapeLike('test_value')).toBe('test\\_value');
        });

        it('should escape backslash', () => {
            expect(escapeLike('path\\to\\file')).toBe('path\\\\to\\\\file');
        });

        it('should escape multiple special characters', () => {
            expect(escapeLike('50%_test\\path')).toBe('50\\%\\_test\\\\path');
        });

        it('should return unchanged string without special chars', () => {
            expect(escapeLike('normal text')).toBe('normal text');
        });
    });

    describe('airtableToPostgres', () => {
        it('should convert Airtable record to PostgreSQL format', () => {
            const airtableRecord = {
                id: 'rec123',
                fields: { Name: 'Test', Status: 'active' }
            };

            const result = airtableToPostgres(airtableRecord);

            expect(result).toEqual({
                id: 'rec123',
                Name: 'Test',
                Status: 'active'
            });
        });

        it('should return as-is if already PostgreSQL format', () => {
            const pgRecord = { id: '123', name: 'Test' };

            const result = airtableToPostgres(pgRecord);

            expect(result).toEqual(pgRecord);
        });

        it('should return null for null input', () => {
            expect(airtableToPostgres(null)).toBeNull();
        });
    });

    describe('postgrestoAirtable', () => {
        it('should convert PostgreSQL row to Airtable format', () => {
            const pgRow = { id: '123', name: 'Test', status: 'active' };

            const result = postgrestoAirtable(pgRow);

            expect(result).toEqual({
                id: '123',
                fields: { name: 'Test', status: 'active' }
            });
        });

        it('should return null for null input', () => {
            expect(postgrestoAirtable(null)).toBeNull();
        });
    });

    describe('validatePromptSize', () => {
        it('should return valid for small prompt', () => {
            const result = validatePromptSize('Hello world');

            expect(result.valid).toBe(true);
            expect(result.estimatedTokens).toBeGreaterThan(0);
        });

        it('should return valid for null prompt', () => {
            const result = validatePromptSize(null);

            expect(result.valid).toBe(true);
            expect(result.estimatedTokens).toBe(0);
        });

        it('should return invalid for oversized prompt', () => {
            const largePrompt = 'x'.repeat(600000); // ~150k tokens

            const result = validatePromptSize(largePrompt, 128000);

            expect(result.valid).toBe(false);
            expect(result.message).toContain('Prompt too large');
        });

        it('should estimate tokens correctly', () => {
            const prompt = 'a'.repeat(400); // 400 chars ≈ 100 tokens

            const result = validatePromptSize(prompt);

            expect(result.estimatedTokens).toBe(100);
        });

        it('should use custom maxTokens', () => {
            const prompt = 'a'.repeat(100); // ~25 tokens

            const result = validatePromptSize(prompt, 10);

            expect(result.valid).toBe(false);
        });
    });
});
