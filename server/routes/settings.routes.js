import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateParams, validateBody, updateSettingsSchema } from '../utils/validation.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../services/security.service.js';
import { settingsCache } from '../services/cache.service.js';
import { metrics } from '../services/metrics.service.js';
import { invalidateSettingsCache, getSettings, upsertSettings, createSettings } from '../services/settings.service.js';
import { normalizeWeights, DEFAULT_ANALYSIS_PROMPT, DEFAULT_IMPROVEMENT_PROMPT, DEFAULT_MATCH_ANALYSIS_PROMPT, DEFAULT_ADAPTATION_PROMPT } from '../config/prompts.backend.js';
import { safeLog } from '../utils/logger.backend.js';
import { mapSettingsToFrontend, mapSettingsFromFrontend } from '../utils/mappers.js';

const router = express.Router();

// ============================================
// SETTINGS ROUTES (PostgreSQL)
// ============================================

// GET /api/settings - Get settings
router.get('/', authenticateToken, async (req, res) => {
    try {
        const cachedSettings = settingsCache.get('settings');
        if (cachedSettings) {
            metrics.trackCacheHit();
            safeLog('debug', 'Returning cached settings');
            return res.json(cachedSettings);
        }
        
        metrics.trackCacheMiss();
        safeLog('debug', 'Cache miss - fetching settings from PostgreSQL');
        
        const settings = await getSettings();

        if (!settings) {
            safeLog('info', 'No settings found, returning defaults');
            
            const defaultSettings = {
                id: null,
                llmModel: null,
                cvMode: 'nominative',
                chatbotEnabled: 'on',
                'Analysis Prompt': DEFAULT_ANALYSIS_PROMPT,
                'Improvement Prompt': DEFAULT_IMPROVEMENT_PROMPT,
                'Match Analysis Prompt': DEFAULT_MATCH_ANALYSIS_PROMPT,
                'Adaptation Prompt': DEFAULT_ADAPTATION_PROMPT,
                'Executive Summary Weight': 20,
                'Skills Weight': 20,
                'Experience Weight': 20,
                'Education Weight': 15,
                'ATS Weight': 15,
                'Hobbies Languages Weight': 10
            };
            
            return res.json(defaultSettings);
        }

        const responseData = mapSettingsToFrontend(settings);
        
        settingsCache.set('settings', responseData);
        
        res.json(responseData);
    } catch (error) {
        safeLog('error', 'Error fetching settings', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch settings'
        });
    }
});

// PUT /api/settings/:id - Update settings (or create if not exists)
router.put('/:id', authenticateToken, requireAdmin, validateParams('id'), validateBody(updateSettingsSchema), async (req, res) => {
    try {
        const { id } = req.params;
        let updateData = req.body;
        
        settingsCache.invalidate('settings');
        invalidateSettingsCache();

        safeLog('info', 'Updating settings', { settingsId: id });

        delete updateData.id;
        updateData = normalizeWeights(updateData);

        safeLog('debug', 'Settings normalized', { fields: Object.keys(updateData) });
        
        // Map frontend fields to PostgreSQL columns
        const fieldsToUpdate = mapSettingsFromFrontend(updateData);

        const result = await upsertSettings(id, fieldsToUpdate);
        
        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.SETTINGS_CHANGED, {
            ...getRequestMetadata(req),
            settingsId: id,
            changedBy: req.user.id,
            action: 'SETTINGS_UPDATED',
            message: 'LLM settings updated by admin',
            metadata: { fields: Object.keys(updateData) }
        });
        
        res.json(mapSettingsToFrontend(result));
    } catch (error) {
        safeLog('error', 'Error updating settings', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to update settings'
        });
    }
});

// POST /api/settings - Create settings
router.post('/', authenticateToken, requireAdmin, validateBody(updateSettingsSchema), async (req, res) => {
    try {
        let settingsData = req.body;
        
        settingsCache.invalidate('settings');
        invalidateSettingsCache();

        settingsData = normalizeWeights(settingsData);

        // Map frontend fields to PostgreSQL columns
        const fieldsToCreate = {
            name: settingsData.llmModel || 'Default Settings',
            ...mapSettingsFromFrontend(settingsData),
            status: 'active'
        };

        const result = await createSettings(fieldsToCreate);
        
        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.SETTINGS_CHANGED, {
            ...getRequestMetadata(req),
            changedBy: req.user.id,
            action: 'SETTINGS_CREATED',
            message: 'LLM settings created by admin'
        });
        
        res.status(201).json(mapSettingsToFrontend(result));
    } catch (error) {
        safeLog('error', 'Error creating settings', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to create settings'
        });
    }
});

export default router;
