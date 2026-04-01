/**
 * Tests for Zod validation schemas
 */

import { describe, it, expect, vi } from 'vitest';
import {
    openaiRequestSchema,
    anthropicRequestSchema,
    chatbotRequestSchema,
    updateResumeSchema,
    createMissionSchema,
    updateMissionSchema,
    createTemplateSchema,
    updateTemplateSchema,
    createDealSchema,
    updateDealSchema,
    createSubmissionSchema,
    updateSubmissionSchema,
    createClientSchema,
    createContactSchema,
    updateContactSchema,
    createUserSchema,
    updateAdminUserSchema,
    createPipelineEntrySchema,
    updateUserProfileSchema,
    batchImproveSchema,
    batchDealExportSchema,
    batchExportSchema,
    createMailDraftSchema,
    initializeConsentSchema,
    escoRecalculateSchema,
    updateAdaptationSchema,
    validateBody
} from '../../utils/validation.js';

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

describe('Zod Validation Schemas', () => {
    describe('openaiRequestSchema', () => {
        it('should validate a valid OpenAI request', () => {
            const validRequest = {
                messages: [
                    { role: 'system', content: 'You are a helpful assistant' },
                    { role: 'user', content: 'Hello!' }
                ],
                model: 'gpt-4o',
                temperature: 0.7
            };

            const result = openaiRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
        });

        it('should reject request without messages', () => {
            const invalidRequest = {
                model: 'gpt-4o'
            };

            const result = openaiRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should reject empty messages array', () => {
            const invalidRequest = {
                messages: []
            };

            const result = openaiRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should reject invalid message role', () => {
            const invalidRequest = {
                messages: [
                    { role: 'invalid', content: 'Hello' }
                ]
            };

            const result = openaiRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should reject temperature out of range', () => {
            const invalidRequest = {
                messages: [{ role: 'user', content: 'Hello' }],
                temperature: 3.0
            };

            const result = openaiRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should accept valid temperature range', () => {
            const validRequest = {
                messages: [{ role: 'user', content: 'Hello' }],
                temperature: 0
            };

            const result = openaiRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);

            const validRequest2 = {
                messages: [{ role: 'user', content: 'Hello' }],
                temperature: 2
            };

            const result2 = openaiRequestSchema.safeParse(validRequest2);
            expect(result2.success).toBe(true);
        });

        it('should reject negative max_tokens', () => {
            const invalidRequest = {
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: -100
            };

            const result = openaiRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should accept optional fields', () => {
            const minimalRequest = {
                messages: [{ role: 'user', content: 'Hello' }]
            };

            const result = openaiRequestSchema.safeParse(minimalRequest);
            expect(result.success).toBe(true);
        });
    });

    describe('anthropicRequestSchema', () => {
        it('should validate a valid Anthropic request', () => {
            const validRequest = {
                messages: [
                    { role: 'user', content: 'Hello!' }
                ],
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1000
            };

            const result = anthropicRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
        });

        it('should reject request without messages', () => {
            const invalidRequest = {
                model: 'claude-3-5-sonnet-20241022'
            };

            const result = anthropicRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should accept system message', () => {
            const validRequest = {
                messages: [{ role: 'user', content: 'Hello' }],
                system: 'You are a helpful assistant'
            };

            const result = anthropicRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
        });

        it('should accept structured Anthropic content blocks', () => {
            const validRequest = {
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Hello' },
                        { type: 'thinking', thinking: 'Internal reasoning' }
                    ]
                }],
                system: [{ type: 'text', text: 'You are a helpful assistant' }]
            };

            const result = anthropicRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
        });
    });

    describe('createMissionSchema', () => {
        it('should accept legacy mission payload', () => {
            const result = createMissionSchema.safeParse({
                Title: 'Legacy Mission',
                Content: 'Description',
                Status: 'Active'
            });

            expect(result.success).toBe(true);
        });

        it('should accept camelCase mission payload', () => {
            const result = createMissionSchema.safeParse({
                title: 'Modern Mission',
                content: 'Description',
                status: 'active',
                clientId: '123e4567-e89b-12d3-a456-426614174000',
                requiredSkills: ['React'],
                preferredSkills: ['Node.js']
            });

            expect(result.success).toBe(true);
        });
    });

    describe('updateMissionSchema', () => {
        it('should accept camelCase mission update payload', () => {
            const result = updateMissionSchema.safeParse({
                title: 'Updated Mission',
                status: 'closed',
                dealId: '123e4567-e89b-12d3-a456-426614174000',
                keywords: ['react']
            });

            expect(result.success).toBe(true);
        });
    });

    describe('createDealSchema', () => {
        it('should accept snake_case deal payload', () => {
            const result = createDealSchema.safeParse({
                title: 'Legacy Deal',
                client_id: '123e4567-e89b-12d3-a456-426614174000',
                status: 'open'
            });

            expect(result.success).toBe(true);
        });

        it('should accept camelCase deal payload', () => {
            const result = createDealSchema.safeParse({
                title: 'Modern Deal',
                clientId: '123e4567-e89b-12d3-a456-426614174000',
                contactId: '123e4567-e89b-12d3-a456-426614174001',
                expectedStartDate: '2026-03-23',
                budgetMin: 1000,
                budgetMax: 2000
            });

            expect(result.success).toBe(true);
        });
    });

    describe('updateDealSchema', () => {
        it('should accept camelCase deal update payload', () => {
            const result = updateDealSchema.safeParse({
                title: 'Updated Deal',
                clientId: '123e4567-e89b-12d3-a456-426614174000',
                expectedEndDate: '2026-03-30',
                budgetMax: 5000
            });

            expect(result.success).toBe(true);
        });
    });

    describe('initializeConsentSchema', () => {
        it('should accept snake_case consent initialization payload', () => {
            const result = initializeConsentSchema.safeParse({
                resume_id: '123e4567-e89b-12d3-a456-426614174000',
                profile_type: 'nominative',
                candidate_name: 'John Doe',
                candidate_email: 'john@example.com'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('escoRecalculateSchema', () => {
        it('should accept lang alias', () => {
            const result = escoRecalculateSchema.safeParse({ lang: 'en' });
            expect(result.success).toBe(true);
        });
    });

    describe('createUserSchema', () => {
        it('should accept admin user payload with legacy aliases', () => {
            const result = createUserSchema.safeParse({
                email: 'user@example.com',
                password: 'Password123!',
                name: 'New User',
                job_title: 'Engineer',
                Firm: 'Acme'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('updateAdminUserSchema', () => {
        it('should accept admin user update payload with legacy aliases', () => {
            const result = updateAdminUserSchema.safeParse({
                job_title: 'Director',
                Customer: 'Acme'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('batchExportSchema', () => {
        it('should accept snake_case batch export payload', () => {
            const result = batchExportSchema.safeParse({
                resume_ids: ['123e4567-e89b-12d3-a456-426614174000'],
                template_id: '123e4567-e89b-12d3-a456-426614174001',
                export_format: 'pdf'
            });

            expect(result.success).toBe(true);
        });

        it('should reject batch export payloads above the resume limit', () => {
            const tooManyResumeIds = Array.from({ length: 101 }, (_, index) => {
                return `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`;
            });

            const result = batchExportSchema.safeParse({
                resumeIds: tooManyResumeIds,
                templateId: '123e4567-e89b-12d3-a456-426614174001',
                format: 'pdf'
            });

            expect(result.success).toBe(false);
        });
    });

    describe('createMailDraftSchema', () => {
        it('should accept snake_case draft payload aliases', () => {
            const result = createMailDraftSchema.safeParse({
                to: 'client@example.com',
                subject: 'Hello',
                pdf_base64: 'ZmFrZQ==',
                pdf_filename: 'cv.pdf',
                resume_id: '123e4567-e89b-12d3-a456-426614174000',
                client_id: '123e4567-e89b-12d3-a456-426614174001',
                contact_id: '123e4567-e89b-12d3-a456-426614174002',
                template_id: '123e4567-e89b-12d3-a456-426614174003'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('batchImproveSchema', () => {
        it('should accept resume_ids and firmId', () => {
            const result = batchImproveSchema.safeParse({
                resume_ids: ['123e4567-e89b-12d3-a456-426614174000'],
                firmId: 'firm-123'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('batchDealExportSchema', () => {
        it('should accept snake_case deal export payload', () => {
            const result = batchDealExportSchema.safeParse({
                deal_id: '123e4567-e89b-12d3-a456-426614174000',
                template_id: '123e4567-e89b-12d3-a456-426614174001',
                export_formats: ['pdf']
            });

            expect(result.success).toBe(true);
        });
    });

    describe('createPipelineEntrySchema', () => {
        it('should accept camelCase pipeline payload', () => {
            const result = createPipelineEntrySchema.safeParse({
                resumeId: '123e4567-e89b-12d3-a456-426614174000',
                missionId: '123e4567-e89b-12d3-a456-426614174001',
                clientId: '123e4567-e89b-12d3-a456-426614174002',
                stage: 'new',
                notes: 'Initial pipeline entry'
            });

            expect(result.success).toBe(true);
        });

        it('should accept snake_case pipeline payload', () => {
            const result = createPipelineEntrySchema.safeParse({
                resume_id: '123e4567-e89b-12d3-a456-426614174000',
                mission_id: '123e4567-e89b-12d3-a456-426614174001',
                client_id: '123e4567-e89b-12d3-a456-426614174002',
                stage: 'screening'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('updateUserProfileSchema', () => {
        it('should accept camelCase firmId in user profile updates', () => {
            const result = updateUserProfileSchema.safeParse({
                jobTitle: 'Director',
                firmId: '123e4567-e89b-12d3-a456-426614174000'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('createClientSchema', () => {
        it('should accept client payload with firmId', () => {
            const result = createClientSchema.safeParse({
                name: 'Acme',
                type: 'client',
                firmId: '123e4567-e89b-12d3-a456-426614174000'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('createContactSchema', () => {
        it('should accept camelCase contact payload', () => {
            const result = createContactSchema.safeParse({
                name: 'Jane Doe',
                email: 'jane@example.com',
                jobTitle: 'HR Manager',
                isPrimary: true,
                role: 'Hiring Manager'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('updateContactSchema', () => {
        it('should accept camelCase contact update payload', () => {
            const result = updateContactSchema.safeParse({
                jobTitle: 'Director',
                isPrimary: false
            });

            expect(result.success).toBe(true);
        });
    });

    describe('createSubmissionSchema', () => {
        it('should accept snake_case submission payload', () => {
            const result = createSubmissionSchema.safeParse({
                resume_id: '123e4567-e89b-12d3-a456-426614174000',
                client_id: '123e4567-e89b-12d3-a456-426614174001',
                contact_id: '123e4567-e89b-12d3-a456-426614174002'
            });

            expect(result.success).toBe(true);
        });

        it('should accept camelCase submission payload', () => {
            const result = createSubmissionSchema.safeParse({
                resumeId: '123e4567-e89b-12d3-a456-426614174000',
                clientId: '123e4567-e89b-12d3-a456-426614174001',
                contactId: '123e4567-e89b-12d3-a456-426614174002',
                missionId: '123e4567-e89b-12d3-a456-426614174003',
                sentAt: '2026-03-23T10:00:00Z'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('updateSubmissionSchema', () => {
        it('should accept camelCase submission update payload', () => {
            const result = updateSubmissionSchema.safeParse({
                status: 'viewed',
                notes: 'Updated notes'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('createTemplateSchema', () => {
        it('should accept legacy template payload', () => {
            const result = createTemplateSchema.safeParse({
                Name: 'Legacy Template',
                TemplateContent: '<main>Legacy</main>',
                Status: 'Active'
            });

            expect(result.success).toBe(true);
        });

        it('should accept camelCase template payload', () => {
            const result = createTemplateSchema.safeParse({
                name: 'Modern Template',
                templateContent: '<main>Modern</main>',
                headerContent: '<header>Header</header>',
                footerHeight: 40,
                status: 'active',
                previewImage: 'https://example.com/preview.png'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('updateTemplateSchema', () => {
        it('should accept camelCase template update payload', () => {
            const result = updateTemplateSchema.safeParse({
                name: 'Updated Template',
                description: 'Updated',
                status: 'inactive',
                firmId: '123e4567-e89b-12d3-a456-426614174000'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('updateAdaptationSchema', () => {
        it('should accept legacy adaptation payload', () => {
            const result = updateAdaptationSchema.safeParse({
                'Adapted Text': 'Legacy text',
                'Adapted Title': 'Legacy title',
                Status: 'completed'
            });

            expect(result.success).toBe(true);
        });

        it('should accept camelCase adaptation payload', () => {
            const result = updateAdaptationSchema.safeParse({
                adaptedText: 'Modern text',
                adaptedTitle: 'Modern title',
                status: 'completed',
                matchScore: 91,
                matchAnalysis: 'Strong fit'
            });

            expect(result.success).toBe(true);
        });
    });

    describe('updateResumeSchema', () => {
        it('should accept legacy resume update fields', () => {
            const result = updateResumeSchema.safeParse({
                Name: 'Legacy Name',
                'Improved Text': 'Updated content',
                'Global Rating': '85%'
            });

            expect(result.success).toBe(true);
        });

        it('should accept camelCase resume update fields', () => {
            const result = updateResumeSchema.safeParse({
                name: 'Modern Name',
                improvedText: 'Updated content',
                globalRating: '85%',
                improvedSkills: ['Node.js'],
                softSkills: ['Communication'],
                keyImprovements: { summary: 'Clearer profile' }
            });

            expect(result.success).toBe(true);
        });
    });

    describe('chatbotRequestSchema', () => {
        it('should validate a valid chatbot request', () => {
            const validRequest = {
                message: 'How do I analyze a resume?'
            };

            const result = chatbotRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
        });

        it('should reject empty message', () => {
            const invalidRequest = {
                message: ''
            };

            const result = chatbotRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should reject message that is too long', () => {
            const invalidRequest = {
                message: 'a'.repeat(10001)
            };

            const result = chatbotRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should accept conversation history', () => {
            const validRequest = {
                message: 'Follow up question',
                conversationHistory: [
                    { role: 'user', content: 'Previous question' },
                    { role: 'assistant', content: 'Previous answer' }
                ]
            };

            const result = chatbotRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
        });

        it('should reject invalid conversation history role', () => {
            const invalidRequest = {
                message: 'Question',
                conversationHistory: [
                    { role: 'system', content: 'Invalid role for history' }
                ]
            };

            const result = chatbotRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should limit conversation history length', () => {
            const history = Array(51).fill({ role: 'user', content: 'Message' });
            const invalidRequest = {
                message: 'Question',
                conversationHistory: history
            };

            const result = chatbotRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });
    });

    describe('validateBody middleware', () => {
        it('should call next() for valid body', () => {
            const schema = chatbotRequestSchema;
            const middleware = validateBody(schema);
            
            const req = { body: { message: 'Valid message' } };
            const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should return 400 for invalid body', () => {
            const schema = chatbotRequestSchema;
            const middleware = validateBody(schema);
            
            const req = { body: { message: '' } };
            const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.any(String)
            }));
        });

        it('should include validation errors in response', () => {
            const schema = chatbotRequestSchema;
            const middleware = validateBody(schema);
            
            const req = { body: {} };
            const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            const next = vi.fn();

            middleware(req, res, next);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                details: expect.any(Array)
            }));
        });
    });
});

