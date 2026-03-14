/**
 * Deals Routes
 * Handles CRUD operations for deals (affaires) and deal-resume associations
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { userRateLimit } from '../middleware/rateLimit.middleware.js';
import { safeLog } from '../utils/logger.backend.js';
import { getUserFirmId, isUserAdmin } from '../utils/firmHelpers.js';
import { query } from '../config/database.js';
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
    DEAL_STATUS,
    DEAL_PRIORITY,
    DEAL_RESUME_STATUS
} from '../services/deals.service.js';

const router = express.Router();

/**
 * Check if user has access to a deal (same firm)
 */
async function checkDealAccess(req, dealId) {
    try {
        const result = await query('SELECT firm_id FROM deals WHERE id = $1', [dealId]);
        if (result.rows.length === 0) {
            return { hasAccess: false, error: 'Deal not found' };
        }

        if (isUserAdmin(req)) {
            return { hasAccess: true, firmId: result.rows[0].firm_id };
        }

        const userFirmId = await getUserFirmId(req);
        if (result.rows[0].firm_id !== userFirmId) {
            return { hasAccess: false, error: 'Access denied' };
        }

        return { hasAccess: true, firmId: userFirmId };
    } catch (error) {
        return { hasAccess: false, error: error.message };
    }
}

// ============================================
// DEALS CRUD ROUTES
// ============================================

// GET /api/deals - Get all deals with pagination and filters
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userFirmId = await getUserFirmId(req);
        if (!userFirmId && !isUserAdmin(req)) {
            return res.status(403).json({ error: 'No firm association' });
        }

        const firmId = isUserAdmin(req) && req.query.firmId ? req.query.firmId : userFirmId;
        
        const filters = {
            clientId: req.query.clientId,
            status: req.query.status,
            priority: req.query.priority,
            search: req.query.search
        };

        const pagination = {
            page: req.query.page,
            limit: req.query.limit
        };

        const result = await getDeals(firmId, filters, pagination);
        return res.json(result);
    } catch (error) {
        safeLog('error', 'Error fetching deals', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch deals' });
    }
});

// GET /api/deals/stats - Get deal statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userFirmId = await getUserFirmId(req);
        if (!userFirmId && !isUserAdmin(req)) {
            return res.status(403).json({ error: 'No firm association' });
        }

        const firmId = isUserAdmin(req) && req.query.firmId ? req.query.firmId : userFirmId;
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
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const access = await checkDealAccess(req, id);
        
        if (!access.hasAccess) {
            return res.status(access.error === 'Deal not found' ? 404 : 403)
                .json({ error: access.error });
        }

        const deal = await getDealById(id);
        return res.json(deal);
    } catch (error) {
        safeLog('error', 'Error fetching deal', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch deal' });
    }
});

// POST /api/deals - Create a new deal
router.post('/', authenticateToken, userRateLimit(), async (req, res) => {
    try {
        safeLog('info', 'Creating deal - request received', { body: req.body });
        
        const userFirmId = await getUserFirmId(req);
        safeLog('info', 'Creating deal - firm check', { userFirmId });
        
        if (!userFirmId) {
            return res.status(403).json({ error: 'No firm association' });
        }

        const userId = req.user?.id;
        safeLog('info', 'Creating deal - user check', { userId });
        
        if (!userId) {
            return res.status(401).json({ error: 'User ID not found' });
        }

        // Validate required fields
        const { title } = req.body;
        if (!title || title.trim().length === 0) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // If client_id is provided, verify it belongs to the same firm
        if (req.body.client_id) {
            const clientCheck = await query(
                'SELECT firm_id FROM clients WHERE id = $1',
                [req.body.client_id]
            );
            if (clientCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Client not found' });
            }
            if (clientCheck.rows[0].firm_id !== userFirmId) {
                return res.status(403).json({ error: 'Client belongs to different firm' });
            }
        }

        safeLog('info', 'Creating deal - calling createDeal service', { title, userId, userFirmId });
        const deal = await createDeal(req.body, userId, userFirmId);
        safeLog('info', 'Deal created successfully', { dealId: deal.id });
        return res.status(201).json(deal);
    } catch (error) {
        safeLog('error', 'Error creating deal', { error: error.message, stack: error.stack });
        return res.status(500).json({ error: 'Failed to create deal', details: error.message });
    }
});

// PUT /api/deals/:id - Update a deal
router.put('/:id', authenticateToken, userRateLimit(), async (req, res) => {
    try {
        const { id } = req.params;
        const access = await checkDealAccess(req, id);
        
        if (!access.hasAccess) {
            return res.status(access.error === 'Deal not found' ? 404 : 403)
                .json({ error: access.error });
        }

        // If client_id is being updated, verify it belongs to the same firm
        if (req.body.client_id) {
            const clientCheck = await query(
                'SELECT firm_id FROM clients WHERE id = $1',
                [req.body.client_id]
            );
            if (clientCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Client not found' });
            }
            if (clientCheck.rows[0].firm_id !== access.firmId) {
                return res.status(403).json({ error: 'Client belongs to different firm' });
            }
        }

        const deal = await updateDeal(id, req.body);
        return res.json(deal);
    } catch (error) {
        safeLog('error', 'Error updating deal', { error: error.message });
        return res.status(500).json({ error: 'Failed to update deal' });
    }
});

// DELETE /api/deals/:id - Delete a deal
router.delete('/:id', authenticateToken, userRateLimit(), async (req, res) => {
    try {
        const { id } = req.params;
        const access = await checkDealAccess(req, id);
        
        if (!access.hasAccess) {
            return res.status(access.error === 'Deal not found' ? 404 : 403)
                .json({ error: access.error });
        }

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
router.get('/:id/resumes', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const access = await checkDealAccess(req, id);
        
        if (!access.hasAccess) {
            return res.status(access.error === 'Deal not found' ? 404 : 403)
                .json({ error: access.error });
        }

        const resumes = await getResumesForDeal(id);
        return res.json(resumes);
    } catch (error) {
        safeLog('error', 'Error fetching deal resumes', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch deal resumes' });
    }
});

// POST /api/deals/:id/resumes - Add a resume to a deal
router.post('/:id/resumes', authenticateToken, userRateLimit(), async (req, res) => {
    try {
        const { id } = req.params;
        const { resumeId, notes, status } = req.body;

        if (!resumeId) {
            return res.status(400).json({ error: 'resumeId is required' });
        }

        const access = await checkDealAccess(req, id);
        if (!access.hasAccess) {
            return res.status(access.error === 'Deal not found' ? 404 : 403)
                .json({ error: access.error });
        }

        // Verify resume exists and belongs to same firm
        const resumeCheck = await query(
            'SELECT firm_id FROM resumes WHERE id = $1',
            [resumeId]
        );
        if (resumeCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Resume not found' });
        }
        if (resumeCheck.rows[0].firm_id !== access.firmId) {
            return res.status(403).json({ error: 'Resume belongs to different firm' });
        }

        const userId = req.user?.id;
        const result = await addResumeToDeal(id, resumeId, userId, { notes, status });
        return res.status(201).json(result);
    } catch (error) {
        safeLog('error', 'Error adding resume to deal', { error: error.message });
        return res.status(500).json({ error: 'Failed to add resume to deal' });
    }
});

// PUT /api/deals/:id/resumes/:resumeId - Update resume status in deal
router.put('/:id/resumes/:resumeId', authenticateToken, userRateLimit(), async (req, res) => {
    try {
        const { id, resumeId } = req.params;
        const { status, notes } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'status is required' });
        }

        const access = await checkDealAccess(req, id);
        if (!access.hasAccess) {
            return res.status(access.error === 'Deal not found' ? 404 : 403)
                .json({ error: access.error });
        }

        const result = await updateDealResumeStatus(id, resumeId, status, notes);
        return res.json(result);
    } catch (error) {
        safeLog('error', 'Error updating deal resume status', { error: error.message });
        if (error.message === 'Resume not found in deal') {
            return res.status(404).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Failed to update resume status' });
    }
});

// DELETE /api/deals/:id/resumes/:resumeId - Remove a resume from a deal
router.delete('/:id/resumes/:resumeId', authenticateToken, userRateLimit(), async (req, res) => {
    try {
        const { id, resumeId } = req.params;
        
        const access = await checkDealAccess(req, id);
        if (!access.hasAccess) {
            return res.status(access.error === 'Deal not found' ? 404 : 403)
                .json({ error: access.error });
        }

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
// RESUME-CENTRIC ROUTES (for CVthèque integration)
// ============================================

// GET /api/deals/by-resume/:resumeId - Get all deals for a specific resume
router.get('/by-resume/:resumeId', authenticateToken, async (req, res) => {
    try {
        const { resumeId } = req.params;
        const userFirmId = await getUserFirmId(req);
        
        if (!userFirmId && !isUserAdmin(req)) {
            return res.status(403).json({ error: 'No firm association' });
        }

        // Verify resume exists and user has access
        const resumeCheck = await query(
            'SELECT firm_id FROM resumes WHERE id = $1',
            [resumeId]
        );
        if (resumeCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        if (!isUserAdmin(req) && resumeCheck.rows[0].firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const firmId = isUserAdmin(req) ? resumeCheck.rows[0].firm_id : userFirmId;
        const deals = await getDealsForResume(resumeId, firmId);
        return res.json({ data: deals });
    } catch (error) {
        safeLog('error', 'Error fetching deals for resume', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch deals for resume' });
    }
});

// POST /api/deals/add-resume-to-multiple - Add a resume to multiple deals at once
router.post('/add-resume-to-multiple', authenticateToken, userRateLimit(), async (req, res) => {
    try {
        const { resumeId, dealIds } = req.body;

        if (!resumeId || !dealIds || !Array.isArray(dealIds) || dealIds.length === 0) {
            return res.status(400).json({ error: 'resumeId and dealIds array are required' });
        }

        const userFirmId = await getUserFirmId(req);
        if (!userFirmId) {
            return res.status(403).json({ error: 'No firm association' });
        }

        // Verify resume exists and belongs to user's firm
        const resumeCheck = await query(
            'SELECT firm_id FROM resumes WHERE id = $1',
            [resumeId]
        );
        if (resumeCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        if (resumeCheck.rows[0].firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const userId = req.user?.id;
        const results = [];
        const errors = [];

        for (const dealId of dealIds) {
            try {
                const access = await checkDealAccess(req, dealId);
                if (!access.hasAccess) {
                    errors.push({ dealId, error: access.error });
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
