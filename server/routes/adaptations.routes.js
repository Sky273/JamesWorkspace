/**
 * Adaptations Routes - PostgreSQL Version
 * Handles CRUD operations for resume adaptations to missions
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateParams, validateBody, updateAdaptationSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import { selectWithTimeout, findWithTimeout, updateWithTimeout, destroyWithTimeout } from '../utils/postgresHelpers.js';

const router = express.Router();

// ============================================
// ADAPTATIONS ROUTES
// ============================================

// GET /api/adaptations - Get all adaptations (with server-side pagination and filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { resumeId, missionId, status, search } = req.query;
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userFirm = req.user?.firm || req.user?.customer;
        
        // Extract pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;

        // Build WHERE conditions
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        // Firm filter (non-admin users)
        if (!isAdmin && userFirm) {
            conditions.push(`firm = $${paramIndex}`);
            params.push(userFirm);
            paramIndex++;
        }

        // Resume filter
        if (resumeId) {
            conditions.push(`resume_id = $${paramIndex}`);
            params.push(resumeId);
            paramIndex++;
        }

        // Mission filter
        if (missionId) {
            conditions.push(`mission_id = $${paramIndex}`);
            params.push(missionId);
            paramIndex++;
        }

        // Status filter
        if (status && status !== 'all') {
            conditions.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        // Search filter
        if (search) {
            conditions.push(`(mission_title ILIKE $${paramIndex} OR adapted_text ILIKE $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Count total records
        const countQuery = `SELECT COUNT(*) as total FROM resume_adaptations ${whereClause}`;
        const countResult = await selectWithTimeout('resume_adaptations', {
            rawQuery: countQuery,
            rawParams: params
        });
        const totalCount = parseInt(countResult[0]?.total || 0);

        // Fetch paginated records
        const dataQuery = `
            SELECT * FROM resume_adaptations 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        const dataParams = [...params, limit, offset];
        
        const records = await selectWithTimeout('resume_adaptations', {
            rawQuery: dataQuery,
            rawParams: dataParams
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
            Firm: record.firm,
            Customer: record.firm,
            'Created At': record.created_at,
            'Updated At': record.updated_at
        }));

        const totalPages = Math.ceil(totalCount / limit);
        const hasMore = page < totalPages;

        return res.json({
            data: adaptations,
            pagination: {
                page,
                limit,
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

// GET /api/adaptations/:id - Get single adaptation
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const record = await findWithTimeout('resume_adaptations', id);
        
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userFirm = req.user?.firm || req.user?.customer;
        
        if (!isAdmin && record.firm !== userFirm) {
            return res.status(403).json({ error: 'Access denied: You can only view adaptations from your firm' });
        }
        
        // Fetch mission client/contact info if mission_id exists
        let missionClientId = null;
        let missionContactId = null;
        if (record.mission_id) {
            try {
                const missionResult = await selectWithTimeout('missions', {
                    rawQuery: 'SELECT client_id, contact_id FROM missions WHERE id = $1',
                    rawParams: [record.mission_id]
                });
                if (missionResult.length > 0) {
                    missionClientId = missionResult[0].client_id;
                    missionContactId = missionResult[0].contact_id;
                }
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
            Firm: record.firm,
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
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userFirm = req.user?.firm || req.user?.customer;

        // Check permissions
        if (!isAdmin) {
            const existingRecord = await findWithTimeout('resume_adaptations', id);
            if (existingRecord.firm !== userFirm) {
                return res.status(403).json({ error: 'You can only update adaptations from your firm' });
            }
        }

        // Build update object
        const updates = {};
        if (req.body['Adapted Text'] !== undefined) {
            updates.adapted_text = req.body['Adapted Text'];
        }
        if (req.body['Adapted Title'] !== undefined || req.body.adapted_title !== undefined) {
            updates.adapted_title = req.body['Adapted Title'] ?? req.body.adapted_title;
        }
        if (req.body.Status !== undefined || req.body.status !== undefined) {
            updates.status = req.body.Status || req.body.status;
        }
        if (req.body['Match Score'] !== undefined || req.body.match_score !== undefined) {
            updates.match_score = req.body['Match Score'] || req.body.match_score;
        }
        if (req.body['Match Analysis'] !== undefined || req.body.match_analysis !== undefined) {
            updates.match_analysis = req.body['Match Analysis'] || req.body.match_analysis;
        }

        const updatedRecord = await updateWithTimeout('resume_adaptations', id, updates);

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
            Firm: updatedRecord.firm,
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
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userFirm = req.user?.firm || req.user?.customer;

        // Check permissions
        if (!isAdmin) {
            const existingRecord = await findWithTimeout('resume_adaptations', id);
            if (existingRecord.firm !== userFirm) {
                return res.status(403).json({ error: 'You can only delete adaptations from your firm' });
            }
        }

        await destroyWithTimeout('resume_adaptations', id);
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
