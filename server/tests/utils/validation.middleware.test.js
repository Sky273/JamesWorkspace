/**
 * Tests for validation.js middleware and utility functions
 */

import { describe, it, expect, vi } from 'vitest';

const mockSafeLog = vi.fn();
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: (...args) => mockSafeLog(...args)
}));

import {
    validateBody,
    validateParams,
    validateQuery,
    isValidId,
    isValidEmail,
    sanitizeText,
    validators,
    signInSchema,
    registerSchema,
    createUserSchema,
    createMissionSchema,
    createTemplateSchema,
    createFirmSchema,
    restoreBackupSchema
} from '../../utils/validation.js';

describe('Validation Middleware', () => {

    describe('validateBody', () => {
        it('should pass valid data through', () => {
            const schema = signInSchema;
            const middleware = validateBody(schema);
            
            const req = {
                body: { email: 'test@example.com', password: 'password123' },
                path: '/test'
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should reject invalid email', () => {
            const schema = signInSchema;
            const middleware = validateBody(schema);
            
            const req = {
                body: { email: 'invalid-email', password: 'password123' },
                path: '/test'
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalled();
            expect(next).not.toHaveBeenCalled();
        });

        it('should reject short password', () => {
            const schema = signInSchema;
            const middleware = validateBody(schema);
            
            const req = {
                body: { email: 'test@example.com', password: 'short' },
                path: '/test'
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(next).not.toHaveBeenCalled();
        });

        it('should accept optional totpCode', () => {
            const schema = signInSchema;
            const middleware = validateBody(schema);
            
            const req = {
                body: { 
                    email: 'test@example.com', 
                    password: 'password123',
                    totpCode: '123456'
                },
                path: '/test'
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.body.totpCode).toBe('123456');
        });

        it('should redact sensitive values in validation logs', () => {
            const schema = signInSchema;
            const middleware = validateBody(schema);
            const req = {
                body: { email: 'invalid-email', password: 'secret-password', totpCode: '123456' },
                path: '/api/auth/signin'
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalled();
            expect(mockSafeLog).toHaveBeenCalledWith(
                'error',
                'Request validation failed',
                expect.objectContaining({
                    requestBodySummary: expect.objectContaining({
                        type: 'object'
                    })
                })
            );
            const logPayload = mockSafeLog.mock.calls.at(-1)?.[2];
            expect(logPayload.bodyPreview).toBeUndefined();
        });
    });

    describe('validateParams', () => {
        it('should pass when required param exists', () => {
            const middleware = validateParams('id');
            
            const req = {
                params: { id: '550e8400-e29b-41d4-a716-446655440000' }
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should reject missing required param', () => {
            const middleware = validateParams('id');
            
            const req = {
                params: {}
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(next).not.toHaveBeenCalled();
        });

        it('should reject invalid UUID format for id param', () => {
            const middleware = validateParams('id');
            
            const req = {
                params: { id: 'invalid-id' }
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(next).not.toHaveBeenCalled();
        });

    });

    describe('validateQuery', () => {
        it('should validate query parameters', () => {
            const schema = {
                page: validators.positiveInteger,
                limit: validators.positiveInteger
            };
            const middleware = validateQuery(schema);
            
            const req = {
                query: { page: '1', limit: '10' }
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.validatedQuery.page).toBe(1);
            expect(req.validatedQuery.limit).toBe(10);
        });

        it('should reject invalid query parameters', () => {
            const schema = {
                page: validators.positiveInteger
            };
            const middleware = validateQuery(schema);
            
            const req = {
                query: { page: 'invalid' }
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(next).not.toHaveBeenCalled();
        });
    });
});

describe('Validation Utility Functions', () => {

    describe('isValidId', () => {
        it('should accept valid UUID', () => {
            expect(isValidId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        });

        it('should reject invalid format', () => {
            expect(isValidId('invalid')).toBe(false);
            expect(isValidId('recABCDEFGHIJKLMN')).toBe(false);
            expect(isValidId('')).toBe(false);
        });

        it('should reject null and undefined', () => {
            expect(isValidId(null)).toBe(false);
            expect(isValidId(undefined)).toBe(false);
        });
    });

    describe('isValidEmail', () => {
        it('should accept valid emails', () => {
            expect(isValidEmail('test@example.com')).toBe(true);
            expect(isValidEmail('user.name@domain.org')).toBe(true);
            expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
        });

        it('should reject invalid emails', () => {
            expect(isValidEmail('invalid')).toBe(false);
            expect(isValidEmail('no@domain')).toBe(false);
            expect(isValidEmail('@nodomain.com')).toBe(false);
            expect(isValidEmail('spaces in@email.com')).toBe(false);
        });
    });

    describe('sanitizeText', () => {
        it('should trim whitespace', () => {
            expect(sanitizeText('  hello  ')).toBe('hello');
        });

        it('should handle non-string input', () => {
            expect(sanitizeText(null)).toBe('');
            expect(sanitizeText(undefined)).toBe('');
            expect(sanitizeText(123)).toBe('');
        });

        it('should truncate long text', () => {
            const longText = 'a'.repeat(200000);
            const result = sanitizeText(longText);
            expect(result.length).toBeLessThan(longText.length);
        });
    });
});

describe('Validators', () => {

    describe('positiveInteger', () => {
        it('should accept positive integers', () => {
            expect(validators.positiveInteger('5')).toEqual({ valid: true, value: 5 });
            expect(validators.positiveInteger('0')).toEqual({ valid: true, value: 0 });
            expect(validators.positiveInteger('100')).toEqual({ valid: true, value: 100 });
        });

        it('should reject negative numbers', () => {
            const result = validators.positiveInteger('-5');
            expect(result.valid).toBe(false);
        });

        it('should reject non-numeric strings', () => {
            const result = validators.positiveInteger('abc');
            expect(result.valid).toBe(false);
        });
    });

    describe('maxLength', () => {
        it('should accept strings within limit', () => {
            const validator = validators.maxLength(10);
            expect(validator('hello').valid).toBe(true);
        });

        it('should reject strings exceeding limit', () => {
            const validator = validators.maxLength(5);
            expect(validator('hello world').valid).toBe(false);
        });

        it('should reject non-strings', () => {
            const validator = validators.maxLength(10);
            expect(validator(123).valid).toBe(false);
        });
    });

    describe('enum', () => {
        it('should accept allowed values', () => {
            const validator = validators.enum(['active', 'inactive']);
            expect(validator('active').valid).toBe(true);
            expect(validator('inactive').valid).toBe(true);
        });

        it('should reject disallowed values', () => {
            const validator = validators.enum(['active', 'inactive']);
            expect(validator('pending').valid).toBe(false);
        });
    });
});

describe('Zod Schemas', () => {

    describe('registerSchema', () => {
        it('should accept valid registration data', () => {
            const data = {
                email: 'test@example.com',
                password: 'password123',
                name: 'John Doe'
            };
            expect(() => registerSchema.parse(data)).not.toThrow();
        });

        it('should reject missing name', () => {
            const data = {
                email: 'test@example.com',
                password: 'password123'
            };
            expect(() => registerSchema.parse(data)).toThrow();
        });
    });

    describe('createUserSchema', () => {
        it('should accept valid user data', () => {
            const data = {
                email: 'test@example.com',
                password: 'password123',
                name: 'John Doe',
                role: 'user',
                firm: 'Acme Corp'
            };
            expect(() => createUserSchema.parse(data)).not.toThrow();
        });

        it('should accept admin role', () => {
            const data = {
                email: 'admin@example.com',
                password: 'password123',
                name: 'Admin User',
                role: 'admin',
                firm: 'Acme Corp'
            };
            expect(() => createUserSchema.parse(data)).not.toThrow();
        });
    });

    describe('createMissionSchema', () => {
        it('should accept valid mission data', () => {
            const data = {
                Title: 'Test Mission',
                Content: 'Mission description',
                Status: 'Active'
            };
            expect(() => createMissionSchema.parse(data)).not.toThrow();
        });

        it('should reject missing title', () => {
            const data = {
                Content: 'Mission description'
            };
            expect(() => createMissionSchema.parse(data)).toThrow();
        });
    });

    describe('createTemplateSchema', () => {
        it('should accept valid template data', () => {
            const data = {
                Name: 'Test Template',
                TemplateContent: '<html>Template</html>',
                Status: 'Active'
            };
            expect(() => createTemplateSchema.parse(data)).not.toThrow();
        });

        it('should reject missing template content', () => {
            const data = {
                Name: 'Test Template'
            };
            expect(() => createTemplateSchema.parse(data)).toThrow();
        });
    });

    describe('createFirmSchema', () => {
        it('should accept valid firm data', () => {
            const data = {
                name: 'Test Firm'
            };
            expect(() => createFirmSchema.parse(data)).not.toThrow();
        });

        it('should reject empty name', () => {
            const data = {
                name: ''
            };
            expect(() => createFirmSchema.parse(data)).toThrow();
        });
    });

    describe('restoreBackupSchema', () => {
        it('should accept a safe backup filename', () => {
            expect(() => restoreBackupSchema.parse({
                filename: 'backup-daily-testdb-2026-03-31T10-30-00.sql.gz',
                confirmText: 'RESTORE'
            })).not.toThrow();
        });

        it('should reject unsafe backup filenames', () => {
            expect(() => restoreBackupSchema.parse({
                filename: '../backup.sql.gz',
                confirmText: 'RESTORE'
            })).toThrow();
        });

        it('should reject missing confirmation text', () => {
            expect(() => restoreBackupSchema.parse({
                filename: 'backup-daily-testdb-2026-03-31T10-30-00.sql.gz'
            })).toThrow();
        });
    });
});
