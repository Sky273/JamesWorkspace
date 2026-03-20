/**
 * Tags Routes - PostgreSQL Version
 * Handles tag management operations
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, renameTagSchema, escoRecalculateSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import { aggregateRawTags, aggregateCleanedTags, aggregateEscoTags, fetchResumeBatch, updateResumeTags, renameTag } from '../services/tags.service.js';
import { processCleanedTagsToEsco } from '../services/escoService.js';
import { getUserFirmId } from '../utils/firmHelpers.js';

const router = express.Router();

// Cache configuration
const TAGS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// In-memory cache for cleaned tags (per-firm cache: Map<firm_id|'admin', result>)
const cleanedTagsCache = new Map();
const cleanedTagsCacheTime = new Map();
// In-memory cache for ESCO tags
let escoTagsCache = null;
let escoTagsCacheTime = 0;

// Maximum cache entries to prevent memory leaks
const MAX_TAGS_CACHE_ENTRIES = 100;

// Periodic cache cleanup - auto-expire if not accessed for 2x TTL
const tagsCacheCleanupInterval = setInterval(() => {
    const now = Date.now();
    let expiredCount = 0;
    // Clean up per-firm cleaned tags cache
    for (const [key, timestamp] of cleanedTagsCacheTime.entries()) {
        if (now - timestamp > TAGS_CACHE_TTL * 2) {
            cleanedTagsCache.delete(key);
            cleanedTagsCacheTime.delete(key);
            expiredCount++;
        }
    }
    if (expiredCount > 0) {
        safeLog('debug', `Tags: Cleaned tags cache auto-expired`, { expiredCount });
    }
    if (escoTagsCacheTime && now - escoTagsCacheTime > TAGS_CACHE_TTL * 2) {
        escoTagsCache = null;
        escoTagsCacheTime = 0;
        safeLog('debug', 'Tags: ESCO tags cache auto-expired');
    }
}, TAGS_CACHE_TTL);

/**
 * Invalidate tags cache
 */
function invalidateTagsCache() {
    cleanedTagsCache.clear();
    cleanedTagsCacheTime.clear();
    escoTagsCache = null;
    escoTagsCacheTime = 0;
    safeLog('debug', 'Tags: Cache invalidated');
}

/**
 * Destroy tags cache and cleanup interval (for graceful shutdown)
 */
function destroyTagsCache() {
    if (tagsCacheCleanupInterval) {
        clearInterval(tagsCacheCleanupInterval);
    }
    cleanedTagsCache.clear();
    cleanedTagsCacheTime.clear();
    escoTagsCache = null;
    escoTagsCacheTime = 0;
    safeLog('info', 'Tags: Cache destroyed');
}

/**
 * Get tags cache statistics
 */
function getTagsCacheStats() {
    return {
        cleanedTags: {
            size: cleanedTagsCache.size,
            maxSize: MAX_TAGS_CACHE_ENTRIES,
            keys: [...cleanedTagsCache.keys()]
        },
        escoTags: {
            hasData: !!escoTagsCache,
            ageMs: escoTagsCacheTime ? Date.now() - escoTagsCacheTime : null
        },
        ttlMinutes: TAGS_CACHE_TTL / (60 * 1000)
    };
}

/**
 * Parse JSON field from database
 */
function parseJsonField(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return [];
        }
    }
    return [];
}

// ============================================
// TAG MANAGEMENT ROUTES
// ============================================

// GET /api/tags - Get all tags from resumes (optimized SQL aggregation)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const row = await aggregateRawTags();
        res.json({
            'Skills': row.skills || [],
            'Industries': row.industries || [],
            'Tools': row.tools || [],
            'Soft Skills': row.soft_skills || []
        });
    } catch (error) {
        safeLog('error', 'Error fetching tags', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch tags' });
    }
});

// GET /api/tags/cleaned - Get cleaned tags (aggregated from resumes - filtered by firm for non-admins)
router.get('/cleaned', authenticateToken, async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = await getUserFirmId(req);
        const scope = req.query.scope === 'grouped-by-deal' ? 'grouped-by-deal' : 'default';
        
        if (scope === 'grouped-by-deal' && !userFirmId && !isAdmin) {
            return res.status(403).json({ error: 'No firm association' });
        }

        // Cache key includes scope and firm_id for proper isolation
        const cacheKey = isAdmin
            ? `admin_${scope}`
            : `firm_${userFirmId}_${scope}`;
        
        // Return cached cleaned tags if available and not expired (per-firm cache)
        const cachedResult = cleanedTagsCache.get(cacheKey);
        const cachedTime = cleanedTagsCacheTime.get(cacheKey);
        if (cachedResult && cachedTime && (Date.now() - cachedTime) < TAGS_CACHE_TTL) {
            return res.json(cachedResult);
        }
        
        const row = await aggregateCleanedTags({ isAdmin, userFirmId, scope });
        const result = {
            'Skills': row.skills || [],
            'Industries': row.industries || [],
            'Tools': row.tools || [],
            'Soft Skills': row.soft_skills || []
        };
        
        // Update per-firm cache with timestamp (enforce max size)
        if (cleanedTagsCache.size >= MAX_TAGS_CACHE_ENTRIES) {
            // Remove oldest entry
            const oldestKey = cleanedTagsCache.keys().next().value;
            cleanedTagsCache.delete(oldestKey);
            cleanedTagsCacheTime.delete(oldestKey);
        }
        cleanedTagsCache.set(cacheKey, result);
        cleanedTagsCacheTime.set(cacheKey, Date.now());
        
        res.json(result);
    } catch (error) {
        safeLog('error', 'Error fetching cleaned tags', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch cleaned tags' });
    }
});

// POST /api/tags/cleaned/recalculate - Recalculate cleaned tags for all resumes (batch processing)
router.post('/cleaned/recalculate', authenticateToken, async (req, res) => {
    try {
        const { processAnalysisTags } = await import('../utils/tagCleaner.js');
        
        const BATCH_SIZE = 100;
        let offset = 0;
        let totalProcessed = 0;
        let updatedCount = 0;
        const errors = [];
        
        safeLog('info', 'Starting cleaned tags recalculation (batch mode)');
        
        // Process in batches to avoid memory issues
        while (true) {
            // Fetch batch of resumes
            const records = await fetchResumeBatch(
                ['id', 'skills', 'industries', 'tools', 'soft_skills'],
                BATCH_SIZE, offset
            );
            
            if (records.length === 0) break;
            
            safeLog('debug', `Processing batch ${Math.floor(offset / BATCH_SIZE) + 1}`, { 
                batchSize: records.length,
                offset 
            });
            
            // Process each resume in the batch
            for (const record of records) {
                try {
                    const rawTags = {
                        skills: parseJsonField(record.skills),
                        industries: parseJsonField(record.industries),
                        tools: parseJsonField(record.tools),
                        softSkills: parseJsonField(record.soft_skills)
                    };
                    
                    // Calculate cleaned tags
                    const { cleanedTags } = processAnalysisTags({ tags: rawTags });
                    
                    // Update the resume with cleaned tags (stringify for JSONB columns)
                    await updateResumeTags(record.id, {
                        skills_cleaned: cleanedTags.skills.length > 0 ? JSON.stringify(cleanedTags.skills) : null,
                        industries_cleaned: cleanedTags.industries.length > 0 ? JSON.stringify(cleanedTags.industries) : null,
                        tools_cleaned: cleanedTags.tools.length > 0 ? JSON.stringify(cleanedTags.tools) : null,
                        soft_skills_cleaned: cleanedTags.softSkills.length > 0 ? JSON.stringify(cleanedTags.softSkills) : null
                    });
                    updatedCount++;
                    
                } catch (recordError) {
                    safeLog('error', 'Error recalculating cleaned tags for resume', { 
                        recordId: record.id, 
                        error: recordError.message 
                    });
                    errors.push({ recordId: record.id, error: recordError.message });
                }
            }
            
            totalProcessed += records.length;
            offset += BATCH_SIZE;
            
            // Break if we got less than batch size (last batch)
            if (records.length < BATCH_SIZE) break;
        }
        
        // Clear cache to force refresh
        cleanedTagsCache.clear();
        cleanedTagsCacheTime.clear();
        
        safeLog('info', 'Cleaned tags recalculated', { 
            totalResumes: totalProcessed,
            updatedCount,
            errorCount: errors.length
        });
        
        res.json({ 
            message: 'Cleaned tags recalculated successfully',
            totalResumes: totalProcessed,
            updatedCount,
            errorCount: errors.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        safeLog('error', 'Error recalculating cleaned tags', { error: error.message });
        res.status(500).json({ error: 'Failed to recalculate cleaned tags' });
    }
});

// GET /api/tags/esco - Get ESCO normalized tags (aggregated from all resumes - optimized SQL)
router.get('/esco', authenticateToken, async (req, res) => {
    try {
        // Return cached ESCO tags if available and not expired
        if (escoTagsCache && escoTagsCacheTime && (Date.now() - escoTagsCacheTime) < TAGS_CACHE_TTL) {
            return res.json(escoTagsCache);
        }
        
        // Use PostgreSQL to aggregate ESCO tags directly in the database
        // ESCO tags are stored as JSONB arrays of objects {label, uri}
        // Note: PostgreSQL doesn't allow ORDER BY in jsonb_agg(DISTINCT ...), so we use subqueries
        // For ESCO tags (objects), we deduplicate by uri and order by label
        const row = await aggregateEscoTags();
        const result = {
            skills: row.skills || [],
            industries: row.industries || [],
            tools: row.tools || [],
            softSkills: row.soft_skills || []
        };
        
        // Update cache with timestamp
        escoTagsCache = result;
        escoTagsCacheTime = Date.now();
        
        res.json(result);
    } catch (error) {
        safeLog('error', 'Error fetching ESCO tags', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch ESCO tags' });
    }
});

// POST /api/tags/esco/recalculate - Recalculate ESCO tags for all resumes from cleaned tags (batch processing)
router.post('/esco/recalculate', authenticateToken, validateBody(escoRecalculateSchema), async (req, res) => {
    try {
        const { language = 'fr' } = req.body;
        
        const BATCH_SIZE = 50; // Smaller batch for ESCO (API calls)
        let offset = 0;
        let totalProcessed = 0;
        let updatedCount = 0;
        const errors = [];
        
        safeLog('info', 'Starting ESCO tags recalculation (batch mode)', { language });
        
        // Process in batches to avoid memory issues
        while (true) {
            // Fetch batch of resumes
            const records = await fetchResumeBatch(
                ['id', 'skills_cleaned', 'industries_cleaned', 'tools_cleaned', 'soft_skills_cleaned'],
                BATCH_SIZE, offset
            );
            
            if (records.length === 0) break;
            
            safeLog('debug', `Processing ESCO batch ${Math.floor(offset / BATCH_SIZE) + 1}`, { 
                batchSize: records.length,
                offset 
            });
            
            // Process each resume in the batch
            for (const record of records) {
                try {
                    const cleanedTags = {
                        skills: parseJsonField(record.skills_cleaned),
                        industries: parseJsonField(record.industries_cleaned),
                        tools: parseJsonField(record.tools_cleaned),
                        softSkills: parseJsonField(record.soft_skills_cleaned)
                    };
                    
                    // Convert cleaned tags to ESCO for this resume
                    const escoTags = await processCleanedTagsToEsco(cleanedTags, language);
                    
                    // Update the resume with ESCO tags (stringify for JSONB columns)
                    await updateResumeTags(record.id, {
                        skills_esco: escoTags.skills.length > 0 ? JSON.stringify(escoTags.skills) : null,
                        industries_esco: escoTags.industries.length > 0 ? JSON.stringify(escoTags.industries) : null,
                        tools_esco: escoTags.tools.length > 0 ? JSON.stringify(escoTags.tools) : null,
                        soft_skills_esco: escoTags.softSkills.length > 0 ? JSON.stringify(escoTags.softSkills) : null
                    });
                    updatedCount++;
                    
                } catch (recordError) {
                    safeLog('error', 'Error recalculating ESCO tags for resume', { 
                        recordId: record.id, 
                        error: recordError.message 
                    });
                    errors.push({ recordId: record.id, error: recordError.message });
                }
            }
            
            totalProcessed += records.length;
            offset += BATCH_SIZE;
            
            // Break if we got less than batch size (last batch)
            if (records.length < BATCH_SIZE) break;
        }
        
        // Clear cache to force refresh
        escoTagsCache = null;
        
        safeLog('info', 'ESCO tags recalculated', { 
            totalResumes: totalProcessed,
            updatedCount,
            errorCount: errors.length
        });
        
        res.json({ 
            message: 'ESCO tags recalculated successfully',
            totalResumes: totalProcessed,
            updatedCount,
            errorCount: errors.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        safeLog('error', 'Error recalculating ESCO tags', { error: error.message });
        res.status(500).json({ error: 'Failed to recalculate ESCO tags' });
    }
});

// PUT /api/tags/rename - Rename tag across all resumes (optimized SQL)
router.put('/rename', authenticateToken, validateBody(renameTagSchema), async (req, res) => {
    try {
        const { category, oldName, newName } = req.body;
        
        if (!category || !oldName || !newName) {
            return res.status(400).json({ error: 'Missing required fields: category, oldName, newName' });
        }

        // Map category to database field
        const categoryToField = {
            'Skills': 'skills',
            'Industries': 'industries',
            'Tools': 'tools',
            'Soft Skills': 'soft_skills'
        };
        
        const dbField = categoryToField[category];
        if (!dbField) {
            return res.status(400).json({ error: 'Invalid category' });
        }

        const result = await renameTag(dbField, oldName, newName);
        const updatedCount = result.length;

        // Clear caches
        cleanedTagsCache.clear();
        cleanedTagsCacheTime.clear();
        escoTagsCache = null;

        safeLog('info', 'Tag renamed via SQL', { 
            category, 
            oldName, 
            newName, 
            updatedCount 
        });

        res.json({ 
            message: `Successfully renamed tag from "${oldName}" to "${newName}"`,
            updatedCount
        });
    } catch (error) {
        safeLog('error', 'Error renaming tag', { error: error.message });
        res.status(500).json({ error: 'Failed to rename tag' });
    }
});

// Export router and cache management functions
export default router;
export { invalidateTagsCache, destroyTagsCache, getTagsCacheStats };
