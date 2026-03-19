import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateParams, validateBody, updateSettingsSchema } from '../utils/validation.js';
import { settingsCache } from '../services/cache.service.js';
import { metrics } from '../services/metrics.service.js';
import { invalidateSettingsCache } from '../services/settings.service.js';
import { normalizeWeights, DEFAULT_ANALYSIS_PROMPT, DEFAULT_IMPROVEMENT_PROMPT, DEFAULT_MATCH_ANALYSIS_PROMPT, DEFAULT_ADAPTATION_PROMPT } from '../config/prompts.backend.js';
import { safeLog } from '../utils/logger.backend.js';
import { selectWithTimeout, updateWithTimeout, createWithTimeout } from '../utils/postgresHelpers.js';

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
        
        const records = await selectWithTimeout('llm_settings', {
            limit: 1,
            orderBy: 'created_at DESC'
        });

        if (records.length === 0) {
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

        const settings = records[0];
        
        const responseData = {
            id: settings.id,
            llmModel: settings.llm_model || null,
            cvMode: settings.cv_mode || 'nominative',
            chatbotEnabled: settings.chatbot_enabled || 'on',
            'Analysis Prompt': settings.analysis_prompt || DEFAULT_ANALYSIS_PROMPT,
            'Improvement Prompt': settings.improvement_prompt || DEFAULT_IMPROVEMENT_PROMPT,
            'Match Analysis Prompt': settings.match_analysis_prompt || DEFAULT_MATCH_ANALYSIS_PROMPT,
            'Adaptation Prompt': settings.adaptation_prompt || DEFAULT_ADAPTATION_PROMPT,
            'Executive Summary Weight': settings.executive_summary_weight || 20,
            'Skills Weight': settings.skills_weight || 20,
            'Experience Weight': settings.experience_weight || 20,
            'Education Weight': settings.education_weight || 15,
            'ATS Weight': settings.ats_weight || 15,
            'Hobbies Languages Weight': settings.hobbies_languages_weight || 10,
            'DPO Name': settings.dpo_name || '',
            'DPO Email': settings.dpo_email || '',
            'DPO Phone': settings.dpo_phone || ''
        };
        
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
        const fieldsToUpdate = {
            llm_model: updateData.llmModel,
            cv_mode: updateData.cvMode,
            chatbot_enabled: updateData.chatbotEnabled,
            analysis_prompt: updateData['Analysis Prompt'],
            improvement_prompt: updateData['Improvement Prompt'],
            match_analysis_prompt: updateData['Match Analysis Prompt'],
            adaptation_prompt: updateData['Adaptation Prompt'],
            executive_summary_weight: updateData['Executive Summary Weight'],
            skills_weight: updateData['Skills Weight'],
            experience_weight: updateData['Experience Weight'],
            education_weight: updateData['Education Weight'],
            ats_weight: updateData['ATS Weight'],
            hobbies_languages_weight: updateData['Hobbies Languages Weight'],
            dpo_name: updateData['DPO Name'],
            dpo_email: updateData['DPO Email'],
            dpo_phone: updateData['DPO Phone']
        };

        // Remove undefined values
        Object.keys(fieldsToUpdate).forEach(key => {
            if (fieldsToUpdate[key] === undefined) {
                delete fieldsToUpdate[key];
            }
        });

        // Try to update first, if not found, get the first record and update it
        let records;
        try {
            records = await updateWithTimeout('llm_settings', [{
                id: id,
                fields: fieldsToUpdate
            }]);
        } catch (error) {
            if (error.statusCode === 404 || error.message.includes('not found')) {
                // Record not found, get the first existing record or create one
                const existing = await selectWithTimeout('llm_settings', {
                    limit: 1,
                    orderBy: 'created_at DESC'
                });
                
                if (existing.length > 0) {
                    // Update the existing record
                    records = await updateWithTimeout('llm_settings', [{
                        id: existing[0].id,
                        fields: fieldsToUpdate
                    }]);
                } else {
                    // Create a new record
                    const fieldsToCreate = {
                        name: 'Default Settings',
                        ...fieldsToUpdate,
                        status: 'active'
                    };
                    records = await createWithTimeout('llm_settings', [{
                        fields: fieldsToCreate
                    }]);
                }
            } else {
                throw error;
            }
        }

        // Map back to frontend format
        const result = records[0];
        res.json({
            id: result.id,
            llmModel: result.llm_model,
            cvMode: result.cv_mode,
            chatbotEnabled: result.chatbot_enabled,
            'Analysis Prompt': result.analysis_prompt,
            'Improvement Prompt': result.improvement_prompt,
            'Match Analysis Prompt': result.match_analysis_prompt,
            'Adaptation Prompt': result.adaptation_prompt,
            'Executive Summary Weight': result.executive_summary_weight,
            'Skills Weight': result.skills_weight,
            'Experience Weight': result.experience_weight,
            'Education Weight': result.education_weight,
            'ATS Weight': result.ats_weight,
            'Hobbies Languages Weight': result.hobbies_languages_weight,
            'DPO Name': result.dpo_name || '',
            'DPO Email': result.dpo_email || '',
            'DPO Phone': result.dpo_phone || ''
        });
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
            llm_model: settingsData.llmModel || 'gpt-4',
            cv_mode: settingsData.cvMode || 'nominative',
            chatbot_enabled: settingsData.chatbotEnabled || 'on',
            analysis_prompt: settingsData['Analysis Prompt'] || DEFAULT_ANALYSIS_PROMPT,
            improvement_prompt: settingsData['Improvement Prompt'] || DEFAULT_IMPROVEMENT_PROMPT,
            match_analysis_prompt: settingsData['Match Analysis Prompt'] || DEFAULT_MATCH_ANALYSIS_PROMPT,
            adaptation_prompt: settingsData['Adaptation Prompt'] || DEFAULT_ADAPTATION_PROMPT,
            executive_summary_weight: settingsData['Executive Summary Weight'] || 20,
            skills_weight: settingsData['Skills Weight'] || 20,
            experience_weight: settingsData['Experience Weight'] || 20,
            education_weight: settingsData['Education Weight'] || 15,
            ats_weight: settingsData['ATS Weight'] || 15,
            hobbies_languages_weight: settingsData['Hobbies Languages Weight'] || 10,
            dpo_name: settingsData['DPO Name'] || '',
            dpo_email: settingsData['DPO Email'] || '',
            dpo_phone: settingsData['DPO Phone'] || '',
            status: 'active'
        };

        const records = await createWithTimeout('llm_settings', [{
            fields: fieldsToCreate
        }]);

        // Map back to frontend format
        const result = records[0];
        res.status(201).json({
            id: result.id,
            llmModel: result.llm_model,
            cvMode: result.cv_mode,
            chatbotEnabled: result.chatbot_enabled,
            'Analysis Prompt': result.analysis_prompt,
            'Improvement Prompt': result.improvement_prompt,
            'Match Analysis Prompt': result.match_analysis_prompt,
            'Adaptation Prompt': result.adaptation_prompt,
            'Executive Summary Weight': result.executive_summary_weight,
            'Skills Weight': result.skills_weight,
            'Experience Weight': result.experience_weight,
            'Education Weight': result.education_weight,
            'ATS Weight': result.ats_weight,
            'Hobbies Languages Weight': result.hobbies_languages_weight,
            'DPO Name': result.dpo_name || '',
            'DPO Email': result.dpo_email || '',
            'DPO Phone': result.dpo_phone || ''
        });
    } catch (error) {
        safeLog('error', 'Error creating settings', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to create settings'
        });
    }
});

export default router;
