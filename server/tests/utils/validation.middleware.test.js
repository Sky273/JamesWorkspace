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
    normalizeRequestBodyAliases,
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
    createPipelineEntrySchema,
    batchExportSchema,
    batchImproveSchema,
    batchDealExportSchema,
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

        it('should normalize common alias keys before validation', () => {
            const middleware = validateBody(createUserSchema);
            const req = {
                body: {
                    email: 'test@example.com',
                    password: 'password123',
                    name: 'Test User',
                    job_title: 'Consultant',
                    'Firm ID': '123e4567-e89b-12d3-a456-426614174000'
                },
                path: '/api/auth/users'
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.body.jobTitle).toBe('Consultant');
            expect(req.body.firmId).toBe('123e4567-e89b-12d3-a456-426614174000');
            expect(req.body.job_title).toBeUndefined();
            expect(req.body['Firm ID']).toBeUndefined();
        });

        it('should keep legacy mission payloads compatible through middleware normalization', () => {
            const middleware = validateBody(createMissionSchema);
            const req = {
                body: {
                    Title: 'Legacy Mission',
                    Content: 'Description',
                    Status: 'Active',
                    client_id: '123e4567-e89b-12d3-a456-426614174000',
                    required_skills: ['React']
                },
                path: '/api/missions'
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.body).toMatchObject({
                title: 'Legacy Mission',
                content: 'Description',
                status: 'Active',
                clientId: '123e4567-e89b-12d3-a456-426614174000',
                requiredSkills: ['React']
            });
        });

        it('should keep legacy template payloads compatible through middleware normalization', () => {
            const middleware = validateBody(createTemplateSchema);
            const req = {
                body: {
                    Name: 'Legacy Template',
                    TemplateContent: '<main>Legacy</main>',
                    Status: 'Active'
                },
                path: '/api/templates'
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.body).toMatchObject({
                name: 'Legacy Template',
                templateContent: '<main>Legacy</main>',
                status: 'active'
            });
        });

        it('should keep legacy pipeline payloads compatible through middleware normalization', () => {
            const middleware = validateBody(createPipelineEntrySchema);
            const req = {
                body: {
                    resume_id: '123e4567-e89b-12d3-a456-426614174000',
                    mission_id: '123e4567-e89b-12d3-a456-426614174001',
                    client_id: '123e4567-e89b-12d3-a456-426614174002',
                    Notes: 'Legacy notes'
                },
                path: '/api/pipeline'
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.body).toMatchObject({
                resumeId: '123e4567-e89b-12d3-a456-426614174000',
                missionId: '123e4567-e89b-12d3-a456-426614174001',
                clientId: '123e4567-e89b-12d3-a456-426614174002',
                notes: 'Legacy notes'
            });
        });

        it('should keep legacy batch export payloads compatible through middleware normalization', () => {
            const middleware = validateBody(batchExportSchema);
            const req = {
                body: {
                    resume_ids: ['123e4567-e89b-12d3-a456-426614174000'],
                    template_id: '123e4567-e89b-12d3-a456-426614174001',
                    export_format: 'pdf'
                },
                path: '/api/batch/export'
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.body).toMatchObject({
                resumeIds: ['123e4567-e89b-12d3-a456-426614174000'],
                templateId: '123e4567-e89b-12d3-a456-426614174001'
            });
        });

        it('should keep legacy batch improve payloads compatible through middleware normalization', () => {
            const middleware = validateBody(batchImproveSchema);
            const req = {
                body: {
                    resume_ids: ['123e4567-e89b-12d3-a456-426614174000'],
                    firm_id: 'firm-123'
                },
                path: '/api/batch/improve'
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.body).toMatchObject({
                resumeIds: ['123e4567-e89b-12d3-a456-426614174000'],
                firmId: 'firm-123'
            });
        });

        it('should keep legacy batch deal export payloads compatible through middleware normalization', () => {
            const middleware = validateBody(batchDealExportSchema);
            const req = {
                body: {
                    deal_id: '123e4567-e89b-12d3-a456-426614174000',
                    template_id: '123e4567-e89b-12d3-a456-426614174001',
                    export_formats: ['pdf']
                },
                path: '/api/batch/deals/export'
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.body).toMatchObject({
                dealId: '123e4567-e89b-12d3-a456-426614174000',
                templateId: '123e4567-e89b-12d3-a456-426614174001',
                exportFormats: ['pdf']
            });
        });
    });

    describe('normalizeRequestBodyAliases', () => {
        it('should normalize nested objects and arrays without touching unrelated keys', () => {
            const normalized = normalizeRequestBodyAliases({
                mission_id: 'm1',
                nested: {
                    adapted_title: 'PM',
                    untouched: 'ok'
                },
                items: [
                    { resume_id: 'r1' },
                    { adaptation_id: 'a1' }
                ]
            });

            expect(normalized).toEqual({
                missionId: 'm1',
                nested: {
                    adaptedTitle: 'PM',
                    untouched: 'ok'
                },
                items: [
                    { resumeId: 'r1' },
                    { adaptationId: 'a1' }
                ]
            });
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
                name: 'John Doe',
                website: '',
                formRenderedAt: Date.now()
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

        it('should reject registration payloads without form timing metadata', () => {
            const data = {
                email: 'test@example.com',
                password: 'password123',
                name: 'John Doe',
                website: ''
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
                firmId: '123e4567-e89b-12d3-a456-426614174000'
            };
            expect(() => createUserSchema.parse(data)).not.toThrow();
        });

        it('should accept admin role', () => {
            const data = {
                email: 'admin@example.com',
                password: 'password123',
                name: 'Admin User',
                role: 'admin',
                firmId: '123e4567-e89b-12d3-a456-426614174000'
            };
            expect(() => createUserSchema.parse(data)).not.toThrow();
        });
    });

    describe('createMissionSchema', () => {
        it('should accept valid mission data', () => {
            const data = {
                title: 'Test Mission',
                content: 'Mission description',
                status: 'Active'
            };
            expect(() => createMissionSchema.parse(data)).not.toThrow();
        });

        it('should reject missing title', () => {
            const data = {
                content: 'Mission description'
            };
            expect(() => createMissionSchema.parse(data)).toThrow();
        });
    });

    describe('createTemplateSchema', () => {
        it('should accept valid template data', () => {
            const data = {
                name: 'Test Template',
                templateContent: '<html>Template</html>',
                status: 'Active'
            };
            expect(() => createTemplateSchema.parse(data)).not.toThrow();
        });

        it('should reject missing template content', () => {
            const data = {
                name: 'Test Template'
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
