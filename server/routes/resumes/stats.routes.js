/**
 * Resume Routes - Statistics & Grouped Views
 * GET /stats, GET /grouped-by-deal
 */

import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { safeLog } from '../../utils/logger.backend.js';
import { query } from '../../config/database.js';
import { getUserFirmId } from '../../utils/firmHelpers.js';

const router = express.Router();

// ============================================
// STATS CACHE (30 seconds TTL per firm)
// ============================================
const statsCache = new Map();
const STATS_CACHE_TTL = 30 * 1000; // 30 seconds
const MAX_STATS_CACHE_ENTRIES = 100;

/**
 * Get cached stats for a firm
 * @param {string} cacheKey - Cache key (firm_id or 'admin')
 * @returns {Object|null} Cached stats or null if expired/missing
 */
function getCachedStats(cacheKey) {
    const cached = statsCache.get(cacheKey);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > STATS_CACHE_TTL) {
        statsCache.delete(cacheKey);
        return null;
    }
    return cached.data;
}

/**
 * Set cached stats for a firm
 * @param {string} cacheKey - Cache key
 * @param {Object} data - Stats data to cache
 */
function setCachedStats(cacheKey, data) {
    // Enforce max size
    if (statsCache.size >= MAX_STATS_CACHE_ENTRIES) {
        const oldestKey = statsCache.keys().next().value;
        statsCache.delete(oldestKey);
    }
    statsCache.set(cacheKey, { data, timestamp: Date.now() });
}

/**
 * Invalidate stats cache (call after resume changes)
 */
export function invalidateStatsCache(firmId = null) {
    if (firmId) {
        statsCache.delete(firmId);
        statsCache.delete('admin'); // Also invalidate admin cache
    } else {
        statsCache.clear();
    }
    safeLog('debug', 'Stats cache invalidated', { firmId: firmId || 'all' });
}

/**
 * Get stats cache statistics
 */
export function getStatsCacheStats() {
    return {
        size: statsCache.size,
        maxSize: MAX_STATS_CACHE_ENTRIES,
        ttlSeconds: STATS_CACHE_TTL / 1000
    };
}

// GET /api/resumes/grouped-by-deal - Get resumes grouped by deal for the "Par affaire" view
// OPTIMIZED: Uses batch queries instead of N+1 pattern (reduced from ~150 queries to 5)
router.get('/grouped-by-deal', authenticateToken, async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = await getUserFirmId(req);
        
        if (!userFirmId && !isAdmin) {
            return res.status(403).json({ error: 'No firm association' });
        }

        // Query 1: Get all deals for this firm with resume counts
        const dealsResult = await query(`
            SELECT d.id, d.title, d.status, d.priority,
                   c.name as client_name, c.type as client_type,
                   cc.name as contact_name,
                   (SELECT COUNT(*) FROM deal_resumes dr WHERE dr.deal_id = d.id) as resumes_count
            FROM deals d
            LEFT JOIN clients c ON d.client_id = c.id
            LEFT JOIN client_contacts cc ON d.contact_id = cc.id
            WHERE d.firm_id = $1
            ORDER BY 
                CASE d.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
                d.title ASC
        `, [userFirmId]);

        const dealIds = dealsResult.rows.map(d => d.id);
        
        // Query 2: Batch fetch ALL resumes for ALL deals in one query
        let allResumesMap = new Map();
        if (dealIds.length > 0) {
            const resumesResult = await query(`
                SELECT r.id, r.name, r.title, r.status, r.global_rating, r.improved_global_rating,
                       r.created_at, r.file_name, r.original_name, 
                       COALESCE(r.firm_name, f.name) as firm_name,
                       r.candidate_name, r.candidate_email,
                       r.consent_status, r.consent_token_expires_at, r.retention_until,
                       r.skills_cleaned, r.industries_cleaned, r.tools_cleaned, r.soft_skills_cleaned,
                       r.skills, r.industries, r.tools, r.soft_skills,
                       COALESCE(r.relative_path, latest_item.relative_path) as relative_path,
                       dr.deal_id,
                       dr.added_at as deal_added_at, dr.status as deal_resume_status
                FROM resumes r
                INNER JOIN deal_resumes dr ON r.id = dr.resume_id
                LEFT JOIN firms f ON r.firm_id = f.id
                LEFT JOIN LATERAL (
                    SELECT bji.relative_path
                    FROM batch_job_items bji
                    INNER JOIN batch_jobs bj ON bj.id = bji.job_id
                    WHERE bji.relative_path IS NOT NULL
                      AND bj.job_type = 'import'
                      AND (
                          bji.resume_id = r.id
                          OR (
                              bji.resume_id IS NULL
                              AND r.file_name IS NOT NULL
                              AND bji.file_name = r.file_name
                              AND bj.firm_id = r.firm_id
                          )
                      )
                    ORDER BY
                        CASE WHEN bji.resume_id = r.id THEN 0 ELSE 1 END,
                        bji.created_at DESC
                    LIMIT 1
                ) latest_item ON TRUE
                WHERE dr.deal_id = ANY($1)
                ORDER BY dr.deal_id, LOWER(r.name) ASC
            `, [dealIds]);
            
            // Group resumes by deal_id
            for (const resume of resumesResult.rows) {
                const dealId = resume.deal_id;
                if (!allResumesMap.has(dealId)) {
                    allResumesMap.set(dealId, []);
                }
                // Remove deal_id from resume object before adding
                const { deal_id: _, ...resumeWithoutDealId } = resume;
                allResumesMap.get(dealId).push(resumeWithoutDealId);
            }
        }

        // Query 3: Batch fetch ALL missions for ALL deals in one query
        let allMissionsMap = new Map();
        if (dealIds.length > 0) {
            const missionsResult = await query(`
                SELECT m.id, m.title, m.status, m.created_at, m.deal_id
                FROM missions m
                WHERE m.deal_id = ANY($1)
                ORDER BY m.deal_id, m.created_at DESC
            `, [dealIds]);
            
            // Group missions by deal_id
            for (const mission of missionsResult.rows) {
                const dealId = mission.deal_id;
                if (!allMissionsMap.has(dealId)) {
                    allMissionsMap.set(dealId, []);
                }
                const { deal_id: _, ...missionWithoutDealId } = mission;
                allMissionsMap.get(dealId).push(missionWithoutDealId);
            }
        }

        // Query 4: Batch fetch ALL adaptations for ALL missions in one query
        const allMissionIds = [];
        for (const missions of allMissionsMap.values()) {
            for (const mission of missions) {
                allMissionIds.push(mission.id);
            }
        }
        
        let allAdaptationsMap = new Map();
        if (allMissionIds.length > 0) {
            const adaptationsResult = await query(`
                SELECT ra.id, ra.resume_id, ra.resume_name, ra.candidate_name, ra.adapted_title,
                       ra.match_score, ra.status, ra.created_at, ra.mission_id
                FROM resume_adaptations ra
                WHERE ra.mission_id = ANY($1)
                ORDER BY ra.mission_id, ra.created_at DESC
            `, [allMissionIds]);
            
            // Group adaptations by mission_id
            for (const adaptation of adaptationsResult.rows) {
                const missionId = adaptation.mission_id;
                if (!allAdaptationsMap.has(missionId)) {
                    allAdaptationsMap.set(missionId, []);
                }
                const { mission_id: _, ...adaptationWithoutMissionId } = adaptation;
                allAdaptationsMap.get(missionId).push(adaptationWithoutMissionId);
            }
        }

        // Assemble deals with their resumes and missions
        const deals = dealsResult.rows.map(deal => {
            const missions = (allMissionsMap.get(deal.id) || []).map(mission => ({
                ...mission,
                adaptations_count: (allAdaptationsMap.get(mission.id) || []).length,
                adaptations: allAdaptationsMap.get(mission.id) || []
            }));
            
            return {
                ...deal,
                resumes: allResumesMap.get(deal.id) || [],
                missions
            };
        });

        // Query 5: Get unassigned resumes (not in any deal)
        let unassignedCondition = 'WHERE r.id NOT IN (SELECT DISTINCT resume_id FROM deal_resumes WHERE resume_id IS NOT NULL)';
        const unassignedParams = [];
        if (!isAdmin) {
            unassignedCondition += ' AND r.firm_id = $1';
            unassignedParams.push(userFirmId);
        }

        const unassignedResult = await query(`
            SELECT r.id, r.name, r.title, r.status, r.global_rating, r.improved_global_rating,
                   r.created_at, r.file_name, r.original_name, 
                   COALESCE(r.firm_name, f.name) as firm_name,
                   r.candidate_name, r.candidate_email,
                   r.consent_status, r.consent_token_expires_at, r.retention_until,
                   r.skills_cleaned, r.industries_cleaned, r.tools_cleaned, r.soft_skills_cleaned,
                   r.skills, r.industries, r.tools, r.soft_skills,
                   COALESCE(r.relative_path, latest_item.relative_path) as relative_path
            FROM resumes r
            LEFT JOIN firms f ON r.firm_id = f.id
            LEFT JOIN LATERAL (
                SELECT bji.relative_path
                FROM batch_job_items bji
                INNER JOIN batch_jobs bj ON bj.id = bji.job_id
                WHERE bji.relative_path IS NOT NULL
                  AND bj.job_type = 'import'
                  AND (
                      bji.resume_id = r.id
                      OR (
                          bji.resume_id IS NULL
                          AND r.file_name IS NOT NULL
                          AND bji.file_name = r.file_name
                          AND bj.firm_id = r.firm_id
                      )
                  )
                ORDER BY
                    CASE WHEN bji.resume_id = r.id THEN 0 ELSE 1 END,
                    bji.created_at DESC
                LIMIT 1
            ) latest_item ON TRUE
            ${unassignedCondition}
            ORDER BY LOWER(r.name) ASC
        `, unassignedParams);

        return res.json({
            deals,
            unassigned: unassignedResult.rows,
            totalDeals: deals.length,
            totalAssigned: deals.reduce((sum, d) => sum + d.resumes.length, 0),
            totalUnassigned: unassignedResult.rows.length
        });
    } catch (error) {
        safeLog('error', 'Error fetching resumes grouped by deal', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch grouped resumes' });
    }
});

// GET /api/resumes/stats - Get statistics for dashboard KPIs
// OPTIMIZED: Uses 30s cache per firm to reduce DB load
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userFirm = req.user.firm || req.user.customer;
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = isAdmin ? null : await getUserFirmId(req);
        
        // Check cache first
        const cacheKey = isAdmin ? 'admin' : (userFirmId || userFirm || 'unknown');
        const cachedStats = getCachedStats(cacheKey);
        if (cachedStats) {
            safeLog('debug', 'Stats cache hit', { cacheKey });
            return res.json(cachedStats);
        }

        // Build WHERE clause based on user role - use firm_id for consistency with other queries
        let whereClause = '';
        const params = [];
        if (!isAdmin) {
            if (userFirmId) {
                whereClause = 'WHERE r.firm_id = $1';
                params.push(userFirmId);
            } else if (userFirm) {
                // Fallback to firm_name if no firm_id
                whereClause = 'WHERE r.firm_name = $1';
                params.push(userFirm);
            }
        }

        // Calculate date ranges
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thisWeek = new Date(today);
        thisWeek.setDate(thisWeek.getDate() - 7);
        const thisMonth = new Date(today);
        thisMonth.setMonth(thisMonth.getMonth() - 1);

        // Fetch resume stats
        // Note: averageOriginal is calculated only from ANALYZED CVs (those with global_rating > 0)
        // averageImproved is calculated only from IMPROVED CVs (those with improved_global_rating > 0)
        const resumeStatsQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN analyzed_at IS NOT NULL THEN 1 END) as analyzed,
                COUNT(CASE WHEN status = 'Improved' OR improved_global_rating > 0 THEN 1 END) as improved,
                COUNT(CASE WHEN created_at >= $${params.length + 1} THEN 1 END) as today,
                COUNT(CASE WHEN created_at >= $${params.length + 2} THEN 1 END) as this_week,
                COUNT(CASE WHEN created_at >= $${params.length + 3} THEN 1 END) as this_month,
                COALESCE(AVG(CASE WHEN global_rating > 0 THEN global_rating END), 0) as avg_original_score,
                COALESCE(AVG(CASE WHEN improved_global_rating > 0 THEN improved_global_rating END), 0) as avg_improved_score
            FROM resumes r
            ${whereClause}
        `;
        
        const resumeStatsResult = await query(resumeStatsQuery, [...params, today, thisWeek, thisMonth]);
        const resumeStats = resumeStatsResult.rows[0];

        // Fetch mission stats - use same logic as missions.routes.js (firm OR firm_id)
        let missionWhereClause = '';
        let missionParams = [];
        if (!isAdmin) {
            const userFirmId = await getUserFirmId(req);
            if (userFirmId) {
                missionWhereClause = 'WHERE (firm = $1 OR firm_id = $2)';
                missionParams = [userFirm || '', userFirmId];
            } else if (userFirm) {
                missionWhereClause = 'WHERE firm = $1';
                missionParams = [userFirm];
            }
        }
        
        const missionStatsQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN LOWER(status) = 'active' THEN 1 END) as active
            FROM missions
            ${missionWhereClause}
        `;
        
        const missionStatsResult = await query(missionStatsQuery, missionParams);
        const missionStats = missionStatsResult.rows[0];

        // Fetch adaptation stats - use same firm/firm_id logic
        let adaptationWhereClause = '';
        let adaptationParams = [];
        if (!isAdmin) {
            const userFirmId = await getUserFirmId(req);
            if (userFirmId) {
                adaptationWhereClause = 'WHERE (firm = $1 OR firm_id = $2)';
                adaptationParams = [userFirm || '', userFirmId];
            } else if (userFirm) {
                adaptationWhereClause = 'WHERE firm = $1';
                adaptationParams = [userFirm];
            }
        }
        
        const adaptationStatsQuery = `
            SELECT COUNT(*) as total
            FROM resume_adaptations
            ${adaptationWhereClause}
        `;
        
        const adaptationStatsResult = await query(adaptationStatsQuery, adaptationParams);
        const adaptationStats = adaptationStatsResult.rows[0];

        const avgOriginal = parseFloat(resumeStats.avg_original_score) || 0;
        const avgImproved = parseFloat(resumeStats.avg_improved_score) || 0;
        
        const stats = {
            resumes: {
                total: parseInt(resumeStats.total) || 0,
                analyzed: parseInt(resumeStats.analyzed) || 0,
                improved: parseInt(resumeStats.improved) || 0,
                today: parseInt(resumeStats.today) || 0,
                thisWeek: parseInt(resumeStats.this_week) || 0,
                thisMonth: parseInt(resumeStats.this_month) || 0
            },
            missions: {
                total: parseInt(missionStats.total) || 0,
                active: parseInt(missionStats.active) || 0
            },
            adaptations: {
                total: parseInt(adaptationStats.total) || 0
            },
            scores: {
                averageOriginal: Math.round(avgOriginal),
                averageImproved: Math.round(avgImproved),
                // Improvement is the absolute difference in points (e.g., 62% -> 82% = +20 points)
                improvement: Math.round(avgImproved - avgOriginal)
            },
            customer: isAdmin ? null : userFirm
        };

        // Cache the stats
        setCachedStats(cacheKey, stats);
        safeLog('debug', 'Stats cached', { cacheKey });

        res.json(stats);
    } catch (error) {
        safeLog('error', 'Error fetching resume stats', { 
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

export default router;
