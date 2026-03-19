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
        const isAdmin = req.user?.role === 'admin';
        const _userFirmName = req.user?.firm;
        
        // Extract pagination and filter parameters
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;
        const { search, status, dealId } = req.query;

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

        // Deal filter
        if (dealId) {
            if (dealId === 'none') {
                conditions.push(`m.deal_id IS NULL`);
            } else {
                conditions.push(`m.deal_id = $${paramIndex}`);
                params.push(dealId);
                paramIndex++;
            }
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

        // Fetch paginated records with client, contact, and deal joins
        const dataQuery = `
            SELECT m.*, 
                   c.name as client_name, c.type as client_type,
                   cc.name as contact_name, cc.email as contact_email, cc.role as contact_role,
                   d.title as deal_title, d.status as deal_status
            FROM missions m
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN client_contacts cc ON m.contact_id = cc.id
            LEFT JOIN deals d ON m.deal_id = d.id
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
            'Contact Role': record.contact_role,
            'Deal ID': record.deal_id,
            'Deal Title': record.deal_title,
            'Deal Status': record.deal_status
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

// GET /api/missions/grouped-by-deal - Get missions grouped by deal for the "Par affaire" view
router.get('/grouped-by-deal', authenticateToken, async (req, res) => {
    try {
        const isAdmin = req.user.role?.toLowerCase() === 'admin';
        const userFirmId = await getUserFirmId(req);

        if (!userFirmId && !isAdmin) {
            return res.status(403).json({ error: 'No firm association' });
        }

        // Query 1: Get all deals for this firm
        const dealsResult = await query(`
            SELECT d.id, d.title, d.status, d.priority,
                   c.name as client_name, c.type as client_type,
                   cc.name as contact_name
            FROM deals d
            LEFT JOIN clients c ON d.client_id = c.id
            LEFT JOIN client_contacts cc ON d.contact_id = cc.id
            WHERE d.firm_id = $1
            ORDER BY
                CASE d.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
                d.title ASC
        `, [userFirmId]);

        const dealIds = dealsResult.rows.map(d => d.id);

        // Query 2: Batch fetch ALL missions for ALL deals
        let allMissionsMap = new Map();
        if (dealIds.length > 0) {
            const missionsResult = await query(`
                SELECT m.id, m.title, m.content, m.status, m.keywords,
                       m.required_skills, m.preferred_skills,
                       m.created_at, m.updated_at, m.deal_id, m.firm,
                       m.client_id, m.contact_id,
                       c.name as client_name, c.type as client_type,
                       cc.name as contact_name, cc.email as contact_email, cc.role as contact_role
                FROM missions m
                LEFT JOIN clients c ON m.client_id = c.id
                LEFT JOIN client_contacts cc ON m.contact_id = cc.id
                WHERE m.deal_id = ANY($1)
                ORDER BY m.deal_id, m.created_at DESC
            `, [dealIds]);

            for (const mission of missionsResult.rows) {
                const dealId = mission.deal_id;
                if (!allMissionsMap.has(dealId)) {
                    allMissionsMap.set(dealId, []);
                }
                const { deal_id: _, ...missionWithoutDealId } = mission;
                allMissionsMap.get(dealId).push(missionWithoutDealId);
            }
        }

        // Query 3: Batch fetch adaptation counts for all missions
        const allMissionIds = [];
        for (const missions of allMissionsMap.values()) {
            for (const mission of missions) {
                allMissionIds.push(mission.id);
            }
        }

        let adaptationsCountMap = new Map();
        if (allMissionIds.length > 0) {
            const adaptResult = await query(`
                SELECT mission_id, COUNT(*) as count
                FROM resume_adaptations
                WHERE mission_id = ANY($1)
                GROUP BY mission_id
            `, [allMissionIds]);

            for (const row of adaptResult.rows) {
                adaptationsCountMap.set(row.mission_id, parseInt(row.count));
            }
        }

        // Query 4: Count resumes per deal (for display)
        let resumeCountMap = new Map();
        if (dealIds.length > 0) {
            const rcResult = await query(`
                SELECT deal_id, COUNT(*) as count
                FROM deal_resumes
                WHERE deal_id = ANY($1)
                GROUP BY deal_id
            `, [dealIds]);
            for (const row of rcResult.rows) {
                resumeCountMap.set(row.deal_id, parseInt(row.count));
            }
        }

        // Assemble deals with their missions
        const deals = dealsResult.rows.map(deal => {
            const missions = (allMissionsMap.get(deal.id) || []).map(mission => ({
                ...mission,
                adaptations_count: adaptationsCountMap.get(mission.id) || 0
            }));

            return {
                ...deal,
                missions,
                missions_count: missions.length,
                resumes_count: resumeCountMap.get(deal.id) || 0
            };
        });

        // Query 5: Get unassigned missions (no deal_id)
        const unassignedConditions = ['m.deal_id IS NULL'];
        const unassignedParams = [];
        if (!isAdmin) {
            unassignedConditions.push('m.firm_id = $1');
            unassignedParams.push(userFirmId);
        }

        const unassignedResult = await query(`
            SELECT m.id, m.title, m.content, m.status, m.keywords,
                   m.required_skills, m.preferred_skills,
                   m.created_at, m.updated_at, m.firm,
                   m.client_id, m.contact_id,
                   c.name as client_name, c.type as client_type,
                   cc.name as contact_name, cc.email as contact_email, cc.role as contact_role
            FROM missions m
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN client_contacts cc ON m.contact_id = cc.id
            WHERE ${unassignedConditions.join(' AND ')}
            ORDER BY m.created_at DESC
        `, unassignedParams);

        // Get adaptation counts for unassigned missions
        const unassignedMissionIds = unassignedResult.rows.map(m => m.id);
        let unassignedAdaptMap = new Map();
        if (unassignedMissionIds.length > 0) {
            const uaResult = await query(`
                SELECT mission_id, COUNT(*) as count
                FROM resume_adaptations
                WHERE mission_id = ANY($1)
                GROUP BY mission_id
            `, [unassignedMissionIds]);
            for (const row of uaResult.rows) {
                unassignedAdaptMap.set(row.mission_id, parseInt(row.count));
            }
        }

        const unassignedMissions = unassignedResult.rows.map(m => ({
            ...m,
            adaptations_count: unassignedAdaptMap.get(m.id) || 0
        }));

        return res.json({
            deals,
            unassigned: unassignedMissions,
            totalDeals: deals.length,
            totalAssigned: deals.reduce((sum, d) => sum + d.missions_count, 0),
            totalUnassigned: unassignedMissions.length
        });
    } catch (error) {
        safeLog('error', 'Error fetching missions grouped by deal', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch grouped missions' });
    }
});

// GET /api/missions/:id - Get mission by ID
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Fetch mission with client, contact, and deal joins
        const result = await query(`
            SELECT m.*, 
                   c.name as client_name, c.type as client_type,
                   cc.name as contact_name, cc.email as contact_email, cc.role as contact_role,
                   d.title as deal_title, d.status as deal_status
            FROM missions m
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN client_contacts cc ON m.contact_id = cc.id
            LEFT JOIN deals d ON m.deal_id = d.id
            WHERE m.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Mission not found' });
        }
        
        const record = result.rows[0];
        
        const isAdmin = req.user?.role === 'admin';
        const userFirm = req.user?.firm;
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
            'Contact Role': record.contact_role,
            'Deal ID': record.deal_id,
            'Deal Title': record.deal_title,
            'Deal Status': record.deal_status
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
        const userFirm = req.user?.firm;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = req.user?.role === 'admin';
        
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

        // Validate deal_id if provided
        const dealId = missionData['Deal ID'] || missionData.deal_id || null;
        if (dealId) {
            const dealResult = await query('SELECT firm_id FROM deals WHERE id = $1', [dealId]);
            if (dealResult.rows.length === 0) {
                return res.status(400).json({ error: 'Deal not found' });
            }
            if (dealResult.rows[0].firm_id !== targetFirmId) {
                return res.status(403).json({ error: 'Deal does not belong to the target firm' });
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
            contact_id: contactId,
            deal_id: dealId
        });

        // Fetch with joins to return full data
        const result = await query(`
            SELECT m.*, 
                   c.name as client_name, c.type as client_type,
                   cc.name as contact_name, cc.email as contact_email, cc.role as contact_role,
                   d.title as deal_title, d.status as deal_status
            FROM missions m
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN client_contacts cc ON m.contact_id = cc.id
            LEFT JOIN deals d ON m.deal_id = d.id
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
            'Contact Role': record.contact_role,
            'Deal ID': record.deal_id,
            'Deal Title': record.deal_title,
            'Deal Status': record.deal_status
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
        const isAdmin = req.user?.role === 'admin';
        const userFirm = req.user?.firm;
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
        
        // Handle deal_id update
        if (updateData['Deal ID'] !== undefined || updateData.deal_id !== undefined) {
            const newDealId = updateData['Deal ID'] || updateData.deal_id;
            if (newDealId) {
                const dealResult = await query('SELECT firm_id FROM deals WHERE id = $1', [newDealId]);
                if (dealResult.rows.length === 0) {
                    return res.status(400).json({ error: 'Deal not found' });
                }
                if (dealResult.rows[0].firm_id !== userFirmId) {
                    return res.status(403).json({ error: 'Deal does not belong to your firm' });
                }
            }
            updates.deal_id = newDealId || null;
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
                   cc.name as contact_name, cc.email as contact_email, cc.role as contact_role,
                   d.title as deal_title, d.status as deal_status
            FROM missions m
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN client_contacts cc ON m.contact_id = cc.id
            LEFT JOIN deals d ON m.deal_id = d.id
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
            'Contact Role': record.contact_role,
            'Deal ID': record.deal_id,
            'Deal Title': record.deal_title,
            'Deal Status': record.deal_status
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
        const isAdmin = req.user?.role === 'admin';
        const userFirm = req.user?.firm;
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
        const isAdmin = req.user?.role === 'admin';
        const userFirm = req.user?.firm;
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
            'Candidate Name': record.candidate_name,
            'Adapted Title': record.adapted_title,
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
        const missionRecord = await findWithTimeout('missions', missionId);
        
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
        
        const isAdmin = req.user?.role === 'admin';
        const userFirm = req.user?.firm || req.user?.firm_id;
        
        // Verify mission access
        const missionRecord = await findWithTimeout('missions', missionId);
        
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
