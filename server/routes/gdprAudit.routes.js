/**
 * GDPR Audit Log Routes
 * API endpoints for viewing and managing GDPR audit logs
 * Admin-only access
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { 
    getGdprAuditLogs, 
    getGdprAuditStats, 
    getGdprFirms,
    exportTargetLogs,
    GDPR_ACTIONS,
    GDPR_CATEGORIES
} from '../services/gdprAudit.service.js';
import { safeLog } from '../utils/logger.backend.js';

const router = express.Router();

/**
 * GET /api/gdpr-audit/logs
 * Get paginated GDPR audit logs with filters
 */
router.get('/logs', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const {
        firmId,
        action,
        category,
        userId,
        targetEmail,
        isAutomated,
        startDate,
        endDate,
        page = 1,
        limit = 50,
        sortBy = 'created_at',
        sortOrder = 'desc'
    } = req.query;

    safeLog('info', 'Fetching GDPR audit logs', {
        adminId: req.user?.id,
        filters: { firmId, action, category, isAutomated }
    });

    const result = await getGdprAuditLogs({
        firmId: firmId || null,
        action: action || null,
        category: category || null,
        userId: userId || null,
        targetEmail: targetEmail || null,
        isAutomated: isAutomated === 'true' ? true : isAutomated === 'false' ? false : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        page: parseInt(page, 10),
        limit: Math.min(parseInt(limit, 10), 100), // Max 100 per page
        sortBy,
        sortOrder
    });

    res.json(result);
}));

/**
 * GET /api/gdpr-audit/stats
 * Get GDPR audit statistics
 */
router.get('/stats', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { firmId, days = 30 } = req.query;

    safeLog('info', 'Fetching GDPR audit stats', {
        adminId: req.user?.id,
        firmId,
        days
    });

    const stats = await getGdprAuditStats(
        firmId || null,
        parseInt(days, 10)
    );

    res.json(stats);
}));

/**
 * GET /api/gdpr-audit/firms
 * Get list of firms with GDPR activity
 */
router.get('/firms', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    safeLog('info', 'Fetching GDPR firms list', {
        adminId: req.user?.id
    });

    const firms = await getGdprFirms();
    res.json(firms);
}));

/**
 * GET /api/gdpr-audit/actions
 * Get list of available action types
 */
router.get('/actions', authenticateToken, requireAdmin, (req, res) => {
    res.json({
        actions: Object.entries(GDPR_ACTIONS).map(([key, value]) => ({
            key,
            value,
            label: key.replace(/_/g, ' ').toLowerCase()
        })),
        categories: Object.entries(GDPR_CATEGORIES).map(([key, value]) => ({
            key,
            value,
            label: key.charAt(0) + key.slice(1).toLowerCase()
        }))
    });
});

/**
 * GET /api/gdpr-audit/export/:email
 * Export all GDPR logs for a specific target email (for data portability)
 */
router.get('/export/:email', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { email } = req.params;

    safeLog('info', 'Exporting GDPR logs for target', {
        adminId: req.user?.id,
        targetEmail: email
    });

    const logs = await exportTargetLogs(email);

    res.json({
        targetEmail: email,
        exportDate: new Date().toISOString(),
        totalLogs: logs.length,
        logs
    });
}));

export default router;
