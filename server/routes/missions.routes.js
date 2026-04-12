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
import { invalidateDashboardAndGroupedViews } from '../services/viewCacheInvalidation.service.js';
import { shouldBypassCache } from '../utils/requestCacheControl.js';
import {
    ensureMissionFirmAccess,
    normalizeMissionPayload,
    parsePaginationParams
} from './missions.routes.helpers.js';

const router = express.Router();

function createMissionsRouteHandler(logMessage, errorMessage, handler, errorResponder = null) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            safeLog('error', logMessage, { error: error.message, missionId: req.params.id ?? req.params.missionId });
            if (errorResponder) {
                const handled = errorResponder(error, res);
                if (handled) {
                    return handled;
                }
            }
            return res.status(500).json({ error: errorMessage });
        }
    };
}

async function getMissionRequestScope(req) {
    const isAdmin = req.user?.role === 'admin';
    return {
        isAdmin,
        userFirmId: isAdmin ? null : await getUserFirmId(req)
    };
}

async function requireMissionScopeWithFirm(req, res) {
    const scope = await getMissionRequestScope(req);
    if (!scope.isAdmin && !scope.userFirmId) {
        return res.status(403).json({ error: 'No firm association' });
    }

    return scope;
}

function respondForMissingMission(errorMessage, res) {
    return res.status(404).json({ error: errorMessage });
}

function handleMissionNotFound(error, res) {
    if (error.statusCode === 404) {
        return respondForMissingMission('Mission not found', res);
    }

    if (error.statusCode === 409 && error.code === 'MISSION_DELETE_BLOCKED') {
        return res.status(409).json({
            error: 'Cannot delete mission because linked adaptations, submissions, or interviews are still attached',
            details: error.details || null
        });
    }

    return null;
}

async function requireMissionAccess(req, res, mission, deniedErrorMessage) {
    const scope = await getMissionRequestScope(req);
    const access = ensureMissionFirmAccess({
        isAdmin: scope.isAdmin,
        userFirmId: scope.userFirmId,
        mission
    });

    if (!access.ok) {
        res.status(access.status).json({
            error: access.error === 'Access denied' ? deniedErrorMessage : access.error
        });
        return null;
    }

    return { ...scope, access };
}

// ============================================
// MISSIONS ROUTES
// ============================================

// GET /api/missions - Get all missions (with server-side pagination and filters)
router.get('/', authenticateToken, createMissionsRouteHandler('Error fetching missions', 'Failed to fetch missions', async (req, res) => {
        const scope = await getMissionRequestScope(req);
        const { isAdmin } = scope;
        const bypassCache = shouldBypassCache(req);
        const pagination = parsePaginationParams(req.query.page, req.query.limit);
        if (!pagination.ok) {
            return res.status(400).json({ error: pagination.error });
        }
        const { search, status, dealId } = req.query;

        let firmId = null;
        if (!isAdmin) {
            firmId = scope.userFirmId;
            safeLog('info', 'Missions GET - user firm filter', { userFirmId: firmId, userId: req.user?.id });
            if (!firmId) {
                safeLog('warn', 'User has no valid firm_id', { userId: req.user?.id });
                return res.status(403).json({ error: 'No firm association' });
            }
        }

        const result = await missionsService.listMissions({ ...pagination.value, search, status, dealId, firmId, bypassCache });
        return res.json(result);
}));

// GET /api/missions/grouped-by-deal - Get missions grouped by deal for the "Par affaire" view
router.get('/grouped-by-deal', authenticateToken, createMissionsRouteHandler('Error fetching missions grouped by deal', 'Failed to fetch grouped missions', async (req, res) => {
        const scope = await requireMissionScopeWithFirm(req, res);
        if (!scope) {
            return;
        }
        const { isAdmin, userFirmId } = scope;
        const bypassCache = shouldBypassCache(req);

        const result = await missionsService.getMissionsGroupedByDeal({ firmId: userFirmId, isAdmin, bypassCache });
        return res.json(result);
}));

// GET /api/missions/:id - Get mission by ID
router.get('/:id', authenticateToken, validateParams('id'), createMissionsRouteHandler('Error fetching mission', 'Failed to fetch mission', async (req, res) => {
        const { id } = req.params;
        const bypassCache = shouldBypassCache(req);
        const record = await missionsService.getMissionWithJoins(id, { bypassCache });

        if (!record) {
            return respondForMissingMission('Mission not found', res);
        }

        const scope = await requireMissionAccess(req, res, record, 'Access denied: You can only view missions from your firm');
        if (!scope) {
            return;
        }

        return res.json(missionsService.mapMissionRecord(record));
}));

// POST /api/missions - Create mission
router.post('/', authenticateToken, validateBody(createMissionSchema), createMissionsRouteHandler('Error creating mission', 'Failed to create mission', async (req, res) => {
        const missionData = req.body;
        const normalizedMission = normalizeMissionPayload(missionData);
        const userFirm = req.user?.firmName || null;
        const scope = await requireMissionScopeWithFirm(req, res);
        if (!scope) {
            return;
        }
        const { isAdmin, userFirmId } = scope;
        
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

        await invalidateDashboardAndGroupedViews(targetFirmId || null);

        res.json(missionsService.mapMissionRecord(record));
}));

// PUT /api/missions/:id - Update mission
router.put('/:id', authenticateToken, validateParams('id'), validateBody(updateMissionSchema), createMissionsRouteHandler(
    'Error updating mission',
    'Failed to update mission',
    async (req, res) => {
        const { id } = req.params;
        const updateData = req.body;
        const normalizedUpdates = normalizeMissionPayload(updateData);
        const existingMission = await missionsService.findMission(id);
        const scope = await requireMissionAccess(req, res, existingMission, 'Not authorized to update this mission');
        if (!scope) {
            return;
        }
        const { isAdmin } = scope;

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
        await invalidateDashboardAndGroupedViews(targetFirmId || existingMission.firm_id || null);
        return res.json(missionsService.mapMissionRecord(record));
    },
    handleMissionNotFound
));

// DELETE /api/missions/:id - Delete mission
router.delete('/:id', authenticateToken, validateParams('id'), createMissionsRouteHandler(
    'Error deleting mission',
    'Failed to delete mission',
    async (req, res) => {
        const { id } = req.params;
        const scope = await getMissionRequestScope(req);
        let invalidationFirmId = null;

        if (!scope.isAdmin) {
            const existingRecord = await missionsService.findMission(id);
            invalidationFirmId = existingRecord.firm_id || null;
            const access = ensureMissionFirmAccess({
                isAdmin: scope.isAdmin,
                userFirmId: scope.userFirmId,
                mission: existingRecord
            });
            if (!access.ok) {
                return res.status(access.status).json({
                    error: access.error === 'Access denied'
                        ? 'You can only delete missions from your firm'
                        : access.error
                });
            }
        } else {
            const existingRecord = await missionsService.findMission(id);
            invalidationFirmId = existingRecord.firm_id || null;
        }

        await missionsService.deleteMission(id);
        await invalidateDashboardAndGroupedViews(invalidationFirmId || scope.userFirmId || null);
        return res.json({ message: 'Mission deleted successfully' });
    },
    handleMissionNotFound
));

// GET /api/missions/:missionId/adaptations - Get adaptations for a specific mission
router.get('/:missionId/adaptations', authenticateToken, validateParams('missionId'), createMissionsRouteHandler(
    'Error fetching mission adaptations',
    'Failed to fetch mission adaptations',
    async (req, res) => {
        const { missionId } = req.params;
        const mission = await missionsService.findMission(missionId);
        const scope = await requireMissionAccess(
            req,
            res,
            mission,
            'Access denied: You can only view adaptations for missions from your firm'
        );
        if (!scope) {
            return;
        }

        const adaptations = await missionsService.listMissionAdaptations(missionId);
        return res.json(adaptations);
    }
));
// PROFILE MATCHING ROUTES
// ============================================

// DELETE /api/missions/:missionId/keywords-cache - Clear cached keywords for a mission
router.delete('/:missionId/keywords-cache', authenticateToken, validateParams('missionId'), createMissionsRouteHandler(
    'Error clearing keywords cache',
    'Failed to clear keywords cache',
    async (req, res) => {
        const { missionId } = req.params;
        const missionRecord = await missionsService.findMission(missionId);
        const scope = await requireMissionAccess(req, res, missionRecord, 'Access denied');
        if (!scope) {
            return;
        }

        const { clearMissionKeywordsCache } = await import('../services/profileMatching.service.js');

        await clearMissionKeywordsCache(missionId);
        return res.json({ message: 'Keywords cache cleared successfully' });
    }
));

export default router;
