/**
 * Tests for routeHelpers utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    sendSuccess,
    sendError,
    sendPaginated,
    parsePagination,
    parseSort,
    parseFilters,
    buildWhereClause,
    getUserContext,
    canAccessResource,
    sendNotFound,
    sendForbidden,
    sendUnauthorized,
    sendValidationError
} from '../../src/utils/routeHelpers.js';

// Mock logger
vi.mock('../../src/utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

describe('routeHelpers', () => {
    let mockRes;

    beforeEach(() => {
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };
    });

    describe('sendSuccess', () => {
        it('should send success response with default status 200', () => {
            const data = { id: 1, name: 'Test' };
            sendSuccess(mockRes, data);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data
            });
        });

        it('should send success response with custom status', () => {
            const data = { id: 1 };
            sendSuccess(mockRes, data, 201);

            expect(mockRes.status).toHaveBeenCalledWith(201);
        });
    });

    describe('sendError', () => {
        it('should send error response with default status 500', () => {
            sendError(mockRes, 'Something went wrong');

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Something went wrong',
                statusCode: 500
            });
        });

        it('should send error response with custom status', () => {
            sendError(mockRes, 'Not found', 404);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Not found',
                statusCode: 404
            });
        });

        it('should include details in development mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            sendError(mockRes, 'Error', 500, 'Stack trace here');

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                details: 'Stack trace here'
            }));

            process.env.NODE_ENV = originalEnv;
        });

        it('should not include details in production mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            sendError(mockRes, 'Error', 500, 'Stack trace here');

            const jsonCall = mockRes.json.mock.calls[0][0];
            expect(jsonCall.details).toBeUndefined();

            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('sendPaginated', () => {
        it('should send paginated response with correct structure', () => {
            const data = [{ id: 1 }, { id: 2 }];
            const pagination = { page: 1, pageSize: 10, total: 25 };

            sendPaginated(mockRes, data, pagination);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data,
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 25,
                    totalPages: 3,
                    hasMore: true
                }
            });
        });

        it('should calculate hasMore correctly for last page', () => {
            const data = [{ id: 1 }];
            const pagination = { page: 3, pageSize: 10, total: 25 };

            sendPaginated(mockRes, data, pagination);

            const jsonCall = mockRes.json.mock.calls[0][0];
            expect(jsonCall.pagination.hasMore).toBe(false);
        });
    });

    describe('parsePagination', () => {
        it('should parse pagination with defaults', () => {
            const result = parsePagination({});

            expect(result).toEqual({
                page: 1,
                pageSize: 20,
                offset: 0
            });
        });

        it('should parse pagination from query', () => {
            const result = parsePagination({ page: '2', pageSize: '50' });

            expect(result).toEqual({
                page: 2,
                pageSize: 50,
                offset: 50
            });
        });

        it('should use limit as alias for pageSize', () => {
            const result = parsePagination({ page: '1', limit: '30' });

            expect(result.pageSize).toBe(30);
        });

        it('should enforce minimum page of 1', () => {
            const result = parsePagination({ page: '-5' });

            expect(result.page).toBe(1);
        });

        it('should enforce maximum pageSize', () => {
            const result = parsePagination({ pageSize: '500' });

            expect(result.pageSize).toBe(100);
        });

        it('should use custom defaults', () => {
            const result = parsePagination({}, { page: 1, pageSize: 50, maxPageSize: 200 });

            expect(result.pageSize).toBe(50);
        });
    });

    describe('parseSort', () => {
        it('should return default sort options', () => {
            const result = parseSort({});

            expect(result).toEqual({
                column: 'created_at',
                direction: 'DESC',
                sql: 'created_at DESC'
            });
        });

        it('should parse sortBy and sortDir', () => {
            const result = parseSort({ sortBy: 'name', sortDir: 'asc' });

            expect(result).toEqual({
                column: 'name',
                direction: 'ASC',
                sql: 'name ASC'
            });
        });

        it('should use sort and order as aliases', () => {
            const result = parseSort({ sort: 'updated_at', order: 'desc' });

            expect(result.column).toBe('updated_at');
            expect(result.direction).toBe('DESC');
        });

        it('should reject invalid columns (SQL injection protection)', () => {
            const result = parseSort({ sortBy: 'DROP TABLE users;--' });

            expect(result.column).toBe('created_at'); // Falls back to default
        });

        it('should reject invalid directions', () => {
            const result = parseSort({ sortDir: 'INVALID' });

            expect(result.direction).toBe('DESC'); // Falls back to default
        });

        it('should use custom allowed columns', () => {
            const result = parseSort(
                { sortBy: 'custom_field' },
                { allowedColumns: ['custom_field', 'other_field'], defaultColumn: 'custom_field' }
            );

            expect(result.column).toBe('custom_field');
        });
    });

    describe('parseFilters', () => {
        it('should return empty conditions for empty query', () => {
            const result = parseFilters({}, {});

            expect(result).toEqual({ conditions: [], params: [] });
        });

        it('should parse simple equality filter', () => {
            const result = parseFilters(
                { status: 'active' },
                { status: { column: 'status', operator: '=' } }
            );

            expect(result.conditions).toEqual(['status = $1']);
            expect(result.params).toEqual(['active']);
        });

        it('should parse LIKE filter', () => {
            const result = parseFilters(
                { search: 'test' },
                { search: { column: 'name', operator: 'LIKE' } }
            );

            expect(result.conditions).toEqual(['name LIKE $1']);
            expect(result.params).toEqual(['%test%']);
        });

        it('should parse ILIKE filter', () => {
            const result = parseFilters(
                { search: 'Test' },
                { search: { column: 'name', operator: 'ILIKE' } }
            );

            expect(result.conditions).toEqual(['name ILIKE $1']);
            expect(result.params).toEqual(['%Test%']);
        });

        it('should parse IN filter with array', () => {
            const result = parseFilters(
                { status: ['active', 'pending'] },
                { status: { column: 'status', operator: 'IN' } }
            );

            expect(result.conditions).toEqual(['status IN ($1,$2)']);
            expect(result.params).toEqual(['active', 'pending']);
        });

        it('should parse IN filter with comma-separated string', () => {
            const result = parseFilters(
                { status: 'active,pending' },
                { status: { column: 'status', operator: 'IN' } }
            );

            expect(result.conditions).toEqual(['status IN ($1,$2)']);
            expect(result.params).toEqual(['active', 'pending']);
        });

        it('should skip empty values', () => {
            const result = parseFilters(
                { status: '', name: null, id: undefined },
                { 
                    status: { column: 'status' },
                    name: { column: 'name' },
                    id: { column: 'id' }
                }
            );

            expect(result.conditions).toEqual([]);
            expect(result.params).toEqual([]);
        });

        it('should parse comparison operators', () => {
            const result = parseFilters(
                { minPrice: '100', maxPrice: '500' },
                { 
                    minPrice: { column: 'price', operator: '>=' },
                    maxPrice: { column: 'price', operator: '<=' }
                }
            );

            expect(result.conditions).toEqual(['price >= $1', 'price <= $2']);
            expect(result.params).toEqual(['100', '500']);
        });
    });

    describe('buildWhereClause', () => {
        it('should return empty string for empty conditions', () => {
            const result = buildWhereClause([]);
            expect(result).toBe('');
        });

        it('should build WHERE clause with single condition', () => {
            const result = buildWhereClause(['status = $1']);
            expect(result).toBe('WHERE status = $1');
        });

        it('should build WHERE clause with multiple conditions', () => {
            const result = buildWhereClause(['status = $1', 'name LIKE $2']);
            expect(result).toBe('WHERE status = $1 AND name LIKE $2');
        });

        it('should use custom prefix', () => {
            const result = buildWhereClause(['status = $1'], 'AND');
            expect(result).toBe('AND status = $1');
        });
    });

    describe('getUserContext', () => {
        it('should extract user context from request', () => {
            const req = {
                user: {
                    id: '123',
                    email: 'test@example.com',
                    role: 'admin',
                    customer: 'Acme Corp'
                }
            };

            const result = getUserContext(req);

            expect(result).toEqual({
                userId: '123',
                email: 'test@example.com',
                role: 'admin',
                customer: 'Acme Corp',
                isAdmin: true
            });
        });

        it('should handle missing user', () => {
            const req = {};

            const result = getUserContext(req);

            expect(result).toEqual({
                userId: undefined,
                email: undefined,
                role: undefined,
                customer: undefined,
                isAdmin: false
            });
        });

        it('should detect admin role case-insensitively', () => {
            const req = { user: { role: 'ADMIN' } };
            expect(getUserContext(req).isAdmin).toBe(true);

            const req2 = { user: { role: 'Admin' } };
            expect(getUserContext(req2).isAdmin).toBe(true);
        });
    });

    describe('canAccessResource', () => {
        it('should allow admin to access any resource', () => {
            const req = { user: { role: 'admin', customer: 'Company A' } };
            expect(canAccessResource(req, 'Company B')).toBe(true);
        });

        it('should allow user to access own customer resources', () => {
            const req = { user: { role: 'user', customer: 'Company A' } };
            expect(canAccessResource(req, 'Company A')).toBe(true);
        });

        it('should deny user access to other customer resources', () => {
            const req = { user: { role: 'user', customer: 'Company A' } };
            expect(canAccessResource(req, 'Company B')).toBe(false);
        });

        it('should deny access if user has no customer', () => {
            const req = { user: { role: 'user' } };
            expect(canAccessResource(req, 'Company A')).toBe(false);
        });
    });

    describe('error response helpers', () => {
        it('sendNotFound should send 404 response', () => {
            sendNotFound(mockRes, 'User');

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'User not found'
            }));
        });

        it('sendForbidden should send 403 response', () => {
            sendForbidden(mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Access denied'
            }));
        });

        it('sendForbidden should accept custom message', () => {
            sendForbidden(mockRes, 'Custom forbidden message');

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Custom forbidden message'
            }));
        });

        it('sendUnauthorized should send 401 response', () => {
            sendUnauthorized(mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Authentication required'
            }));
        });

        it('sendValidationError should send 400 response with details', () => {
            const errors = [{ field: 'email', message: 'Invalid email' }];
            sendValidationError(mockRes, errors);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Validation failed',
                statusCode: 400,
                details: errors
            });
        });
    });
});
