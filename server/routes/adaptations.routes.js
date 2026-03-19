/**
 * Adaptations Routes - PostgreSQL Version
 * Handles CRUD operations for resume adaptations to missions
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateParams, validateBody, updateAdaptationSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import { selectWithTimeout, findWithTimeout, updateWithTimeout, destroyWithTimeout } from '../utils/postgresHelpers.js';
import { query } from '../config/database.js';
import { getUserFirmId } from '../utils/firmHelpers.js';

const router = express.Router();

// ============================================
// ADAPTATIONS ROUTES
// ============================================

// GET /api/adaptations - Get all adaptations (with server-side pagination and filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { resumeId, missionId, status, search } = req.query;
        const isAdmin = req.user?.role === 'admin';
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

// GET /api/adaptations/grouped-by-deal - Get adaptations grouped by deal > mission
router.get('/grouped-by-deal', authenticateToken, async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
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

        // Query 2: Get missions that belong to these deals AND have adaptations
        let missionsByDeal = new Map();
        let allMissionIds = [];
        if (dealIds.length > 0) {
            const missionsResult = await query(`
                SELECT DISTINCT m.id, m.title, m.status, m.deal_id,
                       m.client_id, m.contact_id,
                       c.name as client_name,
                       cc.name as contact_name
                FROM missions m
                INNER JOIN resume_adaptations ra ON ra.mission_id = m.id
                LEFT JOIN clients c ON m.client_id = c.id
                LEFT JOIN client_contacts cc ON m.contact_id = cc.id
                WHERE m.deal_id = ANY($1)
                ORDER BY m.deal_id, m.title ASC
            `, [dealIds]);

            for (const mission of missionsResult.rows) {
                const dealId = mission.deal_id;
                if (!missionsByDeal.has(dealId)) {
                    missionsByDeal.set(dealId, []);
                }
                missionsByDeal.get(dealId).push(mission);
                allMissionIds.push(mission.id);
            }
        }

        // Query 3: Batch fetch adaptations for all deal-linked missions
        let adaptationsByMission = new Map();
        if (allMissionIds.length > 0) {
            const adaptResult = await query(`
                SELECT ra.id, ra.mission_id, ra.resume_id,
                       ra.resume_name, ra.candidate_name,
                       ra.adapted_title, ra.match_score,
                       ra.status, ra.created_at
                FROM resume_adaptations ra
                WHERE ra.mission_id = ANY($1)
                ORDER BY ra.created_at DESC
            `, [allMissionIds]);

            for (const adapt of adaptResult.rows) {
                const mid = adapt.mission_id;
                if (!adaptationsByMission.has(mid)) {
                    adaptationsByMission.set(mid, []);
                }
                adaptationsByMission.get(mid).push(adapt);
            }
        }

        // Assemble deals with missions and their adaptations
        const deals = dealsResult.rows
            .map(deal => {
                const missions = (missionsByDeal.get(deal.id) || []).map(mission => {
                    const adaptations = adaptationsByMission.get(mission.id) || [];
                    return {
                        id: mission.id,
                        title: mission.title,
                        status: mission.status,
                        client_name: mission.client_name,
                        contact_name: mission.contact_name,
                        adaptations,
                        adaptations_count: adaptations.length
                    };
                });

                const totalAdaptations = missions.reduce((sum, m) => sum + m.adaptations_count, 0);

                return {
                    ...deal,
                    missions,
                    missions_count: missions.length,
                    adaptations_count: totalAdaptations
                };
            })
            .filter(deal => deal.adaptations_count > 0); // Only show deals that have adaptations

        // Query 4: Get adaptations for missions WITHOUT a deal
        const firmFilter = !isAdmin ? 'AND ra.firm = (SELECT name FROM firms WHERE id = $1)' : '';
        const firmParams = !isAdmin ? [userFirmId] : [];

        const unassignedResult = await query(`
            SELECT DISTINCT m.id as mission_id, m.title as mission_title, m.status as mission_status,
                   c.name as client_name, cc.name as contact_name
            FROM missions m
            INNER JOIN resume_adaptations ra ON ra.mission_id = m.id
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN client_contacts cc ON m.contact_id = cc.id
            WHERE m.deal_id IS NULL ${firmFilter}
            ORDER BY m.title ASC
        `, firmParams);

        const unassignedMissionIds = unassignedResult.rows.map(m => m.mission_id);
        let unassignedAdaptations = new Map();
        if (unassignedMissionIds.length > 0) {
            const uaResult = await query(`
                SELECT ra.id, ra.mission_id, ra.resume_id,
                       ra.resume_name, ra.candidate_name,
                       ra.adapted_title, ra.match_score,
                       ra.status, ra.created_at
                FROM resume_adaptations ra
                WHERE ra.mission_id = ANY($1)
                ORDER BY ra.created_at DESC
            `, [unassignedMissionIds]);

            for (const adapt of uaResult.rows) {
                const mid = adapt.mission_id;
                if (!unassignedAdaptations.has(mid)) {
                    unassignedAdaptations.set(mid, []);
                }
                unassignedAdaptations.get(mid).push(adapt);
            }
        }

        const unassigned = unassignedResult.rows.map(m => {
            const adaptations = unassignedAdaptations.get(m.mission_id) || [];
            return {
                id: m.mission_id,
                title: m.mission_title,
                status: m.mission_status,
                client_name: m.client_name,
                contact_name: m.contact_name,
                adaptations,
                adaptations_count: adaptations.length
            };
        });

        const totalAssigned = deals.reduce((sum, d) => sum + d.adaptations_count, 0);
        const totalUnassigned = unassigned.reduce((sum, m) => sum + m.adaptations_count, 0);

        return res.json({
            deals,
            unassigned,
            totalDeals: deals.length,
            totalAssigned,
            totalUnassigned
        });
    } catch (error) {
        safeLog('error', 'Error fetching adaptations grouped by deal', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch grouped adaptations' });
    }
});

// GET /api/adaptations/:id - Get single adaptation
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const record = await findWithTimeout('resume_adaptations', id);
        
        const isAdmin = req.user?.role === 'admin';
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
        const isAdmin = req.user?.role === 'admin';
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
        const isAdmin = req.user?.role === 'admin';
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
