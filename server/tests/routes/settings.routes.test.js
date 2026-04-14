/**
 * Tests for Settings routes
 * GET /, PUT /:id, POST /
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { discoverOllamaModels } from '../../services/ollamaAdmin.service.js';
import { validatePersistedLlmSettings, testLlmSettingsConnection } from '../../services/llmSettingsValidation.service.js';

// Mock constants
vi.mock('../../config/constants.js', () => ({
    JWT_SECRET: 'test-jwt-secret-for-vitest-minimum-32-chars-long',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret-for-vitest-min-32-chars',
    CSRF_SECRET: 'test-csrf-secret-for-vitest-minimum-32-chars',
    SALT_ROUNDS: 10,
    MAX_TEXT_LENGTH: 50000,
    MAX_PROMPT_LENGTH: 100000,
    MAX_STRING_FIELD_LENGTH: 1000,
    RATE_LIMIT: { AUTH: { windowMs: 900000, max: 20 }, USER: { windowMs: 900000, max: 50 } },
    MAX_LOGS: 1000,
    PROFILE_MATCHING_LOCAL_SKILL_WEIGHT: 6,
    PROFILE_MATCHING_LOCAL_TOOL_WEIGHT: 4,
    PROFILE_MATCHING_LOCAL_INDUSTRY_WEIGHT: 3,
    PROFILE_MATCHING_LOCAL_SOFTSKILL_WEIGHT: 2,
    PROFILE_MATCHING_LOCAL_TITLE_EXACT_WEIGHT: 5,
    PROFILE_MATCHING_LOCAL_TITLE_TOKEN_WEIGHT: 2,
    PROFILE_MATCHING_LOCAL_COVERAGE_MULTIPLIER: 3
}));


// Mock cache service
vi.mock('../../services/cache.service.js', () => ({
    CACHE_KEYS: {
        settings: {
            UI_SETTINGS: 'settings',
            LLM_SETTINGS: 'llm-settings'
        }
    },
    settingsCache: {
        get: vi.fn(() => null),
        set: vi.fn(),
        invalidate: vi.fn()
    },
    invalidateSettingsCaches: vi.fn()
}));

// Mock metrics
vi.mock('../../services/metrics.service.js', () => ({
    metrics: {
        trackCacheHit: vi.fn(),
        trackCacheMiss: vi.fn()
    }
}));

// Mock settings service
const mockGetSettings = vi.fn();
const mockGetLLMSettings = vi.fn();
const mockUpsertSettings = vi.fn();
const mockCreateSettings = vi.fn();
vi.mock('../../services/settings.service.js', () => ({
    invalidateSettingsCache: vi.fn(),
    getSettings: (...args) => mockGetSettings(...args),
    getLLMSettings: (...args) => mockGetLLMSettings(...args),
    upsertSettings: (...args) => mockUpsertSettings(...args),
    createSettings: (...args) => mockCreateSettings(...args)
}));

vi.mock('../../services/llmAvailability.service.js', () => ({
    getProviderAvailabilityFlags: vi.fn(() => ({
        minimax: { highspeedEnabled: false }
    })),
    resolveAvailableModel: vi.fn((_provider, model) => ({
        model,
        adjusted: false,
        reason: null,
        originalModel: model,
        fallbackModel: null
    }))
}));

vi.mock('../../services/llmAdminParameters.service.js', () => ({
    buildLlmAdminMetadataWithOptions: vi.fn(() => ({
        llmModelCatalog: {},
        llmParameterDefinitions: {}
    })),
    sanitizeLlmModelParameters: vi.fn((value) => value || {})
}));

vi.mock('../../services/llmSettingsValidation.service.js', () => ({
    validatePersistedLlmSettings: vi.fn(async () => undefined),
    testLlmSettingsConnection: vi.fn(async () => ({
        provider: 'openai',
        model: 'gpt-4o',
        contentPreview: 'OK'
    }))
}));

vi.mock('../../services/ollamaAdmin.service.js', () => ({
    discoverOllamaModels: vi.fn(async () => ({
        models: [{ name: 'llama3.2:latest' }],
        modelCatalog: [{ value: 'llama3.2:latest', label: 'llama3.2:latest' }],
        capabilitiesByModel: {
            'llama3.2:latest': {
                name: 'llama3.2:latest',
                family: 'llama',
                architecture: 'llama',
                contextLength: 8192,
                quantizationLevel: 'Q4_K_M'
            }
        }
    })),
    validateOllamaModelExists: vi.fn(async (_baseUrl, model) => ({
        exists: model === 'llama3.2:latest',
        discovery: {
            modelCatalog: [{ value: 'llama3.2:latest', label: 'llama3.2:latest' }]
        }
    }))
}));

// Mock prompts
vi.mock('../../config/prompts.backend.js', () => ({
    normalizeWeights: (data) => data,
    DEFAULT_PRE_ANALYSIS_PROMPT: 'default-pre-analysis',
    DEFAULT_ANALYSIS_PROMPT: 'default-analysis',
    DEFAULT_IMPROVEMENT_PROMPT: 'default-improvement',
    DEFAULT_MATCH_ANALYSIS_PROMPT: 'default-match',
    DEFAULT_ADAPTATION_PROMPT: 'default-adaptation'
}));

vi.mock('../../config/llmGovernance.js', () => ({
    getPromptDefinition: vi.fn((key) => ({
        DEFAULT_ANALYSIS_PROMPT: {
            key,
            id: 'resume.analysis.default',
            version: '1.8.8',
            domain: 'resume',
            operation: 'resume-analysis',
            sourceModule: './prompts/resume.prompts.js',
            text: 'default-analysis'
        },
        DEFAULT_PRE_ANALYSIS_PROMPT: {
            key,
            id: 'resume.pre-analysis.default',
            version: '1.0.0',
            domain: 'resume',
            operation: 'resume-pre-analysis',
            sourceModule: './prompts/resume.prompts.js',
            text: 'default-pre-analysis'
        },
        DEFAULT_IMPROVEMENT_PROMPT: {
            key,
            id: 'resume.improvement.default',
            version: '1.8.8',
            domain: 'resume',
            operation: 'resume-improvement',
            sourceModule: './prompts/resume.prompts.js',
            text: 'default-improvement'
        },
        DEFAULT_MATCH_ANALYSIS_PROMPT: {
            key,
            id: 'mission.match.default',
            version: '1.8.8',
            domain: 'mission',
            operation: 'resume-mission-match',
            sourceModule: './prompts/resume.prompts.js',
            text: 'default-match'
        },
        DEFAULT_ADAPTATION_PROMPT: {
            key,
            id: 'mission.adaptation.default',
            version: '1.8.8',
            domain: 'mission',
            operation: 'resume-mission-adaptation',
            sourceModule: './prompts/resume.prompts.js',
            text: 'default-adaptation'
        }
    }[key] || null)),
    getPromptContract: vi.fn((key) => ({
        DEFAULT_ANALYSIS_PROMPT: { id: 'resume_analysis_v1', version: '1.0.0' },
        DEFAULT_PRE_ANALYSIS_PROMPT: { id: 'resume_pre_analysis_v1', version: '1.0.0' },
        DEFAULT_IMPROVEMENT_PROMPT: { id: 'resume_improvement_v1', version: '1.0.0' },
        DEFAULT_MATCH_ANALYSIS_PROMPT: { id: 'mission_match_v1', version: '1.0.0' },
        DEFAULT_ADAPTATION_PROMPT: { id: 'mission_adaptation_v1', version: '1.0.0' }
    }[key] || null))
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }))
}));

// Mock security service
vi.mock('../../services/security.service.js', () => ({
    securityLog: vi.fn(),
    getRequestMetadata: vi.fn(() => ({})),
    LOG_LEVELS: { SECURITY: 'SECURITY' },
    SECURITY_EVENTS: { SETTINGS_CHANGED: 'SETTINGS_CHANGED' }
}));

// Mock mappers
vi.mock('../../utils/mappers.js', () => ({
    mapSettingsToFrontend: vi.fn((settings) => settings ? ({
        id: settings.id ?? null,
        llmModel: settings.llm_model ?? settings.llmModel ?? null,
        llmProvider: settings.llm_provider ?? settings.llmProvider ?? 'openai',
        cvMode: settings.cv_mode ?? settings.cvMode ?? 'nominative',
        chatbotEnabled: settings.chatbot_enabled ?? settings.chatbotEnabled ?? 'on',
        webglEnabled: settings.webgl_enabled ?? settings.webglEnabled ?? 'on',
        publicHomeEnabled: settings.public_home_enabled ?? settings.publicHomeEnabled ?? undefined,
        preAnalysisEnabled: settings.pre_analysis_enabled ?? settings.preAnalysisEnabled ?? false,
        'Pre Analysis Prompt': settings.pre_analysis_prompt ?? settings['Pre Analysis Prompt'] ?? '',
        'Analysis Prompt': settings.analysis_prompt ?? settings['Analysis Prompt'] ?? '',
        'Improvement Prompt': settings.improvement_prompt ?? settings['Improvement Prompt'] ?? '',
        'Match Analysis Prompt': settings.match_analysis_prompt ?? settings['Match Analysis Prompt'] ?? '',
        'Adaptation Prompt': settings.adaptation_prompt ?? settings['Adaptation Prompt'] ?? '',
        'Executive Summary Weight': settings.executive_summary_weight ?? settings['Executive Summary Weight'] ?? 20,
        'Skills Weight': settings.skills_weight ?? settings['Skills Weight'] ?? 20,
        'Experience Weight': settings.experience_weight ?? settings['Experience Weight'] ?? 20,
        'Education Weight': settings.education_weight ?? settings['Education Weight'] ?? 15,
        'ATS Weight': settings.ats_weight ?? settings['ATS Weight'] ?? 15,
        'Hobbies Languages Weight': settings.hobbies_languages_weight ?? settings['Hobbies Languages Weight'] ?? 10,
        'Profile Matching Local Skill Weight': settings.profile_matching_local_skill_weight ?? settings['Profile Matching Local Skill Weight'] ?? 6,
        'Profile Matching Local Tool Weight': settings.profile_matching_local_tool_weight ?? settings['Profile Matching Local Tool Weight'] ?? 4,
        'Profile Matching Local Industry Weight': settings.profile_matching_local_industry_weight ?? settings['Profile Matching Local Industry Weight'] ?? 3,
        'Profile Matching Local Soft Skill Weight': settings.profile_matching_local_softskill_weight ?? settings['Profile Matching Local Soft Skill Weight'] ?? 2,
        'Profile Matching Local Title Exact Weight': settings.profile_matching_local_title_exact_weight ?? settings['Profile Matching Local Title Exact Weight'] ?? 5,
        'Profile Matching Local Title Token Weight': settings.profile_matching_local_title_token_weight ?? settings['Profile Matching Local Title Token Weight'] ?? 2,
        'Profile Matching Local Coverage Multiplier': settings.profile_matching_local_coverage_multiplier ?? settings['Profile Matching Local Coverage Multiplier'] ?? 3,
        allowUserRegistrationWithoutApproval: settings.allow_user_registration_without_approval ?? settings.allowUserRegistrationWithoutApproval ?? false,
        firmInitialCredits: settings.firm_initial_credits ?? settings.firmInitialCredits ?? 1000,
        aiCreditChatbotMessage: settings.ai_credit_chatbot_message ?? settings.aiCreditChatbotMessage ?? 1,
        aiCreditResumeAiModify: settings.ai_credit_resume_ai_modify ?? settings.aiCreditResumeAiModify ?? 5,
        aiCreditTemplateExtract: settings.ai_credit_template_extract ?? settings.aiCreditTemplateExtract ?? 15,
        aiCreditResumeAnalysis: settings.ai_credit_resume_analysis ?? settings.aiCreditResumeAnalysis ?? 25,
        aiCreditResumeImprovement: settings.ai_credit_resume_improvement ?? settings.aiCreditResumeImprovement ?? 75,
        aiCreditResumeAdaptation: settings.ai_credit_resume_adaptation ?? settings.aiCreditResumeAdaptation ?? 50,
        aiCreditResumeMatch: settings.ai_credit_resume_match ?? settings.aiCreditResumeMatch ?? 8,
        aiCreditProfileSearch: settings.ai_credit_profile_search ?? settings.aiCreditProfileSearch ?? 12,
        aiCreditProfileAnalysis: settings.ai_credit_profile_analysis ?? settings.aiCreditProfileAnalysis ?? 25,
        'DPO Name': settings.dpo_name ?? settings['DPO Name'] ?? '',
        'DPO Email': settings.dpo_email ?? settings['DPO Email'] ?? '',
        'DPO Phone': settings.dpo_phone ?? settings['DPO Phone'] ?? ''
    }) : null),
    mapSettingsFromFrontend: vi.fn((settings) => settings)
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    updateSettingsSchema: {}
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'user-123',
                email: 'test@example.com',
                role: req.headers['x-test-role'] || 'admin',
                firm: 'Test Firm'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    },
    requireAdmin: (req, res, next) => {
        if (req.user?.role === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Admin access required' });
        }
    }
}));

import settingsRoutes from '../../routes/settings.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/settings', settingsRoutes);
    return app;
}

describe('Settings Routes', () => {
    let app;
    const authHeader = { Authorization: 'Bearer valid-token' };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetLLMSettings.mockResolvedValue({});
        mockGetSettings.mockResolvedValue(null);
        app = createTestApp();
    });

    describe('GET /api/settings', () => {
        it('should return settings from DB', async () => {
            mockGetSettings.mockResolvedValue({
                id: 'set-1',
                llm_model: 'gpt-4',
                cv_mode: 'nominative',
                chatbot_enabled: 'on',
                public_home_enabled: true,
                analysis_prompt: 'Analyze this',
                improvement_prompt: 'Improve this',
                match_analysis_prompt: 'Match this',
                adaptation_prompt: 'Adapt this',
                executive_summary_weight: 20,
                skills_weight: 20,
                experience_weight: 20,
                education_weight: 15,
                ats_weight: 15,
                hobbies_languages_weight: 10,
                dpo_name: 'John',
                dpo_email: 'dpo@test.com',
                dpo_phone: '+33123456789'
            });

            const res = await request(app).get('/api/settings').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.llmModel).toBe('gpt-4');
            expect(res.body.cvMode).toBe('nominative');
            expect(res.body.publicHomeEnabled).toBe(true);
            expect(res.body['Analysis Prompt']).toBe('Analyze this');
            expect(res.body['DPO Name']).toBe('John');
            expect(res.body.promptGovernance['Analysis Prompt']).toEqual(expect.objectContaining({
                promptId: 'resume.analysis.default',
                promptVersion: '1.8.8',
                contractId: 'resume_analysis_v1',
                contractVersion: '1.0.0'
            }));
            expect(res.body.promptVersionState['Analysis Prompt']).toEqual(expect.objectContaining({
                currentRevision: 2,
                isModified: true
            }));
            expect(discoverOllamaModels).not.toHaveBeenCalled();
        });

        it('should overlay canonical LLM settings on the general settings payload', async () => {
            mockGetSettings.mockResolvedValue({
                id: 'set-1',
                llm_model: 'MiniMax-M2.7-highspeed',
                llm_provider: 'minimax',
                cv_mode: 'nominative',
                chatbot_enabled: 'on'
            });
            mockGetLLMSettings.mockResolvedValue({
                llmModel: 'MiniMax-M2.7',
                llmProvider: 'minimax',
                llmAvailability: {
                    minimax: { highspeedEnabled: false }
                }
            });

            const res = await request(app).get('/api/settings').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.llmModel).toBe('MiniMax-M2.7');
            expect(res.body.llmAvailability).toEqual({
                minimax: { highspeedEnabled: false }
            });
        });

        it('should return defaults when no settings exist', async () => {
            mockGetSettings.mockResolvedValue(null);

            const res = await request(app).get('/api/settings').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.id).toBeNull();
            expect(res.body.llmModel).toBe('gpt-4o');
            expect(res.body['Pre Analysis Prompt']).toBe('default-pre-analysis');
            expect(res.body['Analysis Prompt']).toBe('default-analysis');
            expect(res.body['Profile Matching Local Skill Weight']).toBe(6);
            expect(res.body.firmInitialCredits).toBe(1000);
            expect(res.body.allowUserRegistrationWithoutApproval).toBe(false);
            expect(res.body.aiCreditResumeAnalysis).toBe(25);
            expect(res.body.aiCreditResumeImprovement).toBe(75);
            expect(res.body.aiCreditResumeAdaptation).toBe(50);
            expect(res.body.aiCreditProfileAnalysis).toBe(25);
            expect(res.body.promptGovernance['Adaptation Prompt']).toEqual(expect.objectContaining({
                promptId: 'mission.adaptation.default',
                promptVersion: '1.8.8'
            }));
            expect(res.body.promptVersionState['Analysis Prompt']).toEqual(expect.objectContaining({
                currentRevision: 1,
                isModified: false
            }));
        });

        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/settings');
            expect(res.status).toBe(401);
        });

        it('should return 500 on DB error', async () => {
            mockGetSettings.mockRejectedValue(new Error('DB error'));

            const res = await request(app).get('/api/settings').set(authHeader);
            expect(res.status).toBe(500);
        });

        it('should return 503 when canonical LLM settings are unavailable without cache', async () => {
            mockGetSettings.mockResolvedValue({
                id: 'set-1',
                llm_model: 'gpt-4',
                cv_mode: 'nominative'
            });
            mockGetLLMSettings.mockRejectedValue(Object.assign(
                new Error('LLM settings are currently unavailable.'),
                { statusCode: 503, code: 'LLM_SETTINGS_UNAVAILABLE' }
            ));

            const res = await request(app).get('/api/settings').set(authHeader);

            expect(res.status).toBe(503);
            expect(res.body).toEqual({
                error: 'LLM settings are currently unavailable.'
            });
        });
    });

    describe('GET /api/settings/presentation', () => {
        it('should return presentation toggles for authenticated users', async () => {
            mockGetSettings.mockResolvedValueOnce({
                chatbotEnabled: 'off',
                webglEnabled: 'on'
            });

            const res = await request(app)
                .get('/api/settings/presentation')
                .set({ ...authHeader, 'x-test-role': 'user' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                chatbotEnabled: 'off',
                webglEnabled: 'on'
            });
        });

        it('should return defaults when presentation settings are missing', async () => {
            mockGetSettings.mockResolvedValueOnce(null);

            const res = await request(app)
                .get('/api/settings/presentation')
                .set({ ...authHeader, 'x-test-role': 'user' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                chatbotEnabled: 'on',
                webglEnabled: 'on'
            });
        });
    });

    describe('GET /api/settings/defaults', () => {
        it('should return default prompts and weights for admin', async () => {
            const res = await request(app).get('/api/settings/defaults').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body['Pre Analysis Prompt']).toBe('default-pre-analysis');
            expect(res.body['Analysis Prompt']).toBe('default-analysis');
            expect(res.body['Improvement Prompt']).toBe('default-improvement');
            expect(res.body['Match Analysis Prompt']).toBe('default-match');
            expect(res.body['Adaptation Prompt']).toBe('default-adaptation');
            expect(res.body['Executive Summary Weight']).toBe(20);
            expect(res.body.llmModel).toBe('gpt-4o');
            expect(res.body.promptGovernance['Improvement Prompt']).toEqual(expect.objectContaining({
                promptId: 'resume.improvement.default',
                contractId: 'resume_improvement_v1'
            }));
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .get('/api/settings/defaults')
                .set({ ...authHeader, 'x-test-role': 'user' });

            expect(res.status).toBe(403);
        });

        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/settings/defaults');
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/settings/ollama/models', () => {
        it('returns remote ollama models for admins', async () => {
            mockGetLLMSettings.mockResolvedValue({
                llmProvider: 'ollama',
                ollamaBaseUrl: 'http://ollama.local:11434'
            });

            const res = await request(app)
                .get('/api/settings/ollama/models?baseUrl=http://ollama.local:11434&model=llama3.2:latest')
                .set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.models).toEqual([{ value: 'llama3.2:latest', label: 'llama3.2:latest' }]);
            expect(res.body.selectedModelExists).toBe(true);
        });

        it('rejects arbitrary ollama discovery URLs', async () => {
            mockGetLLMSettings.mockResolvedValue({
                llmProvider: 'ollama',
                ollamaBaseUrl: 'http://ollama.local:11434'
            });

            const res = await request(app)
                .get('/api/settings/ollama/models?baseUrl=http://169.254.169.254:11434')
                .set(authHeader);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Ollama model discovery is limited to the configured Ollama URL.');
            expect(discoverOllamaModels).not.toHaveBeenCalled();
        });
    });

    describe('PUT /api/settings/:id', () => {
        it('should update settings', async () => {
            const updatedRecord = {
                id: 'set-1',
                llm_model: 'gpt-4-turbo',
                cv_mode: 'anonymous',
                chatbot_enabled: 'on',
                analysis_prompt: 'New prompt',
                improvement_prompt: 'New improve',
                match_analysis_prompt: 'New match',
                adaptation_prompt: 'New adapt',
                executive_summary_weight: 25,
                skills_weight: 20,
                experience_weight: 20,
                education_weight: 15,
                ats_weight: 10,
                hobbies_languages_weight: 10,
                public_home_enabled: true,
                firm_initial_credits: 1500,
                ai_credit_resume_analysis: 30,
                dpo_name: '',
                dpo_email: '',
                dpo_phone: ''
            };
            mockUpsertSettings.mockResolvedValue(updatedRecord);

            const res = await request(app)
                .put('/api/settings/set-1')
                .set(authHeader)
                .send({ llmModel: 'gpt-4-turbo', cvMode: 'anonymous', publicHomeEnabled: true, allowUserRegistrationWithoutApproval: true, firmInitialCredits: 1500, aiCreditResumeAnalysis: 30 });

            expect(res.status).toBe(200);
            expect(res.body.llmModel).toBe('gpt-4-turbo');
            expect(res.body.cvMode).toBe('anonymous');
            expect(res.body.publicHomeEnabled).toBe(true);
            expect(mockUpsertSettings).toHaveBeenCalledWith('set-1', expect.objectContaining({
                publicHomeEnabled: true,
                allowUserRegistrationWithoutApproval: true,
                firmInitialCredits: 1500,
                aiCreditResumeAnalysis: 30,
                promptVersionState: expect.objectContaining({
                    'Analysis Prompt': expect.objectContaining({
                        currentRevision: 1
                    })
                })
            }));
            expect(validatePersistedLlmSettings).not.toHaveBeenCalled();
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .put('/api/settings/set-1')
                .set({ ...authHeader, 'x-test-role': 'user' })
                .send({ llmModel: 'gpt-4' });

            expect(res.status).toBe(403);
        });

        it('should handle not found by creating new', async () => {
            mockUpsertSettings.mockResolvedValue({
                id: 'set-new',
                llm_model: 'gpt-4',
                cv_mode: 'nominative',
                chatbot_enabled: 'on',
                analysis_prompt: '',
                improvement_prompt: '',
                match_analysis_prompt: '',
                adaptation_prompt: '',
                executive_summary_weight: 20,
                skills_weight: 20,
                experience_weight: 20,
                education_weight: 15,
                ats_weight: 15,
                hobbies_languages_weight: 10,
                dpo_name: '',
                dpo_email: '',
                dpo_phone: ''
            });

            const res = await request(app)
                .put('/api/settings/nonexistent')
                .set(authHeader)
                .send({ llmModel: 'gpt-4' });

            expect(res.status).toBe(200);
        });

        it('should return 500 on unexpected error', async () => {
            mockUpsertSettings.mockRejectedValue(new Error('Unexpected'));

            const res = await request(app)
                .put('/api/settings/set-1')
                .set(authHeader)
                .send({ llmModel: 'gpt-4' });

            expect(res.status).toBe(500);
        });

        it('persists settings even when the selected ollama model is unavailable', async () => {
            mockUpsertSettings.mockResolvedValue({
                id: 'set-1',
                llm_provider: 'ollama',
                llm_model: 'missing-model',
                ollama_base_url: 'http://ollama.local:11434'
            });

            const res = await request(app)
                .put('/api/settings/set-1')
                .set(authHeader)
                .send({
                    llmProvider: 'ollama',
                    ollamaBaseUrl: 'http://ollama.local:11434',
                    llmModel: 'missing-model'
                });

            expect(res.status).toBe(200);
            expect(mockUpsertSettings).toHaveBeenCalledWith('set-1', expect.objectContaining({
                llmProvider: 'ollama',
                llmModel: 'missing-model',
                ollamaBaseUrl: 'http://ollama.local:11434'
            }));
        });

        it('persists gemma settings without runtime validation on save', async () => {
            mockUpsertSettings.mockResolvedValue({
                id: 'set-1',
                llm_provider: 'gemma',
                llm_model: 'gemma-4-31b-it'
            });

            const res = await request(app)
                .put('/api/settings/set-1')
                .set(authHeader)
                .send({
                    llmProvider: 'gemma',
                    llmModel: 'gemma-4-31b-it'
                });

            expect(res.status).toBe(200);
            expect(mockUpsertSettings).toHaveBeenCalledWith('set-1', expect.objectContaining({
                llmProvider: 'gemma',
                llmModel: 'gemma-4-31b-it'
            }));
            expect(validatePersistedLlmSettings).not.toHaveBeenCalled();
        });

        it('persists a custom Hugging Face model instead of forcing the default model', async () => {
            mockUpsertSettings.mockResolvedValue({
                id: 'set-1',
                llm_provider: 'huggingface',
                llm_model: 'meta-llama/Llama-3.3-70B-Instruct'
            });

            const res = await request(app)
                .put('/api/settings/set-1')
                .set(authHeader)
                .send({
                    llmProvider: 'huggingface',
                    llmModel: 'meta-llama/Llama-3.3-70B-Instruct'
                });

            expect(res.status).toBe(200);
            expect(mockUpsertSettings).toHaveBeenCalledWith('set-1', expect.objectContaining({
                llmProvider: 'huggingface',
                llmModel: 'meta-llama/Llama-3.3-70B-Instruct'
            }));
        });
    });

    describe('GET /api/settings/public-home', () => {
        it('returns the persisted public home flag without authentication', async () => {
            mockGetSettings.mockResolvedValueOnce({
                public_home_enabled: true
            });

            const res = await request(app).get('/api/settings/public-home');

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                publicHomeEnabled: true
            });
        });

        it('returns null when the public home flag is not configured', async () => {
            mockGetSettings.mockResolvedValueOnce(null);

            const res = await request(app).get('/api/settings/public-home');

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                publicHomeEnabled: null
            });
        });
    });

    describe('POST /api/settings/test-llm', () => {
        it('tests the configured model without saving settings', async () => {
            const res = await request(app)
                .post('/api/settings/test-llm')
                .set(authHeader)
                .send({
                    llmProvider: 'openai',
                    llmModel: 'gpt-4o'
                });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                success: true,
                provider: 'openai',
                model: 'gpt-4o',
                contentPreview: 'OK'
            });
            expect(testLlmSettingsConnection).toHaveBeenCalledWith(
                expect.objectContaining({
                    llmProvider: 'openai',
                    llmModel: 'gpt-4o'
                }),
                expect.objectContaining({ id: 'user-123' })
            );
            expect(mockUpsertSettings).not.toHaveBeenCalled();
            expect(mockCreateSettings).not.toHaveBeenCalled();
        });

        it('returns 400 when the explicit model test fails', async () => {
            testLlmSettingsConnection.mockRejectedValueOnce(Object.assign(
                new Error('LLM test failed for gemma/gemma-4-e4b-it: invalid request'),
                { statusCode: 400 }
            ));

            const res = await request(app)
                .post('/api/settings/test-llm')
                .set(authHeader)
                .send({
                    llmProvider: 'gemma',
                    llmModel: 'gemma-4-e4b-it'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('LLM test failed');
        });

        it('tests a custom Hugging Face model without forcing the default model', async () => {
            testLlmSettingsConnection.mockResolvedValueOnce({
                provider: 'huggingface',
                model: 'meta-llama/Llama-3.3-70B-Instruct',
                contentPreview: 'OK'
            });

            const res = await request(app)
                .post('/api/settings/test-llm')
                .set(authHeader)
                .send({
                    llmProvider: 'huggingface',
                    llmModel: 'meta-llama/Llama-3.3-70B-Instruct'
                });

            expect(res.status).toBe(200);
            expect(testLlmSettingsConnection).toHaveBeenCalledWith(
                expect.objectContaining({
                    llmProvider: 'huggingface',
                    llmModel: 'meta-llama/Llama-3.3-70B-Instruct'
                }),
                expect.objectContaining({ id: 'user-123' })
            );
            expect(res.body).toEqual({
                success: true,
                provider: 'huggingface',
                model: 'meta-llama/Llama-3.3-70B-Instruct',
                contentPreview: 'OK'
            });
        });
    });

    describe('POST /api/settings', () => {
        it('creates settings without runtime provider/model validation', async () => {
            mockCreateSettings.mockResolvedValue({
                id: 'set-new',
                llm_model: 'gpt-4o',
                llm_provider: 'openai'
            });

            const res = await request(app)
                .post('/api/settings')
                .set(authHeader)
                .send({
                    llmProvider: 'openai',
                    llmModel: 'gpt-4o'
                });

            expect(res.status).toBe(201);
            expect(validatePersistedLlmSettings).not.toHaveBeenCalled();
        });
        it('should create settings', async () => {
            mockCreateSettings.mockResolvedValue({
                id: 'set-new',
                llm_model: 'gpt-4',
                cv_mode: 'nominative',
                chatbot_enabled: 'on',
                analysis_prompt: 'default-analysis',
                improvement_prompt: 'default-improvement',
                match_analysis_prompt: 'default-match',
                adaptation_prompt: 'default-adaptation',
                executive_summary_weight: 20,
                skills_weight: 20,
                experience_weight: 20,
                education_weight: 15,
                ats_weight: 15,
                hobbies_languages_weight: 10,
                dpo_name: '',
                dpo_email: '',
                dpo_phone: ''
            });

            const res = await request(app)
                .post('/api/settings')
                .set(authHeader)
                .send({ llmModel: 'gpt-4' });

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('set-new');
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .post('/api/settings')
                .set({ ...authHeader, 'x-test-role': 'user' })
                .send({ llmModel: 'gpt-4' });

            expect(res.status).toBe(403);
        });

        it('should return 500 on error', async () => {
            mockCreateSettings.mockRejectedValue(new Error('DB error'));

            const res = await request(app)
                .post('/api/settings')
                .set(authHeader)
                .send({ llmModel: 'gpt-4' });

            expect(res.status).toBe(500);
        });
    });
});
