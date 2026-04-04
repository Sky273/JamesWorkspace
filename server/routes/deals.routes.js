/**
 * Deals Routes
 * Handles CRUD operations for deals (affaires) and deal-resume associations
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, createDealSchema, updateDealSchema, addDealResumeSchema, updateDealResumeSchema, addResumeToMultipleDealsSchema } from '../utils/validation.js';
import { userRateLimit } from '../middleware/rateLimit.middleware.js';
import { safeLog } from '../utils/logger.backend.js';
import { getUserFirmId, isUserAdmin } from '../utils/firmHelpers.js';
import {
    checkDealAccess,
    ensureFirmScopedAccess,
    normalizeDealPayload,
    parsePaginationParams,
    requireDealAccess,
    requireFirmScopedAccess,
    requireResumeFirmAccess,
    resolveDealRelationIds,
    resolveScopedFirmId,
    validateDealRelations
} from './deals.routes.helpers.js';
import {
    createDeal,
    updateDeal,
    deleteDeal,
    getDealById,
    getDeals,
    addResumeToDeal,
    removeResumeFromDeal,
    updateDealResumeStatus,
    getDealsForResume,
    getResumesForDeal,
    getDealStats,
    getDealFirmId,
    getClientFirmId,
    getContactOwnership,
    getResumeFirmId,
    getMissionsForDeal,
    DEAL_STATUS,
    DEAL_PRIORITY,
    DEAL_RESUME_STATUS
} from '../services/deals.service.js';

const router = express.Router();

// ============================================
// DEALS CRUD ROUTES
// ============================================

// GET /api/deals - Get all deals with pagination and filters
router.get('/', authenticateToken, async (req, res) => {
    try {
        const scopedAccess = await requireFirmScopedAccess(req, res, { getUserFirmId, isUserAdmin });
        if (!scopedAccess) return;

        const pagination = parsePaginationParams(req.query.page, req.query.limit);
        if (!pagination.ok) {
            return res.status(400).json({ error: pagination.error });
        }

        const firmId = resolveScopedFirmId({ scopedAccess, requestedFirmId: req.query.firmId });
        
        const filters = {
            clientId: req.query.clientId,
            status: req.query.status,
            priority: req.query.priority,
            search: req.query.search
        };

        const result = await getDeals(firmId, filters, pagination.value);
        return res.json(result);
    } catch (error) {
        safeLog('error', 'Error fetching deals', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch deals' });
    }
});

// GET /api/deals/stats - Get deal statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const scopedAccess = await requireFirmScopedAccess(req, res, { getUserFirmId, isUserAdmin });
        if (!scopedAccess) return;

        const firmId = resolveScopedFirmId({ scopedAccess, requestedFirmId: req.query.firmId });
        const stats = await getDealStats(firmId);
        return res.json(stats);
    } catch (error) {
        safeLog('error', 'Error fetching deal stats', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch deal statistics' });
    }
});

// GET /api/deals/statuses - Get available deal statuses
router.get('/statuses', authenticateToken, (req, res) => {
    return res.json(Object.values(DEAL_STATUS));
});

// GET /api/deals/priorities - Get available deal priorities
router.get('/priorities', authenticateToken, (req, res) => {
    return res.json(Object.values(DEAL_PRIORITY));
});

// GET /api/deals/resume-statuses - Get available deal-resume statuses
router.get('/resume-statuses', authenticateToken, (req, res) => {
    return res.json(Object.values(DEAL_RESUME_STATUS));
});

// GET /api/deals/:id - Get a single deal
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const access = await requireDealAccess(req, res, id, { getDealFirmId, getUserFirmId, isUserAdmin });
        if (!access) return;

        const deal = await getDealById(id);
        return res.json(deal);
    } catch (error) {
        safeLog('error', 'Error fetching deal', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch deal' });
    }
});

// GET /api/deals/:id/missions - Get missions associated with a deal
router.get('/:id/missions', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const access = await requireDealAccess(req, res, id, { getDealFirmId, getUserFirmId, isUserAdmin });
        if (!access) return;

        const missions = await getMissionsForDeal(id);
        return res.json(missions);
    } catch (error) {
        safeLog('error', 'Error fetching deal missions', { error: error.message, dealId: req.params.id });
        return res.status(500).json({ error: 'Failed to fetch deal missions' });
    }
});

// POST /api/deals - Create a new deal
router.post('/', authenticateToken, userRateLimit(), validateBody(createDealSchema), async (req, res) => {
    try {
        safeLog('info', 'Creating deal - request received', {
            bodyKeys: Object.keys(req.body || {})
        });
        
        const userFirmId = await getUserFirmId(req);
        safeLog('info', 'Creating deal - firm check', { userFirmId });
        const access = ensureFirmScopedAccess({ isAdmin: isUserAdmin(req), userFirmId });
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }
        if (!userFirmId) {
            return res.status(403).json({ error: 'No firm association' });
        }

        const userId = req.user?.id;
        safeLog('info', 'Creating deal - user check', { userId });
        
        if (!userId) {
            return res.status(401).json({ error: 'User ID not found' });
        }

        const normalizedDeal = normalizeDealPayload(req.body);

        // Validate required fields
        const { title } = normalizedDeal;
        if (!title || title.trim().length === 0) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const relationIds = resolveDealRelationIds({
            body: req.body,
            normalizedDeal
        });
        const relationValidation = await validateDealRelations(
            { firmId: userFirmId, clientId: relationIds.clientId, contactId: relationIds.contactId },
            { getClientFirmId, getContactOwnership }
        );
        if (!relationValidation.ok) {
            return res.status(relationValidation.status).json({ error: relationValidation.error });
        }

        safeLog('info', 'Creating deal - calling createDeal service', { title, userId, userFirmId });
        const deal = await createDeal(normalizedDeal, userId, userFirmId);
        safeLog('info', 'Deal created successfully', { dealId: deal.id });
        return res.status(201).json(deal);
    } catch (error) {
        safeLog('error', 'Error creating deal', { error: error.message, stack: error.stack });
        return res.status(500).json({ error: 'Failed to create deal' });
    }
});

// PUT /api/deals/:id - Update a deal
router.put('/:id', authenticateToken, validateParams('id'), userRateLimit(), validateBody(updateDealSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const access = await requireDealAccess(req, res, id, { getDealFirmId, getUserFirmId, isUserAdmin });
        if (!access) return;

        const normalizedDeal = normalizeDealPayload(req.body);
        const existingDeal = await getDealById(id);
        if (!existingDeal) {
            return res.status(404).json({ error: 'Deal not found' });
        }

        const relationIds = resolveDealRelationIds({
            body: req.body,
            normalizedDeal,
            existingDeal
        });
        const relationValidation = await validateDealRelations(
            { firmId: access.firmId, clientId: relationIds.clientId, contactId: relationIds.contactId },
            { getClientFirmId, getContactOwnership }
        );
        if (!relationValidation.ok) {
            return res.status(relationValidation.status).json({ error: relationValidation.error });
        }

        const deal = await updateDeal(id, normalizedDeal);
        return res.json(deal);
    } catch (error) {
        safeLog('error', 'Error updating deal', { error: error.message });
        return res.status(500).json({ error: 'Failed to update deal' });
    }
});

// DELETE /api/deals/:id - Delete a deal
router.delete('/:id', authenticateToken, validateParams('id'), userRateLimit(), async (req, res) => {
    try {
        const { id } = req.params;
        const access = await requireDealAccess(req, res, id, { getDealFirmId, getUserFirmId, isUserAdmin });
        if (!access) return;

        await deleteDeal(id);
        return res.json({ success: true, message: 'Deal deleted' });
    } catch (error) {
        safeLog('error', 'Error deleting deal', { error: error.message });
        return res.status(500).json({ error: 'Failed to delete deal' });
    }
});

// ============================================
// DEAL-RESUME ASSOCIATION ROUTES
// ============================================

// GET /api/deals/:id/resumes - Get all resumes for a deal
router.get('/:id/resumes', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const access = await requireDealAccess(req, res, id, { getDealFirmId, getUserFirmId, isUserAdmin });
        if (!access) return;

        const resumes = await getResumesForDeal(id);
        return res.json(resumes);
    } catch (error) {
        safeLog('error', 'Error fetching deal resumes', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch deal resumes' });
    }
});

// POST /api/deals/:id/resumes - Add a resume to a deal
router.post('/:id/resumes', authenticateToken, validateParams('id'), userRateLimit(), validateBody(addDealResumeSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const { resumeId, notes, status } = req.body;

        if (!resumeId) {
            return res.status(400).json({ error: 'resumeId is required' });
        }

        const access = await requireDealAccess(req, res, id, { getDealFirmId, getUserFirmId, isUserAdmin });
        if (!access) return;

        // Verify resume exists and belongs to same firm
        const resumeAccess = await requireResumeFirmAccess(
            res,
            { resumeId, firmId: access.firmId, forbiddenError: 'Resume belongs to different firm' },
            { getResumeFirmId }
        );
        if (!resumeAccess) return;

        const userId = req.user?.id;
        const result = await addResumeToDeal(id, resumeId, userId, { notes, status });
        return res.status(201).json(result);
    } catch (error) {
        safeLog('error', 'Error adding resume to deal', { error: error.message });
        return res.status(500).json({ error: 'Failed to add resume to deal' });
    }
});

// PUT /api/deals/:id/resumes/:resumeId - Update resume status in deal
router.put('/:id/resumes/:resumeId', authenticateToken, validateParams('id', 'resumeId'), userRateLimit(), validateBody(updateDealResumeSchema), async (req, res) => {
    try {
        const { id, resumeId } = req.params;
        const { status, notes } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'status is required' });
        }

        const access = await requireDealAccess(req, res, id, { getDealFirmId, getUserFirmId, isUserAdmin });
        if (!access) return;

        const result = await updateDealResumeStatus(id, resumeId, status, notes);
        return res.json(result);
    } catch (error) {
        safeLog('error', 'Error updating deal resume status', { error: error.message });
        if (error.message === 'Resume not found in deal') {
            return res.status(404).json({ error: 'Resume not found in deal' });
        }
        return res.status(500).json({ error: 'Failed to update resume status' });
    }
});

// DELETE /api/deals/:id/resumes/:resumeId - Remove a resume from a deal
router.delete('/:id/resumes/:resumeId', authenticateToken, validateParams('id', 'resumeId'), userRateLimit(), async (req, res) => {
    try {
        const { id, resumeId } = req.params;
        
        const access = await requireDealAccess(req, res, id, { getDealFirmId, getUserFirmId, isUserAdmin });
        if (!access) return;

        await removeResumeFromDeal(id, resumeId);
        return res.json({ success: true, message: 'Resume removed from deal' });
    } catch (error) {
        safeLog('error', 'Error removing resume from deal', { error: error.message });
        if (error.message === 'Resume not found in deal') {
            return res.status(404).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Failed to remove resume from deal' });
    }
});

// ============================================
// RESUME-CENTRIC ROUTES (for CVtheque integration)
// ============================================

// GET /api/deals/by-resume/:resumeId - Get all deals for a specific resume
router.get('/by-resume/:resumeId', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const { resumeId } = req.params;
        const scopedAccess = await requireFirmScopedAccess(req, res, { getUserFirmId, isUserAdmin });
        if (!scopedAccess) return;

        const resumeFirmId = scopedAccess.isAdmin
            ? await getResumeFirmId(resumeId)
            : (await requireResumeFirmAccess(
                res,
                { resumeId, firmId: scopedAccess.userFirmId },
                { getResumeFirmId }
            ))?.resumeFirmId;
        if (!resumeFirmId) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        if (!scopedAccess.isAdmin && resumeFirmId !== scopedAccess.userFirmId) return;

        const firmId = scopedAccess.isAdmin ? resumeFirmId : scopedAccess.userFirmId;
        const deals = await getDealsForResume(resumeId, firmId);
        return res.json({ data: deals });
    } catch (error) {
        safeLog('error', 'Error fetching deals for resume', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch deals for resume' });
    }
});

// POST /api/deals/add-resume-to-multiple - Add a resume to multiple deals at once
router.post('/add-resume-to-multiple', authenticateToken, userRateLimit(), validateBody(addResumeToMultipleDealsSchema), async (req, res) => {
    try {
        const { resumeId, dealIds } = req.body;

        if (!resumeId || !dealIds || !Array.isArray(dealIds) || dealIds.length === 0) {
            return res.status(400).json({ error: 'resumeId and dealIds array are required' });
        }

        const userFirmId = await getUserFirmId(req);
        const access = ensureFirmScopedAccess({ isAdmin: isUserAdmin(req), userFirmId });
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const resumeAccess = await requireResumeFirmAccess(
            res,
            { resumeId, firmId: userFirmId },
            { getResumeFirmId }
        );
        if (!resumeAccess) return;

        const userId = req.user?.id;
        const results = [];
        const errors = [];

        for (const dealId of dealIds) {
            try {
                const dealAccess = await checkDealAccess(req, dealId, { getDealFirmId, getUserFirmId, isUserAdmin });
                if (!dealAccess.hasAccess) {
                    errors.push({ dealId, error: dealAccess.error });
                    continue;
                }
                const result = await addResumeToDeal(dealId, resumeId, userId);
                results.push(result);
            } catch (error) {
                errors.push({ dealId, error: error.message });
            }
        }

        return res.json({ 
            success: results.length > 0,
            added: results.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        safeLog('error', 'Error adding resume to multiple deals', { error: error.message });
        return res.status(500).json({ error: 'Failed to add resume to deals' });
    }
});

export default router;
