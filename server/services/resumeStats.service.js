/**
 * Resume Stats Service
 * Data access layer for resume statistics and grouped views
 * Extracted from resumes/stats.routes.js for separation of concerns
 */

import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';

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
export function getCachedStats(cacheKey) {
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
export function setCachedStats(cacheKey, data) {
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

// ============================================
// GROUPED BY DEAL
// ============================================

/**
 * Get resumes grouped by deal (for "Par affaire" view)
 * @param {Object} options
 * @param {string} options.firmId
 * @param {boolean} options.isAdmin
 * @returns {Promise<Object>}
 */
export async function getResumesGroupedByDeal({ firmId, isAdmin }) {
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
    `, [firmId]);

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
        
        for (const resume of resumesResult.rows) {
            const dealId = resume.deal_id;
            if (!allResumesMap.has(dealId)) {
                allResumesMap.set(dealId, []);
            }
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
        unassignedParams.push(firmId);
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

    return {
        deals,
        unassigned: unassignedResult.rows,
        totalDeals: deals.length,
        totalAssigned: deals.reduce((sum, d) => sum + d.resumes.length, 0),
        totalUnassigned: unassignedResult.rows.length
    };
}

// ============================================
// DASHBOARD STATS
// ============================================

/**
 * Fetch resume stats (count, analyzed, improved, scores, date ranges)
 * @param {Object} options
 * @param {string|null} options.userFirmId
 * @returns {Promise<Object>}
 */
export async function getResumeStats({ userFirmId }) {
    let whereClause = '';
    const params = [];
    if (userFirmId) {
        whereClause = 'WHERE r.firm_id = $1';
        params.push(userFirmId);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setMonth(thisMonth.getMonth() - 1);

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
    
    const result = await query(resumeStatsQuery, [...params, today, thisWeek, thisMonth]);
    return result.rows[0];
}

/**
 * Fetch mission stats (total, active)
 * @param {Object} options
 * @param {string|null} options.userFirmId
 * @returns {Promise<Object>}
 */
export async function getMissionStats({ userFirmId }) {
    let missionWhereClause = '';
    let missionParams = [];
    if (userFirmId) {
        missionWhereClause = 'WHERE firm_id = $1';
        missionParams = [userFirmId];
    }
    
    const missionStatsQuery = `
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN LOWER(status) = 'active' THEN 1 END) as active
        FROM missions
        ${missionWhereClause}
    `;
    
    const result = await query(missionStatsQuery, missionParams);
    return result.rows[0];
}

/**
 * Fetch adaptation stats (total count)
 * @param {Object} options
 * @param {string|null} options.userFirmId
 * @returns {Promise<Object>}
 */
export async function getAdaptationStats({ userFirmId }) {
    let adaptationWhereClause = '';
    let adaptationParams = [];
    if (userFirmId) {
        adaptationWhereClause = 'WHERE firm_id = $1';
        adaptationParams = [userFirmId];
    }
    
    const adaptationStatsQuery = `
        SELECT COUNT(*) as total
        FROM resume_adaptations
        ${adaptationWhereClause}
    `;
    
    const result = await query(adaptationStatsQuery, adaptationParams);
    return result.rows[0];
}
