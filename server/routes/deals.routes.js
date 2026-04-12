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
    buildDealsListFilters,
    checkDealAccess,
    processBulkResumeAssociation,
    ensureFirmScopedAccess,
    parsePaginationParams,
    prepareDealMutationPayload,
    requireResumeFirmAccess,
    withDealAccess,
    withFirmScopedAccess,
    withResumeFirmAccess,
    resolveScopedFirmId,
    validateBulkResumeAssociationRequest,
    buildBulkResumeAssociationResponse
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
const firmScopedAccessDeps = { getUserFirmId, isUserAdmin };
const dealAccessDeps = { getDealFirmId, getUserFirmId, isUserAdmin };
const resumeFirmDeps = { getResumeFirmId };
const dealRelationDeps = { getClientFirmId, getContactOwnership };

function createDealsRouteHandler(logMessage, errorMessage, handler, errorResponder = null) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            safeLog('error', logMessage, { error: error.message });
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

function handleResumeNotFoundInDealError(error, res) {
    if (error.message === 'Resume not found in deal') {
        return res.status(404).json({ error: 'Resume not found in deal' });
    }

    return null;
}

// ============================================
// DEALS CRUD ROUTES
// ============================================

// GET /api/deals - Get all deals with pagination and filters
router.get('/', authenticateToken, createDealsRouteHandler('Error fetching deals', 'Failed to fetch deals', async (req, res) => {
    await withFirmScopedAccess(req, res, firmScopedAccessDeps, async (scopedAccess) => {
        const pagination = parsePaginationParams(req.query.page, req.query.limit);
        if (!pagination.ok) {
            return res.status(400).json({ error: pagination.error });
        }
        const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';

        const firmId = resolveScopedFirmId({ scopedAccess, requestedFirmId: req.query.firmId });
        const filters = buildDealsListFilters(req.query);

        const result = await getDeals(firmId, filters, pagination.value, { bypassCache });
        return res.json(result);
    });
}));

// GET /api/deals/stats - Get deal statistics
router.get('/stats', authenticateToken, createDealsRouteHandler('Error fetching deal stats', 'Failed to fetch deal statistics', async (req, res) => {
    await withFirmScopedAccess(req, res, firmScopedAccessDeps, async (scopedAccess) => {
        const firmId = resolveScopedFirmId({ scopedAccess, requestedFirmId: req.query.firmId });
        const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';
        const stats = await getDealStats(firmId, { bypassCache });
        return res.json(stats);
    });
}));

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
router.get('/:id', authenticateToken, validateParams('id'), createDealsRouteHandler('Error fetching deal', 'Failed to fetch deal', async (req, res) => {
    const { id } = req.params;
    await withDealAccess(req, res, id, dealAccessDeps, async () => {
        const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';
        const deal = await getDealById(id, { bypassCache });
        return res.json(deal);
    });
}));

// GET /api/deals/:id/missions - Get missions associated with a deal
router.get('/:id/missions', authenticateToken, validateParams('id'), createDealsRouteHandler('Error fetching deal missions', 'Failed to fetch deal missions', async (req, res) => {
    const { id } = req.params;
    await withDealAccess(req, res, id, dealAccessDeps, async () => {
        const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';
        const missions = await getMissionsForDeal(id, { bypassCache });
        return res.json(missions);
    });
}));

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

        const payloadPreparation = await prepareDealMutationPayload(
            { body: req.body, firmId: userFirmId, requireTitle: true },
            dealRelationDeps
        );
        if (!payloadPreparation.ok) {
            return res.status(payloadPreparation.status).json({ error: payloadPreparation.error });
        }

        const normalizedDeal = payloadPreparation.normalizedDeal;
        const { title } = normalizedDeal;
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
router.put('/:id', authenticateToken, validateParams('id'), userRateLimit(), validateBody(updateDealSchema), createDealsRouteHandler('Error updating deal', 'Failed to update deal', async (req, res) => {
    const { id } = req.params;
    await withDealAccess(req, res, id, dealAccessDeps, async (access) => {
        const existingDeal = await getDealById(id);
        if (!existingDeal) {
            return res.status(404).json({ error: 'Deal not found' });
        }

        const payloadPreparation = await prepareDealMutationPayload(
            { body: req.body, firmId: access.firmId, existingDeal },
            dealRelationDeps
        );
        if (!payloadPreparation.ok) {
            return res.status(payloadPreparation.status).json({ error: payloadPreparation.error });
        }

        const normalizedDeal = payloadPreparation.normalizedDeal;
        const deal = await updateDeal(id, normalizedDeal);
        return res.json(deal);
    });
}));

// DELETE /api/deals/:id - Delete a deal
router.delete('/:id', authenticateToken, validateParams('id'), userRateLimit(), createDealsRouteHandler('Error deleting deal', 'Failed to delete deal', async (req, res) => {
    const { id } = req.params;
    await withDealAccess(req, res, id, dealAccessDeps, async () => {
        await deleteDeal(id);
        return res.json({ success: true, message: 'Deal deleted' });
    });
}));

// ============================================
// DEAL-RESUME ASSOCIATION ROUTES
// ============================================

// GET /api/deals/:id/resumes - Get all resumes for a deal
router.get('/:id/resumes', authenticateToken, validateParams('id'), createDealsRouteHandler('Error fetching deal resumes', 'Failed to fetch deal resumes', async (req, res) => {
    const { id } = req.params;
    await withDealAccess(req, res, id, dealAccessDeps, async () => {
        const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';
        const resumes = await getResumesForDeal(id, { bypassCache });
        return res.json(resumes);
    });
}));

// POST /api/deals/:id/resumes - Add a resume to a deal
router.post('/:id/resumes', authenticateToken, validateParams('id'), userRateLimit(), validateBody(addDealResumeSchema), createDealsRouteHandler('Error adding resume to deal', 'Failed to add resume to deal', async (req, res) => {
    const { id } = req.params;
    const { resumeId, notes, status } = req.body;

    if (!resumeId) {
        return res.status(400).json({ error: 'resumeId is required' });
    }

    await withDealAccess(req, res, id, dealAccessDeps, async (access) => {
        await withResumeFirmAccess(
            res,
            { resumeId, firmId: access.firmId, forbiddenError: 'Resume belongs to different firm' },
            resumeFirmDeps,
            async () => {
                const userId = req.user?.id;
                const result = await addResumeToDeal(id, resumeId, userId, { notes, status });
                return res.status(201).json(result);
            }
        );
    });
}));

// PUT /api/deals/:id/resumes/:resumeId - Update resume status in deal
router.put('/:id/resumes/:resumeId', authenticateToken, validateParams('id', 'resumeId'), userRateLimit(), validateBody(updateDealResumeSchema), createDealsRouteHandler(
    'Error updating deal resume status',
    'Failed to update resume status',
    async (req, res) => {
        const { id, resumeId } = req.params;
        const { status, notes } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'status is required' });
        }

        await withDealAccess(req, res, id, dealAccessDeps, async () => {
            const result = await updateDealResumeStatus(id, resumeId, status, notes);
            return res.json(result);
        });
    },
    handleResumeNotFoundInDealError
));

// DELETE /api/deals/:id/resumes/:resumeId - Remove a resume from a deal
router.delete('/:id/resumes/:resumeId', authenticateToken, validateParams('id', 'resumeId'), userRateLimit(), createDealsRouteHandler(
    'Error removing resume from deal',
    'Failed to remove resume from deal',
    async (req, res) => {
        const { id, resumeId } = req.params;

        await withDealAccess(req, res, id, dealAccessDeps, async () => {
            await removeResumeFromDeal(id, resumeId);
            return res.json({ success: true, message: 'Resume removed from deal' });
        });
    },
    handleResumeNotFoundInDealError
));

// ============================================
// RESUME-CENTRIC ROUTES (for CVtheque integration)
// ============================================

// GET /api/deals/by-resume/:resumeId - Get all deals for a specific resume
router.get('/by-resume/:resumeId', authenticateToken, validateParams('resumeId'), createDealsRouteHandler('Error fetching deals for resume', 'Failed to fetch deals for resume', async (req, res) => {
    const { resumeId } = req.params;
    await withFirmScopedAccess(req, res, firmScopedAccessDeps, async (scopedAccess) => {
        const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';
        const resumeFirmId = scopedAccess.isAdmin
            ? await getResumeFirmId(resumeId)
            : (await requireResumeFirmAccess(
                res,
                { resumeId, firmId: scopedAccess.userFirmId },
                resumeFirmDeps
            ))?.resumeFirmId;
        if (!resumeFirmId) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        if (!scopedAccess.isAdmin && resumeFirmId !== scopedAccess.userFirmId) {
            return;
        }

        const firmId = scopedAccess.isAdmin ? resumeFirmId : scopedAccess.userFirmId;
        const deals = await getDealsForResume(resumeId, firmId, { bypassCache });
        return res.json({ data: deals });
    });
}));

// POST /api/deals/add-resume-to-multiple - Add a resume to multiple deals at once
router.post('/add-resume-to-multiple', authenticateToken, userRateLimit(), validateBody(addResumeToMultipleDealsSchema), async (req, res) => {
    try {
        const { resumeId, dealIds } = req.body;

        const requestValidation = validateBulkResumeAssociationRequest({ resumeId, dealIds });
        if (!requestValidation.ok) {
            return res.status(requestValidation.status).json({ error: requestValidation.error });
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
        const { results, errors } = await processBulkResumeAssociation(
            { req, dealIds, resumeId, userId },
            { checkDealAccess, addResumeToDeal, dealAccessDeps }
        );

        return res.json(buildBulkResumeAssociationResponse(results, errors));
    } catch (error) {
        safeLog('error', 'Error adding resume to multiple deals', { error: error.message });
        return res.status(500).json({ error: 'Failed to add resume to deals' });
    }
});

export default router;
