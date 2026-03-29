/**
 * Tests for Settings routes
 * GET /, PUT /:id, POST /
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

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
    MAX_LOGS: 1000
}));


// Mock cache service
vi.mock('../../services/cache.service.js', () => ({
    settingsCache: {
        get: vi.fn(() => null),
        set: vi.fn(),
        invalidate: vi.fn()
    }
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
const mockUpsertSettings = vi.fn();
const mockCreateSettings = vi.fn();
vi.mock('../../services/settings.service.js', () => ({
    invalidateSettingsCache: vi.fn(),
    getSettings: (...args) => mockGetSettings(...args),
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

// Mock prompts
vi.mock('../../config/prompts.backend.js', () => ({
    normalizeWeights: (data) => data,
    DEFAULT_ANALYSIS_PROMPT: 'default-analysis',
    DEFAULT_IMPROVEMENT_PROMPT: 'default-improvement',
    DEFAULT_MATCH_ANALYSIS_PROMPT: 'default-match',
    DEFAULT_ADAPTATION_PROMPT: 'default-adaptation'
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
        app = createTestApp();
    });

    describe('GET /api/settings', () => {
        it('should return settings from DB', async () => {
            mockGetSettings.mockResolvedValue({
                id: 'set-1',
                llm_model: 'gpt-4',
                cv_mode: 'nominative',
                chatbot_enabled: 'on',
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
            expect(res.body['Analysis Prompt']).toBe('Analyze this');
            expect(res.body['DPO Name']).toBe('John');
        });

        it('should return defaults when no settings exist', async () => {
            mockGetSettings.mockResolvedValue(null);

            const res = await request(app).get('/api/settings').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.id).toBeNull();
            expect(res.body.llmModel).toBeNull();
            expect(res.body['Analysis Prompt']).toBe('default-analysis');
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
    });

    describe('GET /api/settings/defaults', () => {
        it('should return default prompts and weights for admin', async () => {
            const res = await request(app).get('/api/settings/defaults').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body['Analysis Prompt']).toBe('default-analysis');
            expect(res.body['Improvement Prompt']).toBe('default-improvement');
            expect(res.body['Match Analysis Prompt']).toBe('default-match');
            expect(res.body['Adaptation Prompt']).toBe('default-adaptation');
            expect(res.body['Executive Summary Weight']).toBe(20);
            expect(res.body.llmModel).toBe('chatgpt-4o-latest');
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
                dpo_name: '',
                dpo_email: '',
                dpo_phone: ''
            };
            mockUpsertSettings.mockResolvedValue(updatedRecord);

            const res = await request(app)
                .put('/api/settings/set-1')
                .set(authHeader)
                .send({ llmModel: 'gpt-4-turbo', cvMode: 'anonymous' });

            expect(res.status).toBe(200);
            expect(res.body.llmModel).toBe('gpt-4-turbo');
            expect(res.body.cvMode).toBe('anonymous');
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
    });

    describe('POST /api/settings', () => {
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
