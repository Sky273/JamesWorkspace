/**
 * Resume Versions Routes
 * API endpoints for managing CV version history
 */

import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validateParams } from '../../utils/validation.js';
import { safeLog } from '../../utils/logger.backend.js';
import {
    getVersions,
    getVersion,
    restoreVersion
} from '../../services/resumeVersions.service.js';

const router = express.Router();

// ============================================
// GET /api/resumes/:id/versions
// List all versions for a resume
// ============================================
router.get('/:id/versions', authenticateToken, validateParams('id'), userRateLimit(50), async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        safeLog('info', 'GET /api/resumes/:id/versions', { 
            resumeId: id, 
            limit, 
            offset,
            userId: req.user?.id 
        });

        const result = await getVersions(id, {
            limit: Math.min(parseInt(limit, 10) || 50, 100),
            offset: parseInt(offset, 10) || 0
        });

        res.json(result);
    } catch (error) {
        safeLog('error', 'Error fetching resume versions', { 
            error: error.message, 
            resumeId: req.params.id 
        });
        res.status(500).json({ error: 'Failed to fetch resume versions' });
    }
});

// ============================================
// GET /api/resumes/:id/versions/:versionNumber
// Get a specific version
// ============================================
router.get('/:id/versions/:versionNumber', authenticateToken, validateParams('id'), userRateLimit(50), async (req, res) => {
    try {
        const { id, versionNumber } = req.params;
        const versionNum = parseInt(versionNumber, 10);

        if (isNaN(versionNum) || versionNum < 1) {
            return res.status(400).json({ error: 'Invalid version number' });
        }

        safeLog('info', 'GET /api/resumes/:id/versions/:versionNumber', { 
            resumeId: id, 
            versionNumber: versionNum,
            userId: req.user?.id 
        });

        const version = await getVersion(id, versionNum);

        if (!version) {
            return res.status(404).json({ error: 'Version not found' });
        }

        res.json(version);
    } catch (error) {
        safeLog('error', 'Error fetching resume version', { 
            error: error.message, 
            resumeId: req.params.id,
            versionNumber: req.params.versionNumber 
        });
        res.status(500).json({ error: 'Failed to fetch resume version' });
    }
});

// ============================================
// POST /api/resumes/:id/versions/:versionNumber/restore
// Restore a previous version (creates a new version)
// ============================================
router.post('/:id/versions/:versionNumber/restore', authenticateToken, validateParams('id'), userRateLimit(20), async (req, res) => {
    try {
        const { id, versionNumber } = req.params;
        const versionNum = parseInt(versionNumber, 10);

        if (isNaN(versionNum) || versionNum < 1) {
            return res.status(400).json({ error: 'Invalid version number' });
        }

        safeLog('info', 'POST /api/resumes/:id/versions/:versionNumber/restore', { 
            resumeId: id, 
            versionNumber: versionNum,
            userId: req.user?.id 
        });

        const newVersion = await restoreVersion(id, versionNum, req.user?.id);

        res.json({
            success: true,
            message: `Version ${versionNum} restored successfully`,
            newVersion
        });
    } catch (error) {
        safeLog('error', 'Error restoring resume version', { 
            error: error.message, 
            resumeId: req.params.id,
            versionNumber: req.params.versionNumber 
        });
        
        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Failed to restore resume version' });
    }
});

export default router;
