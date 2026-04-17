import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateParams, validateBody, updateSettingsSchema } from '../utils/validation.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../services/security.service.js';
import { settingsCache, CACHE_KEYS } from '../services/cache.service.js';
import { metrics } from '../services/metrics.service.js';
import { invalidateSettingsCache, getSettings, getLLMSettings } from '../services/settings.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { getProviderAvailabilityFlags } from '../services/llmAvailability.service.js';
import { discoverOllamaModels } from '../services/ollamaAdmin.service.js';
import { testLlmSettingsConnection } from '../services/llmSettingsValidation.service.js';
import { getProviderDefaultModel } from '../services/llmConfiguration.service.js';
import {
    buildSettingsDefaultsResponse,
    buildSettingsIndexResponse,
    buildPresentationSettingsResponse,
    prepareSettingsConnectionTestPayload,
    resolveConfiguredOllamaBaseUrl,
    buildPublicHomeSettingsResponse,
} from './settings.routes.helpers.js';
import {
    persistSettingsCreateRoute,
    persistSettingsUpdateRoute
} from './settings.routes.persistence.helpers.js';

const router = express.Router();
const DEFAULT_OPENAI_MODEL = getProviderDefaultModel('openai');

function createSettingsRouteHandler(logMessage, errorMessage, handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            safeLog('error', logMessage, { error: error.message });
            return res.status(error.statusCode || 500).json({
                error: error.statusCode ? error.message : errorMessage
            });
        }
    };
}

// GET /api/settings - Get settings
router.get('/', authenticateToken, createSettingsRouteHandler('Error fetching settings', 'Failed to fetch settings', async (req, res) => {
        const cachedSettings = await settingsCache.get(CACHE_KEYS.settings.UI_SETTINGS);
        if (cachedSettings) {
            metrics.trackCacheHit();
            safeLog('debug', 'Returning cached settings');
            return res.json(cachedSettings);
        }

        metrics.trackCacheMiss();
        safeLog('debug', 'Cache miss - fetching settings from PostgreSQL');

        const [settings, canonicalLlmSettings] = await Promise.all([
            getSettings(),
            getLLMSettings()
        ]);

        if (!settings) {
            safeLog('info', 'No settings found, returning defaults');
            return res.json(await buildSettingsIndexResponse({
                settings,
                canonicalLlmSettings,
                getProviderAvailabilityFlags,
                defaultModel: DEFAULT_OPENAI_MODEL
            }));
        }

        const responseData = await buildSettingsIndexResponse({
            settings,
            canonicalLlmSettings,
            getProviderAvailabilityFlags,
            defaultModel: DEFAULT_OPENAI_MODEL
        });

        await settingsCache.set(CACHE_KEYS.settings.UI_SETTINGS, responseData);

        return res.json(responseData);
    }));

router.get('/presentation', authenticateToken, createSettingsRouteHandler('Error fetching presentation settings', 'Failed to fetch presentation settings', async (req, res) => {
        const settings = await getSettings();
        return res.json(buildPresentationSettingsResponse(settings));
    }));

router.get('/public-home', createSettingsRouteHandler('Error fetching public home setting', 'Failed to fetch public home setting', async (_req, res) => {
    const settings = await getSettings();
    return res.json(buildPublicHomeSettingsResponse(settings));
}));

// GET /api/settings/defaults - Get default prompts and weights
router.get('/defaults', authenticateToken, requireAdmin, createSettingsRouteHandler('Error building defaults', 'Failed to build defaults', async (req, res) => {
    const payload = await buildSettingsDefaultsResponse(DEFAULT_OPENAI_MODEL, getProviderAvailabilityFlags);
    return res.json(payload);
}));

router.get('/ollama/models', authenticateToken, requireAdmin, createSettingsRouteHandler('Failed to discover Ollama models', 'Failed to discover Ollama models', async (req, res) => {
        const requestedBaseUrl = String(req.query.baseUrl || '').trim();
        const selectedModel = String(req.query.model || '').trim();
        const canonicalLlmSettings = await getLLMSettings();
        const configuredBaseUrl = resolveConfiguredOllamaBaseUrl(canonicalLlmSettings);
        const baseUrl = resolveConfiguredOllamaBaseUrl({ ollamaBaseUrl: requestedBaseUrl });

        if (baseUrl !== configuredBaseUrl) {
            return res.status(400).json({ error: 'Ollama model discovery is limited to the configured Ollama URL.' });
        }

        const discovery = await discoverOllamaModels(baseUrl, { includeCapabilities: true });

        return res.json({
            models: discovery.modelCatalog,
            capabilitiesByModel: discovery.capabilitiesByModel,
            selectedModelExists: selectedModel ? discovery.modelCatalog.some(entry => entry.value === selectedModel) : true
        });
    }));

router.post('/test-llm', authenticateToken, requireAdmin, validateBody(updateSettingsSchema), createSettingsRouteHandler('Error testing LLM settings', 'Failed to test LLM settings', async (req, res) => {
        const settingsData = await prepareSettingsConnectionTestPayload(req.body, { getProviderAvailabilityFlags });
        const result = await testLlmSettingsConnection(settingsData, req.user);
        return res.json({
            success: true,
            ...result
        });
    }));

// PUT /api/settings/:id - Update settings (or create if not exists)
router.put('/:id', authenticateToken, requireAdmin, validateParams('id'), validateBody(updateSettingsSchema), createSettingsRouteHandler('Error updating settings', 'Failed to update settings', async (req, res) => {
        const { id } = req.params;
        let updateData = req.body;

        safeLog('info', 'Updating settings', { settingsId: id });

        delete updateData.id;
        const { preparedSettings, response } = await persistSettingsUpdateRoute({
            id,
            rawSettings: updateData,
            getProviderAvailabilityFlags,
            reqUser: req.user
        });

        safeLog('debug', 'Settings normalized', { fields: Object.keys(preparedSettings) });
        await invalidateSettingsCache();

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.SETTINGS_CHANGED, {
            ...getRequestMetadata(req),
            settingsId: id,
            changedBy: req.user.id,
            action: 'SETTINGS_UPDATED',
            message: 'LLM settings updated by admin',
            metadata: { fields: Object.keys(preparedSettings) }
        });

        return res.json(response);
    }));

// POST /api/settings - Create settings
router.post('/', authenticateToken, requireAdmin, validateBody(updateSettingsSchema), createSettingsRouteHandler('Error creating settings', 'Failed to create settings', async (req, res) => {
        let settingsData = req.body;

        const { response } = await persistSettingsCreateRoute({
            rawSettings: settingsData,
            getProviderAvailabilityFlags,
            reqUser: req.user
        });

        await invalidateSettingsCache();

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.SETTINGS_CHANGED, {
            ...getRequestMetadata(req),
            changedBy: req.user.id,
            action: 'SETTINGS_CREATED',
            message: 'LLM settings created by admin'
        });

        return res.status(201).json(response);
    }));

export default router;
