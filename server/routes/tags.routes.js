/**
 * Tags Routes - PostgreSQL Version
 * Handles tag management operations
 */

import express from 'express';
import { authenticateToken, requireUserManager, isUserAdmin } from '../middleware/auth.middleware.js';
import { validateBody, renameTagSchema, escoRecalculateSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import { aggregateRawTags, aggregateCleanedTags, aggregateEscoTags, fetchResumeBatch, updateResumeTags, renameTag } from '../services/tags.service.js';
import { processCleanedTagsToEsco } from '../services/escoService.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import {
    destroyTagsCache,
    getCachedCleanedTags,
    getCachedEscoTags,
    getTagsCacheStats,
    invalidateTagsCache,
    setCachedCleanedTags,
    setCachedEscoTags,
    startTagsCacheCleanup
} from '../services/tagsCache.service.js';

const router = express.Router();
const applyTagsReadHeaders = (_req, res, next) => {
    res.set({
        'Cache-Control': 'private, no-cache, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
};

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

function buildStandardTagsResponse(row = {}) {
    return {
        'Skills': row.skills || [],
        'Industries': row.industries || [],
        'Tools': row.tools || [],
        'Soft Skills': row.soft_skills || []
    };
}

async function resolveTagsAccess(req, res, { requireFirmForNonAdmin = true } = {}) {
    const isAdmin = isUserAdmin(req);
    const userFirmId = await getUserFirmId(req);

    if (requireFirmForNonAdmin && !isAdmin && !userFirmId) {
        res.status(403).json({ error: 'No firm association' });
        return null;
    }

    return { isAdmin, userFirmId };
}

// ============================================
// TAG MANAGEMENT ROUTES
// ============================================

// GET /api/tags - Get all tags from resumes (optimized SQL aggregation)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const access = await resolveTagsAccess(req, res);
        if (!access) {
            return;
        }

        const row = await aggregateRawTags(access);
        res.json(buildStandardTagsResponse(row));
    } catch (error) {
        safeLog('error', 'Error fetching tags', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch tags' });
    }
});

// GET /api/tags/cleaned - Get cleaned tags (aggregated from resumes - filtered by firm for non-admins)
router.get('/cleaned', applyTagsReadHeaders, authenticateToken, async (req, res) => {
    try {
        const scope = req.query.scope === 'grouped-by-deal' ? 'grouped-by-deal' : 'default';
        const access = await resolveTagsAccess(req, res, {
            requireFirmForNonAdmin: scope === 'grouped-by-deal'
        });
        if (!access) {
            return;
        }

        // Cache key includes scope and firm_id for proper isolation
        const cacheKey = access.isAdmin
            ? `admin_${scope}`
            : `firm_${access.userFirmId}_${scope}`;
        
        // Return cached cleaned tags if available and not expired (per-firm cache)
        const cachedResult = getCachedCleanedTags(cacheKey);
        if (cachedResult) {
            return res.json(cachedResult);
        }
        
        const row = await aggregateCleanedTags({ ...access, scope });
        const result = buildStandardTagsResponse(row);
        
        // Update per-firm cache with timestamp (enforce max size)
        setCachedCleanedTags(cacheKey, result);
        
        res.json(result);
    } catch (error) {
        safeLog('error', 'Error fetching cleaned tags', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch cleaned tags' });
    }
});

// POST /api/tags/cleaned/recalculate - Recalculate cleaned tags for all resumes (batch processing)
router.post('/cleaned/recalculate', authenticateToken, requireUserManager, async (req, res) => {
    try {
        const { processAnalysisTags } = await import('../utils/tagCleaner.js');
        const access = await resolveTagsAccess(req, res);
        if (!access) {
            return;
        }
        
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
                BATCH_SIZE, offset,
                { firmId: access.isAdmin ? null : access.userFirmId }
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
        invalidateTagsCache();
        
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
        const access = await resolveTagsAccess(req, res);
        if (!access) {
            return;
        }

        // Return cached ESCO tags if available and not expired
        if (access.isAdmin) {
            const cachedEscoTags = getCachedEscoTags();
            if (cachedEscoTags) {
                return res.json(cachedEscoTags);
            }
        }
        
        // Use PostgreSQL to aggregate ESCO tags directly in the database
        // ESCO tags are stored as JSONB arrays of objects {label, uri}
        // Note: PostgreSQL doesn't allow ORDER BY in jsonb_agg(DISTINCT ...), so we use subqueries
        // For ESCO tags (objects), we deduplicate by uri and order by label
        const row = await aggregateEscoTags(access);
        const result = {
            skills: row.skills || [],
            industries: row.industries || [],
            tools: row.tools || [],
            softSkills: row.soft_skills || []
        };
        
        // Update cache with timestamp
        if (access.isAdmin) {
            setCachedEscoTags(result);
        }
        
        res.json(result);
    } catch (error) {
        safeLog('error', 'Error fetching ESCO tags', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch ESCO tags' });
    }
});

// POST /api/tags/esco/recalculate - Recalculate ESCO tags for all resumes from cleaned tags (batch processing)
router.post('/esco/recalculate', authenticateToken, requireUserManager, validateBody(escoRecalculateSchema), async (req, res) => {
    try {
        const { language = 'fr' } = req.body;
        const access = await resolveTagsAccess(req, res);
        if (!access) {
            return;
        }
        
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
                BATCH_SIZE, offset,
                { firmId: access.isAdmin ? null : access.userFirmId }
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
        invalidateTagsCache();
        
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
router.put('/rename', authenticateToken, requireUserManager, validateBody(renameTagSchema), async (req, res) => {
    try {
        const { category, oldName, newName } = req.body;
        const access = await resolveTagsAccess(req, res);
        if (!access) {
            return;
        }
        
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

        const result = await renameTag(dbField, oldName, newName, {
            firmId: access.isAdmin ? null : access.userFirmId
        });
        const updatedCount = result.length;

        // Clear caches
        invalidateTagsCache();

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
export { invalidateTagsCache, destroyTagsCache, getTagsCacheStats, startTagsCacheCleanup };
