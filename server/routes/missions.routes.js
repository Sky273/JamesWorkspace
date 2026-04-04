/**
 * Missions Routes - PostgreSQL Version
 * Handles CRUD operations for job missions/offers
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, createMissionSchema, updateMissionSchema } from '../utils/validation.js';
import { sanitizeHtmlContent } from '../utils/sanitizer.backend.js';
import { safeLog } from '../utils/logger.backend.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import * as missionsService from '../services/missions.service.js';
import {
    ensureMissionFirmAccess,
    normalizeMissionPayload,
    parsePaginationParams
} from './missions.routes.helpers.js';

const router = express.Router();

// ============================================
// MISSIONS ROUTES
// ============================================

// GET /api/missions - Get all missions (with server-side pagination and filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const pagination = parsePaginationParams(req.query.page, req.query.limit);
        if (!pagination.ok) {
            return res.status(400).json({ error: pagination.error });
        }
        const { search, status, dealId } = req.query;

        let firmId = null;
        if (!isAdmin) {
            firmId = await getUserFirmId(req);
            safeLog('info', 'Missions GET - user firm filter', { userFirmId: firmId, userId: req.user?.id });
            if (!firmId) {
                safeLog('warn', 'User has no valid firm_id', { userId: req.user?.id });
                return res.status(403).json({ error: 'No firm association' });
            }
        }

        const result = await missionsService.listMissions({ ...pagination.value, search, status, dealId, firmId });
        return res.json(result);
    } catch (error) {
        safeLog('error', 'Error fetching missions', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch missions' });
    }
});

// GET /api/missions/grouped-by-deal - Get missions grouped by deal for the "Par affaire" view
router.get('/grouped-by-deal', authenticateToken, async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = await getUserFirmId(req);

        if (!userFirmId && !isAdmin) {
            return res.status(403).json({ error: 'No firm association' });
        }

        const result = await missionsService.getMissionsGroupedByDeal({ firmId: userFirmId, isAdmin });
        return res.json(result);
    } catch (error) {
        safeLog('error', 'Error fetching missions grouped by deal', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch grouped missions' });
    }
});

// GET /api/missions/:id - Get mission by ID
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        
        const record = await missionsService.getMissionWithJoins(id);
        
        if (!record) {
            return res.status(404).json({ error: 'Mission not found' });
        }
        
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = await getUserFirmId(req);
        const access = ensureMissionFirmAccess({
            isAdmin,
            userFirmId,
            mission: record
        });

        if (!access.ok) {
            return res.status(access.status).json({
                error: access.error === 'Access denied'
                    ? 'Access denied: You can only view missions from your firm'
                    : access.error
            });
        }
        
        res.json(missionsService.mapMissionRecord(record));
    } catch (error) {
        safeLog('error', 'Error fetching mission', { error: error.message, missionId: req.params.id });
        res.status(500).json({ error: 'Failed to fetch mission' });
    }
});

// POST /api/missions - Create mission
router.post('/', authenticateToken, validateBody(createMissionSchema), async (req, res) => {
    try {
        const missionData = req.body;
        const normalizedMission = normalizeMissionPayload(missionData);
        const userFirm = req.user?.firmName || null;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = req.user?.role === 'admin';

        if (!isAdmin && !userFirmId) {
            return res.status(403).json({ error: 'No firm association' });
        }
        
        // Determine target firm_id: admin can specify any firm
        let targetFirmId = userFirmId;
        let targetFirmName = userFirm;
        const requestedFirmId = normalizedMission.firmId;
        
        if (isAdmin && requestedFirmId) {
            const firm = await missionsService.validateFirm(requestedFirmId);
            if (!firm) {
                return res.status(400).json({ error: 'Specified firm not found' });
            }
            targetFirmId = firm.id;
            targetFirmName = firm.name;
            if (requestedFirmId !== userFirmId) {
                safeLog('info', 'Admin creating mission for another firm', { 
                    adminId: req.user?.id, targetFirmId, targetFirmName 
                });
            }
        }
        
        let content = normalizedMission.content || '';
        if (content) {
            content = sanitizeHtmlContent(content);
        }

        const clientId = normalizedMission.clientId || null;
        const contactId = normalizedMission.contactId || null;
        const dealId = normalizedMission.dealId || null;

        const associationsCheck = await missionsService.validateMissionAssociations({
            clientId,
            contactId,
            dealId,
            expectedFirmId: targetFirmId
        });
        if (!associationsCheck.ok) {
            if (associationsCheck.error === 'Client does not belong to the target firm') {
                safeLog('warn', 'Client firm mismatch', { targetFirmId, userId: req.user?.id });
            }
            return res.status(associationsCheck.status).json({ error: associationsCheck.error });
        }
        
        safeLog('info', 'Creating mission with firm data', {
            targetFirmId, targetFirmName, requestedFirmId, userFirmId, isAdmin
        });
        
        const record = await missionsService.createMission({
            title: normalizedMission.title,
            content: content,
            firm: targetFirmName || normalizedMission.firm || null,
            firm_id: targetFirmId || null,
            status: normalizedMission.status || 'active',
            keywords: normalizedMission.keywords || null,
            required_skills: normalizedMission.requiredSkills || null,
            preferred_skills: normalizedMission.preferredSkills || null,
            client_id: clientId,
            contact_id: contactId,
            deal_id: dealId
        });

        res.json(missionsService.mapMissionRecord(record));
    } catch (error) {
        safeLog('error', 'Error creating mission', { error: error.message });
        res.status(500).json({ error: 'Failed to create mission' });
    }
});

// PUT /api/missions/:id - Update mission
router.put('/:id', authenticateToken, validateParams('id'), validateBody(updateMissionSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const normalizedUpdates = normalizeMissionPayload(updateData);
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = await getUserFirmId(req);

        const existingMission = await missionsService.findMission(id);
        const access = ensureMissionFirmAccess({
            isAdmin,
            userFirmId,
            mission: existingMission
        });

        if (!access.ok) {
            return res.status(access.status).json({
                error: access.error === 'Access denied'
                    ? 'Not authorized to update this mission'
                    : access.error
            });
        }

        // Build update object
        const updates = {};
        
        if (normalizedUpdates.title !== undefined) {
            updates.title = normalizedUpdates.title;
        }
        if (normalizedUpdates.content !== undefined) {
            updates.content = sanitizeHtmlContent(normalizedUpdates.content);
        }
        if (normalizedUpdates.status !== undefined) {
            updates.status = normalizedUpdates.status;
        }
        if (normalizedUpdates.keywords !== undefined) {
            updates.keywords = normalizedUpdates.keywords;
        }
        if (normalizedUpdates.requiredSkills !== undefined) {
            updates.required_skills = normalizedUpdates.requiredSkills;
        }
        if (normalizedUpdates.preferredSkills !== undefined) {
            updates.preferred_skills = normalizedUpdates.preferredSkills;
        }

        const missionContentChanged =
            normalizedUpdates.title !== undefined ||
            normalizedUpdates.content !== undefined ||
            normalizedUpdates.requiredSkills !== undefined ||
            normalizedUpdates.preferredSkills !== undefined;

        if (normalizedUpdates.keywords === undefined && missionContentChanged) {
            updates.keywords = null;
        }
        
        let targetFirmId = existingMission.firm_id;
        let targetFirmName = existingMission.firm;
        if (isAdmin && normalizedUpdates.firmId) {
            const newFirmId = normalizedUpdates.firmId;
            const firm = await missionsService.validateFirm(newFirmId);
            if (!firm) {
                return res.status(400).json({ error: 'Specified firm not found' });
            }
            targetFirmId = firm.id;
            targetFirmName = firm.name;
            if (newFirmId !== existingMission.firm_id) {
                safeLog('info', 'Admin changing mission firm', {
                    adminId: req.user?.id,
                    missionId: id,
                    oldFirmId: existingMission.firm_id,
                    newFirmId: targetFirmId
                });
            }
        }

        if (normalizedUpdates.clientId !== undefined) {
            updates.client_id = normalizedUpdates.clientId || null;
        }

        if (normalizedUpdates.contactId !== undefined) {
            updates.contact_id = normalizedUpdates.contactId || null;
        }

        if (normalizedUpdates.dealId !== undefined) {
            updates.deal_id = normalizedUpdates.dealId || null;
        }

        const finalClientId = Object.prototype.hasOwnProperty.call(updates, 'client_id') ? updates.client_id : existingMission.client_id;
        const finalContactId = Object.prototype.hasOwnProperty.call(updates, 'contact_id') ? updates.contact_id : existingMission.contact_id;
        const finalDealId = Object.prototype.hasOwnProperty.call(updates, 'deal_id') ? updates.deal_id : existingMission.deal_id;
        const associationsCheck = await missionsService.validateMissionAssociations({
            clientId: finalClientId,
            contactId: finalContactId,
            dealId: finalDealId,
            expectedFirmId: targetFirmId
        });
        if (!associationsCheck.ok) {
            const translatedError = associationsCheck.error === 'Client does not belong to the target firm'
                ? 'Client does not belong to your firm'
                : associationsCheck.error === 'Deal does not belong to the target firm'
                    ? 'Deal does not belong to your firm'
                    : associationsCheck.error;
            return res.status(associationsCheck.status).json({ error: translatedError });
        }

        if (isAdmin && normalizedUpdates.firmId) {
            updates.firm_id = targetFirmId;
            updates.firm = targetFirmName;
        }

        const record = await missionsService.updateMission(id, updates);
        res.json(missionsService.mapMissionRecord(record));
    } catch (error) {
        safeLog('error', 'Error updating mission', { error: error.message, missionId: req.params.id });
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Mission not found' });
        }
        res.status(500).json({ error: 'Failed to update mission' });
    }
});

// DELETE /api/missions/:id - Delete mission
router.delete('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = await getUserFirmId(req);

        if (!isAdmin) {
            const existingRecord = await missionsService.findMission(id);
            const access = ensureMissionFirmAccess({
                isAdmin,
                userFirmId,
                mission: existingRecord
            });
            if (!access.ok) {
                return res.status(access.status).json({
                    error: access.error === 'Access denied'
                        ? 'You can only delete missions from your firm'
                        : access.error
                });
            }
        }

        await missionsService.deleteMission(id);
        res.json({ message: 'Mission deleted successfully' });
    } catch (error) {
        safeLog('error', 'Error deleting mission', { error: error.message, missionId: req.params.id });
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Mission not found' });
        }
        res.status(500).json({ error: 'Failed to delete mission' });
    }
});

// GET /api/missions/:missionId/adaptations - Get adaptations for a specific mission
router.get('/:missionId/adaptations', authenticateToken, validateParams('missionId'), async (req, res) => {
    try {
        const { missionId } = req.params;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = await getUserFirmId(req);
        
        // Verify mission belongs to user's firm
        if (!isAdmin) {
            const mission = await missionsService.findMission(missionId);
            const access = ensureMissionFirmAccess({
                isAdmin,
                userFirmId,
                mission
            });
            if (!access.ok) {
                return res.status(access.status).json({
                    error: access.error === 'Access denied'
                        ? 'Access denied: You can only view adaptations for missions from your firm'
                        : access.error
                });
            }
        }
        
        const adaptations = await missionsService.listMissionAdaptations(missionId);
        res.json(adaptations);
    } catch (error) {
        safeLog('error', 'Error fetching mission adaptations', { error: error.message, missionId: req.params.missionId });
        res.status(500).json({ error: 'Failed to fetch mission adaptations' });
    }
});
// PROFILE MATCHING ROUTES
// ============================================

// DELETE /api/missions/:missionId/keywords-cache - Clear cached keywords for a mission
router.delete('/:missionId/keywords-cache', authenticateToken, validateParams('missionId'), async (req, res) => {
    try {
        const { missionId } = req.params;
        
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = await getUserFirmId(req);
        
        // Verify mission access
        const missionRecord = await missionsService.findMission(missionId);
        const access = ensureMissionFirmAccess({
            isAdmin,
            userFirmId,
            mission: missionRecord
        });

        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }
        
        // Import the service dynamically
        const { clearMissionKeywordsCache } = await import('../services/profileMatching.service.js');
        
        await clearMissionKeywordsCache(missionId);
        res.json({ message: 'Keywords cache cleared successfully' });
    } catch (error) {
        safeLog('error', 'Error clearing keywords cache', { error: error.message, missionId: req.params.missionId });
        res.status(500).json({ error: 'Failed to clear keywords cache' });
    }
});

export default router;
