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
import { selectWithTimeout, findWithTimeout, createWithTimeout, updateWithTimeout, destroyWithTimeout } from '../utils/postgresHelpers.js';

const router = express.Router();

// ============================================
// MISSIONS ROUTES
// ============================================

// GET /api/missions - Get all missions (with server-side pagination and filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userCustomer = req.user?.customer;
        
        // Extract pagination and filter parameters
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;
        const { search, status } = req.query;

        // Build WHERE conditions
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        // Customer filter (non-admin users)
        if (!isAdmin && userCustomer) {
            conditions.push(`customer = $${paramIndex}`);
            params.push(userCustomer);
            paramIndex++;
        }

        // Status filter
        if (status && status !== 'all') {
            conditions.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        // Search filter (searches in title, content, customer)
        if (search) {
            conditions.push(`(title ILIKE $${paramIndex} OR customer ILIKE $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Count total records
        const countQuery = `SELECT COUNT(*) as total FROM missions ${whereClause}`;
        const countResult = await selectWithTimeout('missions', {
            rawQuery: countQuery,
            rawParams: params
        });
        const totalCount = parseInt(countResult[0]?.total || 0);

        // Fetch paginated records
        const dataQuery = `
            SELECT * FROM missions 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        const dataParams = [...params, limit, offset];
        
        const records = await selectWithTimeout('missions', {
            rawQuery: dataQuery,
            rawParams: dataParams
        });

        const missions = records.map(record => ({
            id: record.id,
            Title: record.title,
            Content: record.content,
            Customer: record.customer,
            'Customer ID': record.customer_id,
            Status: record.status,
            Keywords: record.keywords,
            'Required Skills': record.required_skills,
            'Preferred Skills': record.preferred_skills,
            'Created At': record.created_at,
            'Updated At': record.updated_at
        }));

        const totalPages = Math.ceil(totalCount / limit);
        const hasMore = page < totalPages;

        return res.json({
            data: missions,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasMore
            }
        });
    } catch (error) {
        safeLog('error', 'Error fetching missions', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch missions' });
    }
});

// GET /api/missions/:id - Get mission by ID
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const record = await findWithTimeout('missions', id);
        
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userCustomer = req.user?.customer;
        
        if (!isAdmin && record.customer !== userCustomer) {
            return res.status(403).json({ error: 'Access denied: You can only view missions from your customer' });
        }
        
        res.json({
            id: record.id,
            Title: record.title,
            Content: record.content,
            Customer: record.customer,
            'Customer ID': record.customer_id,
            Status: record.status,
            Keywords: record.keywords,
            'Required Skills': record.required_skills,
            'Preferred Skills': record.preferred_skills,
            'Created At': record.created_at,
            'Updated At': record.updated_at
        });
    } catch (error) {
        safeLog('error', 'Error fetching mission', { error: error.message, missionId: req.params.id });
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Mission not found' });
        }
        res.status(500).json({ error: 'Failed to fetch mission' });
    }
});

// POST /api/missions - Create mission
router.post('/', authenticateToken, validateBody(createMissionSchema), async (req, res) => {
    try {
        const missionData = req.body;
        const userCustomer = req.user?.customer;
        
        let content = missionData.Content || missionData.content || '';
        if (content) {
            content = sanitizeHtmlContent(content);
        }
        
        const newMission = await createWithTimeout('missions', {
            title: missionData.Title || missionData.title,
            content: content,
            customer: userCustomer || missionData.Customer || missionData.customer || null,
            customer_id: missionData['Customer ID'] || missionData.customer_id || null,
            status: missionData.Status || missionData.status || 'active',
            keywords: missionData.Keywords || missionData.keywords || null,
            required_skills: missionData['Required Skills'] || missionData.required_skills || null,
            preferred_skills: missionData['Preferred Skills'] || missionData.preferred_skills || null
        });

        res.json({
            id: newMission.id,
            Title: newMission.title,
            Content: newMission.content,
            Customer: newMission.customer,
            'Customer ID': newMission.customer_id,
            Status: newMission.status,
            Keywords: newMission.keywords,
            'Required Skills': newMission.required_skills,
            'Preferred Skills': newMission.preferred_skills,
            'Created At': newMission.created_at,
            'Updated At': newMission.updated_at
        });
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
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userCustomer = req.user?.customer;

        const existingMission = await findWithTimeout('missions', id);

        if (!isAdmin && existingMission.customer !== userCustomer) {
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

        const updatedMission = await updateWithTimeout('missions', id, updates);

        res.json({
            id: updatedMission.id,
            Title: updatedMission.title,
            Content: updatedMission.content,
            Customer: updatedMission.customer,
            'Customer ID': updatedMission.customer_id,
            Status: updatedMission.status,
            Keywords: updatedMission.keywords,
            'Required Skills': updatedMission.required_skills,
            'Preferred Skills': updatedMission.preferred_skills,
            'Created At': updatedMission.created_at,
            'Updated At': updatedMission.updated_at
        });
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
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userCustomer = req.user?.customer;

        if (!isAdmin) {
            const existingRecord = await findWithTimeout('missions', id);
            if (existingRecord.customer !== userCustomer) {
                return res.status(403).json({ error: 'You can only delete missions from your customer' });
            }
        }

        await destroyWithTimeout('missions', id);
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
        
        const records = await selectWithTimeout('resume_adaptations', {
            where: { mission_id: missionId },
            orderBy: 'created_at DESC'
        });

        const adaptations = records.map(record => ({
            id: record.id,
            'Resume ID': record.resume_id,
            'Mission ID': record.mission_id,
            'Resume Name': record.resume_name,
            'Mission Title': record.mission_title,
            'Adapted Text': record.adapted_text,
            'Match Score': record.match_score,
            'Match Analysis': record.match_analysis,
            Status: record.status,
            'Created At': record.created_at,
            'Updated At': record.updated_at
        }));

        res.json(adaptations);
    } catch (error) {
        safeLog('error', 'Error fetching mission adaptations', { error: error.message, missionId: req.params.missionId });
        res.status(500).json({ error: 'Failed to fetch mission adaptations' });
    }
});

// ============================================
// PROFILE MATCHING ROUTES
// ============================================

// POST /api/missions/:missionId/find-profiles - Find best matching profiles for a mission
router.post('/:missionId/find-profiles', authenticateToken, validateParams('missionId'), async (req, res) => {
    try {
        const { missionId } = req.params;
        const { limit = 10, minScore = 0, status, weights } = req.body;
        
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userCustomer = req.user?.customer;
        
        // Verify mission access
        const missionRecord = await findWithTimeout('missions', missionId);
        
        if (!isAdmin && missionRecord.customer !== userCustomer) {
            return res.status(403).json({ error: 'Access denied: You can only search profiles for your missions' });
        }
        
        // Build user metadata for LLM calls
        const userMetadata = {
            userId: req.user?.id,
            userName: req.user?.name || req.user?.Name,
            customer: userCustomer
        };
        
        // Import the service dynamically to avoid circular dependencies
        const { findMatchingProfiles } = await import('../services/profileMatching.service.js');
        
        // Find matching profiles
        const results = await findMatchingProfiles(missionId, {
            limit: Math.min(limit, 50),
            minScore: Math.max(0, Math.min(100, minScore)),
            status,
            customer: isAdmin ? null : userCustomer,
            weights
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
        
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userCustomer = req.user?.customer;
        
        // Verify mission access
        const missionRecord = await findWithTimeout('missions', missionId);
        
        if (!isAdmin && missionRecord.customer !== userCustomer) {
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
        
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userCustomer = req.user?.customer;
        
        // Verify mission access
        const missionRecord = await findWithTimeout('missions', missionId);
        
        if (!isAdmin && missionRecord.customer !== userCustomer) {
            return res.status(403).json({ error: 'Access denied: You can only analyze profiles for your missions' });
        }
        
        // Build user metadata for LLM calls
        const userMetadata = {
            userId: req.user?.id,
            userName: req.user?.name || req.user?.Name,
            customer: userCustomer
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
