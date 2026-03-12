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
import { query } from '../config/database.js';
import { getUserFirmId } from '../utils/firmHelpers.js';

const router = express.Router();

// ============================================
// MISSIONS ROUTES
// ============================================

// GET /api/missions - Get all missions (with server-side pagination and filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const _userFirmName = req.user?.firm || req.user?.Firm;
        
        // Extract pagination and filter parameters
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;
        const { search, status } = req.query;

        // Build WHERE conditions
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        // Firm filter (non-admin users) - filter by firm_id only
        if (!isAdmin) {
            const userFirmId = await getUserFirmId(req);
            safeLog('info', 'Missions GET - user firm filter', { 
                userFirmId, 
                userId: req.user?.id 
            });
            if (userFirmId) {
                conditions.push(`m.firm_id = $${paramIndex}`);
                params.push(userFirmId);
                paramIndex++;
            } else {
                // No valid firm_id - return empty results for security
                safeLog('warn', 'User has no valid firm_id, returning empty results', { userId: req.user?.id });
                return res.json({
                    records: [],
                    pagination: { page: 1, limit, totalPages: 0, totalCount: 0, hasMore: false }
                });
            }
        }

        // Status filter
        if (status && status !== 'all') {
            conditions.push(`m.status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        // Search filter (searches in title, content, firm)
        if (search) {
            conditions.push(`(m.title ILIKE $${paramIndex} OR m.firm ILIKE $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        // Debug: log the WHERE clause and params
        safeLog('info', 'Missions GET - query debug', { 
            whereClause, 
            params,
            conditions 
        });

        // Count total records - use m alias for consistency
        const countQuery = `SELECT COUNT(*) as total FROM missions m ${whereClause}`;
        const countResult = await selectWithTimeout('missions', {
            rawQuery: countQuery,
            rawParams: params
        });
        const totalCount = parseInt(countResult[0]?.total || 0);

        // Fetch paginated records with client and contact joins
        const dataQuery = `
            SELECT m.*, 
                   c.name as client_name, c.type as client_type,
                   cc.name as contact_name, cc.email as contact_email, cc.role as contact_role
            FROM missions m
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN client_contacts cc ON m.contact_id = cc.id
            ${whereClause}
            ORDER BY m.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        const dataParams = [...params, limit, offset];
        
        const result = await query(dataQuery, dataParams);
        const records = result.rows;

        const missions = records.map(record => ({
            id: record.id,
            Title: record.title,
            Content: record.content,
            Firm: record.firm,
            'Firm ID': record.firm_id,
            Status: record.status,
            Keywords: record.keywords,
            'Required Skills': record.required_skills,
            'Preferred Skills': record.preferred_skills,
            'Created At': record.created_at,
            'Updated At': record.updated_at,
            'Client ID': record.client_id,
            'Client Name': record.client_name,
            'Client Type': record.client_type,
            'Contact ID': record.contact_id,
            'Contact Name': record.contact_name,
            'Contact Email': record.contact_email,
            'Contact Role': record.contact_role
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
        
        // Fetch mission with client and contact joins
        const result = await query(`
            SELECT m.*, 
                   c.name as client_name, c.type as client_type,
                   cc.name as contact_name, cc.email as contact_email, cc.role as contact_role
            FROM missions m
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN client_contacts cc ON m.contact_id = cc.id
            WHERE m.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Mission not found' });
        }
        
        const record = result.rows[0];
        
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userFirm = req.user?.firm || req.user?.Firm;
        const userFirmId = await getUserFirmId(req);
        
        if (!isAdmin && record.firm !== userFirm && record.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied: You can only view missions from your firm' });
        }
        
        res.json({
            id: record.id,
            Title: record.title,
            Content: record.content,
            Firm: record.firm,
            'Firm ID': record.firm_id,
            Status: record.status,
            Keywords: record.keywords,
            'Required Skills': record.required_skills,
            'Preferred Skills': record.preferred_skills,
            'Created At': record.created_at,
            'Updated At': record.updated_at,
            'Client ID': record.client_id,
            'Client Name': record.client_name,
            'Client Type': record.client_type,
            'Contact ID': record.contact_id,
            'Contact Name': record.contact_name,
            'Contact Email': record.contact_email,
            'Contact Role': record.contact_role
        });
    } catch (error) {
        safeLog('error', 'Error fetching mission', { error: error.message, missionId: req.params.id });
        res.status(500).json({ error: 'Failed to fetch mission' });
    }
});

// POST /api/missions - Create mission
router.post('/', authenticateToken, validateBody(createMissionSchema), async (req, res) => {
    try {
        const missionData = req.body;
        const userFirm = req.user?.firm || req.user?.Firm;
        const userFirmId = await getUserFirmId(req);
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        
        // Determine target firm_id: admin can specify any firm
        let targetFirmId = userFirmId;
        let targetFirmName = userFirm;
        const requestedFirmId = missionData.firm_id || missionData['Firm ID'];
        
        // If admin sends a firm_id, always use it (validate it exists)
        if (isAdmin && requestedFirmId) {
            const firmResult = await query('SELECT id, name FROM firms WHERE id = $1', [requestedFirmId]);
            if (firmResult.rows.length === 0) {
                return res.status(400).json({ error: 'Specified firm not found' });
            }
            targetFirmId = firmResult.rows[0].id;
            targetFirmName = firmResult.rows[0].name;
            if (requestedFirmId !== userFirmId) {
                safeLog('info', 'Admin creating mission for another firm', { 
                    adminId: req.user?.id, 
                    targetFirmId, 
                    targetFirmName 
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
            const clientResult = await query('SELECT firm_id FROM clients WHERE id = $1', [clientId]);
            if (clientResult.rows.length === 0) {
                return res.status(400).json({ error: 'Client not found' });
            }
            if (clientResult.rows[0].firm_id !== targetFirmId) {
                safeLog('warn', 'Client firm mismatch', { 
                    clientFirmId: clientResult.rows[0].firm_id, 
                    targetFirmId,
                    userId: req.user?.id 
                });
                return res.status(403).json({ error: 'Client does not belong to the target firm' });
            }
        }
        
        // Validate contact_id if provided
        const contactId = missionData['Contact ID'] || missionData.contact_id || null;
        if (contactId && clientId) {
            const contactResult = await query('SELECT id FROM client_contacts WHERE id = $1 AND client_id = $2', [contactId, clientId]);
            if (contactResult.rows.length === 0) {
                return res.status(400).json({ error: 'Contact not found or does not belong to this client' });
            }
        }
        
        // Debug: log what we're about to save
        safeLog('info', 'Creating mission with firm data', {
            targetFirmId,
            targetFirmName,
            requestedFirmId,
            userFirmId,
            isAdmin
        });
        
        const newMission = await createWithTimeout('missions', {
            title: missionData.Title || missionData.title,
            content: content,
            firm: targetFirmName || missionData.Firm || missionData.firm || null,
            firm_id: targetFirmId || null,
            status: missionData.Status || missionData.status || 'active',
            keywords: missionData.Keywords || missionData.keywords || null,
            required_skills: missionData['Required Skills'] || missionData.required_skills || null,
            preferred_skills: missionData['Preferred Skills'] || missionData.preferred_skills || null,
            client_id: clientId,
            contact_id: contactId
        });

        // Fetch with joins to return full data
        const result = await query(`
            SELECT m.*, 
                   c.name as client_name, c.type as client_type,
                   cc.name as contact_name, cc.email as contact_email, cc.role as contact_role
            FROM missions m
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN client_contacts cc ON m.contact_id = cc.id
            WHERE m.id = $1
        `, [newMission.id]);
        
        const record = result.rows[0];

        res.json({
            id: record.id,
            Title: record.title,
            Content: record.content,
            Firm: record.firm,
            'Firm ID': record.firm_id,
            Status: record.status,
            Keywords: record.keywords,
            'Required Skills': record.required_skills,
            'Preferred Skills': record.preferred_skills,
            'Created At': record.created_at,
            'Updated At': record.updated_at,
            'Client ID': record.client_id,
            'Client Name': record.client_name,
            'Client Type': record.client_type,
            'Contact ID': record.contact_id,
            'Contact Name': record.contact_name,
            'Contact Email': record.contact_email,
            'Contact Role': record.contact_role
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
        const userFirm = req.user?.firm || req.user?.Firm;
        const userFirmId = await getUserFirmId(req);

        const existingMission = await findWithTimeout('missions', id);

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
                const clientResult = await query('SELECT firm_id FROM clients WHERE id = $1', [clientId]);
                if (clientResult.rows.length === 0) {
                    return res.status(400).json({ error: 'Client not found' });
                }
                if (clientResult.rows[0].firm_id !== userFirmId) {
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
                const contactResult = await query('SELECT id FROM client_contacts WHERE id = $1 AND client_id = $2', [contactId, clientId]);
                if (contactResult.rows.length === 0) {
                    return res.status(400).json({ error: 'Contact not found or does not belong to this client' });
                }
            }
            updates.contact_id = contactId || null;
        }
        
        // Handle firm_id update (admin only)
        if (isAdmin && (updateData.firm_id || updateData['Firm ID'])) {
            const newFirmId = updateData.firm_id || updateData['Firm ID'];
            // Always validate and use the provided firm_id
            const firmResult = await query('SELECT id, name FROM firms WHERE id = $1', [newFirmId]);
            if (firmResult.rows.length === 0) {
                return res.status(400).json({ error: 'Specified firm not found' });
            }
            updates.firm_id = firmResult.rows[0].id;
            updates.firm = firmResult.rows[0].name;
            if (newFirmId !== existingMission.firm_id) {
                safeLog('info', 'Admin changing mission firm', { 
                    adminId: req.user?.id, 
                    missionId: id,
                    oldFirmId: existingMission.firm_id,
                    newFirmId: updates.firm_id 
                });
            }
        }

        const updatedMission = await updateWithTimeout('missions', id, updates);

        // Fetch with joins to return full data
        const result = await query(`
            SELECT m.*, 
                   c.name as client_name, c.type as client_type,
                   cc.name as contact_name, cc.email as contact_email, cc.role as contact_role
            FROM missions m
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN client_contacts cc ON m.contact_id = cc.id
            WHERE m.id = $1
        `, [updatedMission.id]);
        
        const record = result.rows[0];

        res.json({
            id: record.id,
            Title: record.title,
            Content: record.content,
            Firm: record.firm,
            'Firm ID': record.firm_id,
            Status: record.status,
            Keywords: record.keywords,
            'Required Skills': record.required_skills,
            'Preferred Skills': record.preferred_skills,
            'Created At': record.created_at,
            'Updated At': record.updated_at,
            'Client ID': record.client_id,
            'Client Name': record.client_name,
            'Client Type': record.client_type,
            'Contact ID': record.contact_id,
            'Contact Name': record.contact_name,
            'Contact Email': record.contact_email,
            'Contact Role': record.contact_role
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
        const userFirm = req.user?.firm || req.user?.Firm;
        const userFirmId = await getUserFirmId(req);

        if (!isAdmin) {
            const existingRecord = await findWithTimeout('missions', id);
            if (existingRecord.firm !== userFirm && existingRecord.firm_id !== userFirmId) {
                return res.status(403).json({ error: 'You can only delete missions from your firm' });
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
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userFirm = req.user?.firm || req.user?.Firm;
        const userFirmId = await getUserFirmId(req);
        
        // Verify mission belongs to user's firm
        if (!isAdmin) {
            const mission = await findWithTimeout('missions', missionId);
            if (mission.firm !== userFirm && mission.firm_id !== userFirmId) {
                return res.status(403).json({ error: 'Access denied: You can only view adaptations for missions from your firm' });
            }
        }
        
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
        const userFirm = req.user?.firm || req.user?.firm_id;
        
        // Verify mission access
        const missionRecord = await findWithTimeout('missions', missionId);
        
        if (!isAdmin && missionRecord.firm !== userFirm) {
            return res.status(403).json({ error: 'Access denied: You can only search profiles for your missions' });
        }
        
        // Build user metadata for LLM calls
        const userMetadata = {
            userId: req.user?.id,
            userName: req.user?.name || req.user?.Name,
            firm: userFirm
        };
        
        // Import the service dynamically to avoid circular dependencies
        const { findMatchingProfiles } = await import('../services/profileMatching.service.js');
        
        // Find matching profiles
        const results = await findMatchingProfiles(missionId, {
            limit: Math.min(limit, 50),
            minScore: Math.max(0, Math.min(100, minScore)),
            status,
            firm: isAdmin ? null : userFirm,
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
        const userFirm = req.user?.firm || req.user?.firm_id;
        
        // Verify mission access
        const missionRecord = await findWithTimeout('missions', missionId);
        
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
        
        const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userFirm = req.user?.firm || req.user?.firm_id;
        
        // Verify mission access
        const missionRecord = await findWithTimeout('missions', missionId);
        
        if (!isAdmin && missionRecord.firm !== userFirm) {
            return res.status(403).json({ error: 'Access denied: You can only analyze profiles for your missions' });
        }
        
        // Build user metadata for LLM calls
        const userMetadata = {
            userId: req.user?.id,
            userName: req.user?.name || req.user?.Name,
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
