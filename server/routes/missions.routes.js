/**
 * Missions Routes - PostgreSQL Version
 * Handles CRUD operations for job missions/offers
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, createMissionSchema, updateMissionSchema } from '../utils/validation.js';
import { sanitizeHtmlContent } from '../utils/sanitizer.backend.js';
import { safeLog } from '../utils/logger.backend.js';
import { sanitizeErrorMessage } from '../utils/errors.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import * as missionsService from '../services/missions.service.js';

const router = express.Router();

// ============================================
// MISSIONS ROUTES
// ============================================

// GET /api/missions - Get all missions (with server-side pagination and filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const { search, status, dealId } = req.query;

        let firmId = null;
        if (!isAdmin) {
            firmId = await getUserFirmId(req);
            safeLog('info', 'Missions GET - user firm filter', { userFirmId: firmId, userId: req.user?.id });
            if (!firmId) {
                safeLog('warn', 'User has no valid firm_id, returning empty results', { userId: req.user?.id });
                return res.json({
                    records: [],
                    pagination: { page: 1, limit, totalPages: 0, totalCount: 0, hasMore: false }
                });
            }
        }

        const result = await missionsService.listMissions({ page, limit, search, status, dealId, firmId });
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
        const userFirm = req.user?.firm;
        const userFirmId = await getUserFirmId(req);
        
        if (!isAdmin && record.firm !== userFirm && record.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied: You can only view missions from your firm' });
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
        const userFirm = req.user?.firm;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = req.user?.role === 'admin';
        
        // Determine target firm_id: admin can specify any firm
        let targetFirmId = userFirmId;
        let targetFirmName = userFirm;
        const requestedFirmId = missionData.firm_id || missionData['Firm ID'];
        
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
        
        let content = missionData.Content || missionData.content || '';
        if (content) {
            content = sanitizeHtmlContent(content);
        }
        
        // Validate client_id if provided
        const clientId = missionData['Client ID'] || missionData.client_id || null;
        if (clientId) {
            const clientCheck = await missionsService.validateClient(clientId, targetFirmId);
            if (!clientCheck.exists) {
                return res.status(400).json({ error: 'Client not found' });
            }
            if (!clientCheck.firmMatch) {
                safeLog('warn', 'Client firm mismatch', { targetFirmId, userId: req.user?.id });
                return res.status(403).json({ error: 'Client does not belong to the target firm' });
            }
        }
        
        // Validate contact_id if provided
        const contactId = missionData['Contact ID'] || missionData.contact_id || null;
        if (contactId && clientId) {
            const contactValid = await missionsService.validateContact(contactId, clientId);
            if (!contactValid) {
                return res.status(400).json({ error: 'Contact not found or does not belong to this client' });
            }
        }

        // Validate deal_id if provided
        const dealId = missionData['Deal ID'] || missionData.deal_id || null;
        if (dealId) {
            const dealCheck = await missionsService.validateDeal(dealId, targetFirmId);
            if (!dealCheck.exists) {
                return res.status(400).json({ error: 'Deal not found' });
            }
            if (!dealCheck.firmMatch) {
                return res.status(403).json({ error: 'Deal does not belong to the target firm' });
            }
        }
        
        safeLog('info', 'Creating mission with firm data', {
            targetFirmId, targetFirmName, requestedFirmId, userFirmId, isAdmin
        });
        
        const record = await missionsService.createMission({
            title: missionData.Title || missionData.title,
            content: content,
            firm: targetFirmName || missionData.Firm || missionData.firm || null,
            firm_id: targetFirmId || null,
            status: missionData.Status || missionData.status || 'active',
            keywords: missionData.Keywords || missionData.keywords || null,
            required_skills: missionData['Required Skills'] || missionData.required_skills || null,
            preferred_skills: missionData['Preferred Skills'] || missionData.preferred_skills || null,
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
        const isAdmin = req.user?.role === 'admin';
        const userFirm = req.user?.firm;
        const userFirmId = await getUserFirmId(req);

        const existingMission = await missionsService.findMission(id);

        if (!isAdmin && existingMission.firm !== userFirm && existingMission.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Not authorized to update this mission' });
        }

        // Build update object
        const updates = {};
        
        if (updateData.Title !== undefined || updateData.title !== undefined) {
            updates.title = updateData.Title || updateData.title;
        }
        if (updateData.Content !== undefined || updateData.content !== undefined) {
            updates.content = sanitizeHtmlContent(updateData.Content || updateData.content);
        }
        if (updateData.Status !== undefined || updateData.status !== undefined) {
            updates.status = updateData.Status || updateData.status;
        }
        if (updateData.Keywords !== undefined || updateData.keywords !== undefined) {
            updates.keywords = updateData.Keywords || updateData.keywords;
        }
        if (updateData['Required Skills'] !== undefined || updateData.required_skills !== undefined) {
            updates.required_skills = updateData['Required Skills'] || updateData.required_skills;
        }
        if (updateData['Preferred Skills'] !== undefined || updateData.preferred_skills !== undefined) {
            updates.preferred_skills = updateData['Preferred Skills'] || updateData.preferred_skills;
        }
        
        // Handle client_id update
        if (updateData['Client ID'] !== undefined || updateData.client_id !== undefined) {
            const clientId = updateData['Client ID'] || updateData.client_id;
            if (clientId) {
                const clientCheck = await missionsService.validateClient(clientId, userFirmId);
                if (!clientCheck.exists) {
                    return res.status(400).json({ error: 'Client not found' });
                }
                if (!clientCheck.firmMatch) {
                    return res.status(403).json({ error: 'Client does not belong to your firm' });
                }
            }
            updates.client_id = clientId || null;
        }
        
        // Handle contact_id update
        if (updateData['Contact ID'] !== undefined || updateData.contact_id !== undefined) {
            const contactId = updateData['Contact ID'] || updateData.contact_id;
            const clientId = updates.client_id || existingMission.client_id;
            if (contactId && clientId) {
                const contactValid = await missionsService.validateContact(contactId, clientId);
                if (!contactValid) {
                    return res.status(400).json({ error: 'Contact not found or does not belong to this client' });
                }
            }
            updates.contact_id = contactId || null;
        }
        
        // Handle deal_id update
        if (updateData['Deal ID'] !== undefined || updateData.deal_id !== undefined) {
            const newDealId = updateData['Deal ID'] || updateData.deal_id;
            if (newDealId) {
                const dealCheck = await missionsService.validateDeal(newDealId, userFirmId);
                if (!dealCheck.exists) {
                    return res.status(400).json({ error: 'Deal not found' });
                }
                if (!dealCheck.firmMatch) {
                    return res.status(403).json({ error: 'Deal does not belong to your firm' });
                }
            }
            updates.deal_id = newDealId || null;
        }

        // Handle firm_id update (admin only)
        if (isAdmin && (updateData.firm_id || updateData['Firm ID'])) {
            const newFirmId = updateData.firm_id || updateData['Firm ID'];
            const firm = await missionsService.validateFirm(newFirmId);
            if (!firm) {
                return res.status(400).json({ error: 'Specified firm not found' });
            }
            updates.firm_id = firm.id;
            updates.firm = firm.name;
            if (newFirmId !== existingMission.firm_id) {
                safeLog('info', 'Admin changing mission firm', { 
                    adminId: req.user?.id, 
                    missionId: id,
                    oldFirmId: existingMission.firm_id,
                    newFirmId: updates.firm_id 
                });
            }
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
        const userFirm = req.user?.firm;
        const userFirmId = await getUserFirmId(req);

        if (!isAdmin) {
            const existingRecord = await missionsService.findMission(id);
            if (existingRecord.firm !== userFirm && existingRecord.firm_id !== userFirmId) {
                return res.status(403).json({ error: 'You can only delete missions from your firm' });
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
        const userFirm = req.user?.firm;
        const userFirmId = await getUserFirmId(req);
        
        // Verify mission belongs to user's firm
        if (!isAdmin) {
            const mission = await missionsService.findMission(missionId);
            if (mission.firm !== userFirm && mission.firm_id !== userFirmId) {
                return res.status(403).json({ error: 'Access denied: You can only view adaptations for missions from your firm' });
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

// POST /api/missions/:missionId/find-profiles - Find best matching profiles for a mission
router.post('/:missionId/find-profiles', authenticateToken, validateParams('missionId'), async (req, res) => {
    try {
        const { missionId } = req.params;
        const { limit = 0, minScore = 0, status, weights, dealId } = req.body;
        
        const isAdmin = req.user?.role === 'admin';
        const userFirm = req.user?.firm || req.user?.firm_id;
        
        // Verify mission access
        const missionRecord = await missionsService.findMission(missionId);
        
        if (!isAdmin && missionRecord.firm !== userFirm) {
            return res.status(403).json({ error: 'Access denied: You can only search profiles for your missions' });
        }
        
        // Build user metadata for LLM calls
        const userMetadata = {
            userId: req.user?.id,
            userName: req.user?.name,
            firm: userFirm
        };
        
        // Import the service dynamically to avoid circular dependencies
        const { findMatchingProfiles } = await import('../services/profileMatching.service.js');
        
        // Find matching profiles
        const results = await findMatchingProfiles(missionId, {
            limit: Math.max(0, limit),
            minScore: Math.max(0, Math.min(100, minScore)),
            status,
            firm: isAdmin ? null : userFirm,
            weights,
            dealId: dealId || null
        }, userMetadata);
        
        res.json(results);
    } catch (error) {
        safeLog('error', 'Error finding matching profiles', { error: error.message, missionId: req.params.missionId });
        res.status(500).json({ error: sanitizeErrorMessage(error, 'Failed to find matching profiles') });
    }
});

// DELETE /api/missions/:missionId/keywords-cache - Clear cached keywords for a mission
router.delete('/:missionId/keywords-cache', authenticateToken, validateParams('missionId'), async (req, res) => {
    try {
        const { missionId } = req.params;
        
        const isAdmin = req.user?.role === 'admin';
        const userFirm = req.user?.firm || req.user?.firm_id;
        
        // Verify mission access
        const missionRecord = await missionsService.findMission(missionId);
        
        if (!isAdmin && missionRecord.firm !== userFirm) {
            return res.status(403).json({ error: 'Access denied' });
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

// POST /api/missions/:missionId/analyze-profile/:resumeId - Detailed LLM analysis of a profile for a mission
router.post('/:missionId/analyze-profile/:resumeId', authenticateToken, async (req, res) => {
    try {
        const { missionId, resumeId } = req.params;
        
        const isAdmin = req.user?.role === 'admin';
        const userFirm = req.user?.firm || req.user?.firm_id;
        
        // Verify mission access
        const missionRecord = await missionsService.findMission(missionId);
        
        if (!isAdmin && missionRecord.firm !== userFirm) {
            return res.status(403).json({ error: 'Access denied: You can only analyze profiles for your missions' });
        }
        
        // Build user metadata for LLM calls
        const userMetadata = {
            userId: req.user?.id,
            userName: req.user?.name,
            firm: userFirm
        };
        
        // Import the service dynamically
        const { analyzeProfileForMission } = await import('../services/profileMatching.service.js');
        
        // Perform detailed analysis
        const analysis = await analyzeProfileForMission(missionId, resumeId, userMetadata);
        
        res.json(analysis);
    } catch (error) {
        safeLog('error', 'Error analyzing profile', { 
            error: error.message,
            missionId: req.params.missionId,
            resumeId: req.params.resumeId 
        });
        res.status(500).json({ error: sanitizeErrorMessage(error, 'Failed to analyze profile') });
    }
});

export default router;
