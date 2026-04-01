/**
 * Resume Versions Routes
 * API endpoints for managing CV version history
 */

import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validateParams } from '../../utils/validation.js';
import { safeLog } from '../../utils/logger.backend.js';
import { getResumeForAccessCheck } from '../../services/resumes.service.js';
import { getUserFirmId } from '../../utils/firmHelpers.js';
import {
    getVersions,
    getVersion,
    restoreVersion
} from '../../services/resumeVersions.service.js';

const router = express.Router();
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;

function parseVersionsPagination(query = {}) {
    const parsedLimit = query.limit === undefined ? DEFAULT_LIMIT : Number.parseInt(query.limit, 10);
    const parsedOffset = query.offset === undefined ? DEFAULT_OFFSET : Number.parseInt(query.offset, 10);

    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
        return { error: 'Invalid limit parameter' };
    }

    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
        return { error: 'Invalid offset parameter' };
    }

    return {
        limit: Math.min(parsedLimit, MAX_LIMIT),
        offset: parsedOffset
    };
}

async function assertResumeAccess(req, res) {
    const resume = await getResumeForAccessCheck(req.params.id);

    if (!resume) {
        res.status(404).json({ error: 'Resume not found' });
        return null;
    }

    if (req.user?.role === 'admin') {
        return resume;
    }

    const userFirmId = await getUserFirmId(req);
    if (!userFirmId || !resume.firm_id || resume.firm_id !== userFirmId) {
        res.status(403).json({ error: 'Access denied' });
        return null;
    }

    return resume;
}

// ============================================
// GET /api/resumes/:id/versions
// List all versions for a resume
// ============================================
router.get('/:id/versions', authenticateToken, validateParams('id'), userRateLimit(50), async (req, res) => {
    try {
        const { id } = req.params;
        const pagination = parseVersionsPagination(req.query);
        if (pagination.error) {
            return res.status(400).json({ error: pagination.error });
        }

        const resume = await assertResumeAccess(req, res);

        if (!resume) {
            return;
        }

        safeLog('info', 'GET /api/resumes/:id/versions', { 
            resumeId: id, 
            limit: pagination.limit, 
            offset: pagination.offset,
            userId: req.user?.id 
        });

        const result = await getVersions(id, {
            limit: pagination.limit,
            offset: pagination.offset
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

        const resume = await assertResumeAccess(req, res);
        if (!resume) {
            return;
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

        const resume = await assertResumeAccess(req, res);
        if (!resume) {
            return;
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
            return res.status(404).json({ error: 'Version not found' });
        }
        
        res.status(500).json({ error: 'Failed to restore resume version' });
    }
});

export default router;
