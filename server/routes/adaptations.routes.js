/**
 * Adaptations Routes - PostgreSQL Version
 * Handles CRUD operations for resume adaptations to missions
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateParams, validateBody, updateAdaptationSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import * as adaptationsService from '../services/adaptations.service.js';
import { invalidateDashboardAndGroupedViews } from '../services/viewCacheInvalidation.service.js';
import { shouldBypassCache } from '../utils/requestCacheControl.js';
import {
    ensureAdaptationFirmAccess,
    normalizeAdaptationPayload
} from './adaptations.routes.helpers.js';

const router = express.Router();

function parsePositiveInteger(value, fallback, max = null) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
        return { ok: false, value: fallback };
    }

    return {
        ok: true,
        value: max ? Math.min(parsed, max) : parsed
    };
}

// ============================================
// ADAPTATIONS ROUTES
// ============================================

// GET /api/adaptations - Get all adaptations (with server-side pagination and filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { resumeId, missionId, status, search } = req.query;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = await getUserFirmId(req);
        const bypassCache = shouldBypassCache(req);
        const access = ensureAdaptationFirmAccess({ isAdmin, userFirmId });
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }
        
        const pageInput = req.query.page;
        const limitInput = req.query.limit;
        const pageResult = pageInput === undefined ? { ok: true, value: 1 } : parsePositiveInteger(pageInput, 1);
        const limitResult = limitInput === undefined ? { ok: true, value: 20 } : parsePositiveInteger(limitInput, 20, 100);

        if (!pageResult.ok || !limitResult.ok) {
            return res.status(400).json({ error: 'Invalid pagination parameters' });
        }

        const { records, totalCount } = await adaptationsService.listAdaptations({
            firmId: isAdmin ? null : userFirmId,
            resumeId,
            missionId,
            status,
            search,
            page: pageResult.value,
            limit: limitResult.value,
            bypassCache
        });

        const adaptations = records.map(record => ({
            id: record.id,
            'Resume ID': record.resume_id,
            'Mission ID': record.mission_id,
            'Resume Name': record.resume_name,
            'Candidate Name': record.candidate_name,
            'Adapted Title': record.adapted_title,
            'Mission Title': record.mission_title,
            'Mission Content': record.mission_content,
            'Adapted Text': record.adapted_text,
            'Match Score': record.match_score,
            'Match Analysis': record.match_analysis,
            Status: record.status,
            'Firm ID': record.firm_id || null,
            'Firm Name': record.firm || null,
            Firm: record.firm,
            CustomerName: record.firm,
            Customer: record.firm,
            'Created At': record.created_at,
            'Updated At': record.updated_at
        }));

        const totalPages = Math.ceil(totalCount / limitResult.value);
        const hasMore = pageResult.value < totalPages;

        return res.json({
            data: adaptations,
            pagination: {
                page: pageResult.value,
                limit: limitResult.value,
                totalCount,
                totalPages,
                hasMore
            }
        });
    } catch (error) {
        safeLog('error', 'Error fetching adaptations', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch adaptations' });
    }
});

// GET /api/adaptations/grouped-by-deal - Get adaptations grouped by deal > mission
router.get('/grouped-by-deal', authenticateToken, async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = await getUserFirmId(req);
        const bypassCache = shouldBypassCache(req);

        if (!userFirmId && !isAdmin) {
            return res.status(403).json({ error: 'No firm association' });
        }

        const result = await adaptationsService.getAdaptationsGroupedByDeal({ firmId: userFirmId, isAdmin, bypassCache });
        return res.json(result);
    } catch (error) {
        safeLog('error', 'Error fetching adaptations grouped by deal', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch grouped adaptations' });
    }
});

// GET /api/adaptations/:id - Get single adaptation
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const record = await adaptationsService.getAdaptationById(id);
        
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = await getUserFirmId(req);
        const access = ensureAdaptationFirmAccess({ isAdmin, userFirmId, record });
        if (!access.ok) {
            return res.status(access.status).json({
                error: access.error === 'Access denied'
                    ? 'Access denied: You can only view adaptations from your firm'
                    : access.error
            });
        }
        
        // Fetch mission client/contact info if mission_id exists
        let missionClientId = null;
        let missionContactId = null;
        if (record.mission_id) {
            try {
                const missionInfo = await adaptationsService.getMissionClientContact(record.mission_id);
                missionClientId = missionInfo.client_id;
                missionContactId = missionInfo.contact_id;
            } catch (missionError) {
                safeLog('warn', 'Could not fetch mission client/contact', { error: missionError.message });
            }
        }
        
        res.json({
            id: record.id,
            'Resume ID': record.resume_id,
            'Mission ID': record.mission_id,
            'Resume Name': record.resume_name,
            'Candidate Name': record.candidate_name,
            'Adapted Title': record.adapted_title,
            'Mission Title': record.mission_title,
            'Mission Content': record.mission_content,
            'Mission Client ID': missionClientId,
            'Mission Contact ID': missionContactId,
            'Adapted Text': record.adapted_text,
            'Match Score': record.match_score,
            'Match Analysis': record.match_analysis,
            Status: record.status,
            'Firm ID': record.firm_id || null,
            'Firm Name': record.firm || null,
            Firm: record.firm,
            CustomerName: record.firm,
            Customer: record.firm,
            'Created At': record.created_at,
            'Updated At': record.updated_at
        });
    } catch (error) {
        safeLog('error', 'Error fetching adaptation', { error: error.message, adaptationId: req.params.id });
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Adaptation not found' });
        }
        res.status(500).json({ error: 'Failed to fetch adaptation' });
    }
});

// PUT /api/adaptations/:id - Update adaptation
router.put('/:id', authenticateToken, validateParams('id'), validateBody(updateAdaptationSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = await getUserFirmId(req);
        let existingRecord = null;

        // Check permissions
        if (!isAdmin) {
            existingRecord = await adaptationsService.getAdaptationById(id);
            const access = ensureAdaptationFirmAccess({ isAdmin, userFirmId, record: existingRecord });
            if (!access.ok) {
                return res.status(access.status).json({
                    error: access.error === 'Access denied'
                        ? 'You can only update adaptations from your firm'
                        : access.error
                });
            }
        }

        const normalizedUpdates = normalizeAdaptationPayload(req.body);

        const updates = {};
        if (normalizedUpdates.adaptedText !== undefined) {
            updates.adapted_text = normalizedUpdates.adaptedText;
        }
        if (normalizedUpdates.adaptedTitle !== undefined) {
            updates.adapted_title = normalizedUpdates.adaptedTitle;
        }
        if (normalizedUpdates.status !== undefined) {
            updates.status = normalizedUpdates.status;
        }
        if (normalizedUpdates.matchScore !== undefined) {
            updates.match_score = normalizedUpdates.matchScore;
        }
        if (normalizedUpdates.matchAnalysis !== undefined) {
            updates.match_analysis = normalizedUpdates.matchAnalysis;
        }

        const updatedRecord = await adaptationsService.updateAdaptation(id, updates);
        await invalidateDashboardAndGroupedViews(updatedRecord.firm_id || null);

        res.json({
            id: updatedRecord.id,
            'Resume ID': updatedRecord.resume_id,
            'Mission ID': updatedRecord.mission_id,
            'Resume Name': updatedRecord.resume_name,
            'Candidate Name': updatedRecord.candidate_name,
            'Adapted Title': updatedRecord.adapted_title,
            'Mission Title': updatedRecord.mission_title,
            'Adapted Text': updatedRecord.adapted_text,
            'Match Score': updatedRecord.match_score,
            'Match Analysis': updatedRecord.match_analysis,
            Status: updatedRecord.status,
            'Firm ID': updatedRecord.firm_id || null,
            'Firm Name': updatedRecord.firm || null,
            Firm: updatedRecord.firm,
            CustomerName: updatedRecord.firm,
            Customer: updatedRecord.firm,
            'Created At': updatedRecord.created_at,
            'Updated At': updatedRecord.updated_at
        });
    } catch (error) {
        safeLog('error', 'Error updating adaptation', { error: error.message, adaptationId: req.params.id });
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Adaptation not found' });
        }
        res.status(500).json({ error: 'Failed to update adaptation' });
    }
});

// DELETE /api/adaptations/:id - Delete adaptation
router.delete('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = await getUserFirmId(req);
        let existingRecord = null;

        // Check permissions
        if (!isAdmin) {
            existingRecord = await adaptationsService.getAdaptationById(id);
            const access = ensureAdaptationFirmAccess({ isAdmin, userFirmId, record: existingRecord });
            if (!access.ok) {
                return res.status(access.status).json({
                    error: access.error === 'Access denied'
                    ? 'You can only delete adaptations from your firm'
                        : access.error
                });
            }
        } else {
            existingRecord = await adaptationsService.getAdaptationById(id);
        }

        await adaptationsService.deleteAdaptation(id);
        await invalidateDashboardAndGroupedViews(existingRecord?.firm_id || userFirmId || null);
        res.json({ message: 'Adaptation deleted successfully' });
    } catch (error) {
        safeLog('error', 'Error deleting adaptation', { error: error.message, adaptationId: req.params.id });
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Adaptation not found' });
        }
        res.status(500).json({ error: 'Failed to delete adaptation' });
    }
});

export default router;
