/**
 * Resume Routes - CRUD Operations
 * GET /, GET /:id, PUT /:id, DELETE /:id
 */

import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { validateParams, validateBody, updateResumeSchema } from '../../utils/validation.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../../services/security.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import { getUserFirmId, isUserAdmin } from '../../utils/firmHelpers.js';
import { processAnalysisTags } from '../../utils/tagCleaner.js';
import { invalidateTagsCache } from '../tags.routes.js';
import { createVersion, hasImprovedTextChanged } from '../../services/resumeVersions.service.js';
import * as resumesService from '../../services/resumes.service.js';
import { 
    checkResumeAccess, 
    parseScore, 
    stringifyIfNeeded, 
    mapResumeToFrontend
} from './helpers.js';

const router = express.Router();

// GET /api/resumes - Get all resumes (with server-side pagination and filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        // Extract filter parameters
        const { search, status, tags: _tags, dealId } = req.query;

        // Build WHERE clause
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        let needsJoin = false;
        
        // Firm filter (non-admin users) - filter by firm_id only
        if (!isAdmin) {
            const userFirmId = await getUserFirmId(req);
            safeLog('info', 'Resumes GET - user firm filter', { 
                userFirmId, 
                userId: req.user?.id 
            });
            if (userFirmId) {
                conditions.push(`firm_id = $${paramIndex}`);
                params.push(userFirmId);
                paramIndex++;
            } else {
                // No valid firm_id - return empty results for security
                safeLog('warn', 'User has no valid firm_id, returning empty results', { userId: req.user?.id });
                return res.json({
                    data: [],
                    pagination: { page: 1, limit, totalPages: 0, totalCount: 0, hasMore: false }
                });
            }
        }
        
        // Status filter
        if (status && status !== 'all') {
            conditions.push(`status = $${paramIndex}`);
            params.push(status.toLowerCase());
            paramIndex++;
        }
        
        // Search filter (searches in name, title, file_name)
        if (search) {
            const escaped = search.toLowerCase().replace(/[%_\\]/g, '\\$&');
            conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(title) LIKE $${paramIndex} OR LOWER(file_name) LIKE $${paramIndex})`);
            params.push(`%${escaped}%`);
            paramIndex++;
        }

        // Deal filter (filter by affaire) - requires JOIN
        if (dealId) {
            needsJoin = true;
        }

        // Get total count for pagination
        const totalCount = await resumesService.countResumes({
            conditions, params, dealId, dealParamIndex: paramIndex
        });

        // Fetch resumes with pagination
        const resumes = await resumesService.listResumes({
            conditions, params, dealId, dealParamIndex: paramIndex, limit, offset
        });

        // Check if there are more records
        const hasMore = resumes.length > limit;
        if (hasMore) {
            resumes.pop();
        }

        // Map to frontend format
        const processedRecords = resumes.map(mapResumeToFrontend);

        const response = {
            data: processedRecords,
            resumes: processedRecords,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasMore,
                nextPage: hasMore ? page + 1 : null
            }
        };

        return res.json(response);
    } catch (error) {
        safeLog('error', 'Error fetching resumes', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch resumes' 
        });
    }
});

// GET /api/resumes/:id/download - Download original CV file
// IMPORTANT: This route must be defined BEFORE /:id to avoid route conflict
router.get('/:id/download', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const userFirm = req.user.firm || req.user.customer;
        const isAdmin = req.user?.role === 'admin';

        // Fetch resume with file data
        const resume = await resumesService.getResumeFileForDownload(id);

        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Check access rights (non-admin can only access their customer's resumes)
        if (!isAdmin && userFirm && resume.firm_name !== userFirm) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if file data exists
        if (!resume.resume_file_data) {
            return res.status(404).json({ error: 'File not found in database' });
        }

        // Set response headers for file download
        res.setHeader('Content-Type', resume.resume_file_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resume.file_name)}"`);
        res.setHeader('Content-Length', resume.resume_file_size || resume.resume_file_data.length);

        // Send file data
        res.send(resume.resume_file_data);
    } catch (error) {
        safeLog('error', 'Error downloading resume file', { id: req.params.id, error: error.message });
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// GET /api/resumes/:id - Get resume by ID
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        // Fetch resume (excluding binary file data)
        const resume = await resumesService.getResumeById(id);
        
        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        
        // Verify user has access to this resume (firm-based access control using firm_id)
        if (!isUserAdmin(req)) {
            const userFirmId = await getUserFirmId(req);
            if (!userFirmId || resume.firm_id !== userFirmId) {
                safeLog('warn', 'Access denied: user tried to view resume from different firm', {
                    userId: req.user?.id,
                    userFirmId,
                    resumeFirmId: resume.firm_id,
                    resumeId: id
                });
                return res.status(403).json({ error: 'Access denied: You can only view resumes from your firm' });
            }
        }
        
        // Map to frontend format
        res.json(mapResumeToFrontend(resume));
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        safeLog('error', 'Error fetching resume', { error: error.message, resumeId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to fetch resume' 
        });
    }
});

// PUT /api/resumes/:id - Update resume
router.put('/:id', authenticateToken, validateParams('id'), validateBody(updateResumeSchema), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify user has access to this resume (firm-based access control)
        const { hasAccess, error: accessError } = await checkResumeAccess(req, id);
        
        if (!hasAccess) {
            const statusCode = accessError === 'Resume not found' ? 404 : 403;
            return res.status(statusCode).json({ error: accessError });
        }
        
        safeLog('info', 'PUT /api/resumes/:id called', { 
            resumeId: id, 
            bodyKeys: Object.keys(req.body),
            hasImprovedGlobalRating: req.body['Improved Global Rating'] !== undefined,
            improvedGlobalRatingValue: req.body['Improved Global Rating'],
            improvedSkillsScoreValue: req.body['Improved Skills Score'],
            improvedExperienceScoreValue: req.body['Improved Experience Score']
        });
        const updateData = {};

        // Map frontend fields to PostgreSQL columns
        if (req.body.Name !== undefined) updateData.name = req.body.Name;
        if (req.body.Title !== undefined) updateData.title = req.body.Title;
        if (req.body.Status !== undefined) updateData.status = req.body.Status.toLowerCase();
        if (req.body['Original Text'] !== undefined) updateData.original_text = req.body['Original Text'];
        if (req.body['Improved Text'] !== undefined) updateData.improved_text = req.body['Improved Text'];
        
        // Parse scores - handle "75%", 75, "75" formats
        if (req.body['Global Rating'] !== undefined) updateData.global_rating = parseScore(req.body['Global Rating']);
        if (req.body['Skills Score'] !== undefined) updateData.skills_score = parseScore(req.body['Skills Score']);
        if (req.body['Experience Score'] !== undefined) updateData.experience_score = parseScore(req.body['Experience Score']);
        if (req.body['Education Score'] !== undefined) updateData.education_score = parseScore(req.body['Education Score']);
        if (req.body['ATS Score'] !== undefined) updateData.ats_score = parseScore(req.body['ATS Score']);
        if (req.body['Executive Summary Score'] !== undefined) updateData.executive_summary_score = parseScore(req.body['Executive Summary Score']);
        if (req.body['Hobbies Languages Score'] !== undefined) updateData.hobbies_languages_score = parseScore(req.body['Hobbies Languages Score']);
        
        // Improved scores (post-improvement)
        if (req.body['Improved Global Rating'] !== undefined) updateData.improved_global_rating = parseScore(req.body['Improved Global Rating']);
        if (req.body['Improved Skills Score'] !== undefined) updateData.improved_skills_score = parseScore(req.body['Improved Skills Score']);
        if (req.body['Improved Experience Score'] !== undefined) updateData.improved_experience_score = parseScore(req.body['Improved Experience Score']);
        if (req.body['Improved Education Score'] !== undefined) updateData.improved_education_score = parseScore(req.body['Improved Education Score']);
        if (req.body['Improved ATS Score'] !== undefined) updateData.improved_ats_score = parseScore(req.body['Improved ATS Score']);
        if (req.body['Improved Executive Summary Score'] !== undefined) updateData.improved_executive_summary_score = parseScore(req.body['Improved Executive Summary Score']);
        if (req.body['Improved Hobbies Languages Score'] !== undefined) updateData.improved_hobbies_languages_score = parseScore(req.body['Improved Hobbies Languages Score']);
        
        // JSONB fields - ensure they are properly formatted for PostgreSQL
        if (req.body.Skills !== undefined) updateData.skills = stringifyIfNeeded(req.body.Skills);
        if (req.body.Industries !== undefined) updateData.industries = stringifyIfNeeded(req.body.Industries);
        if (req.body.Tools !== undefined) updateData.tools = stringifyIfNeeded(req.body.Tools);
        if (req.body['Soft Skills'] !== undefined) updateData.soft_skills = stringifyIfNeeded(req.body['Soft Skills']);
        if (req.body.Skills_cleaned !== undefined) updateData.skills_cleaned = stringifyIfNeeded(req.body.Skills_cleaned);
        if (req.body.Industries_cleaned !== undefined) updateData.industries_cleaned = stringifyIfNeeded(req.body.Industries_cleaned);
        if (req.body.Tools_cleaned !== undefined) updateData.tools_cleaned = stringifyIfNeeded(req.body.Tools_cleaned);
        if (req.body['Soft Skills_cleaned'] !== undefined) updateData.soft_skills_cleaned = stringifyIfNeeded(req.body['Soft Skills_cleaned']);
        if (req.body.Skills_esco !== undefined) updateData.skills_esco = stringifyIfNeeded(req.body.Skills_esco);
        if (req.body.Industries_esco !== undefined) updateData.industries_esco = stringifyIfNeeded(req.body.Industries_esco);
        if (req.body.Tools_esco !== undefined) updateData.tools_esco = stringifyIfNeeded(req.body.Tools_esco);
        if (req.body['Soft Skills_esco'] !== undefined) updateData.soft_skills_esco = stringifyIfNeeded(req.body['Soft Skills_esco']);
        
        // Improved tags (after LLM improvement)
        if (req.body['Improved Skills'] !== undefined) updateData.improved_skills = stringifyIfNeeded(req.body['Improved Skills']);
        if (req.body['Improved Industries'] !== undefined) updateData.improved_industries = stringifyIfNeeded(req.body['Improved Industries']);
        if (req.body['Improved Tools'] !== undefined) updateData.improved_tools = stringifyIfNeeded(req.body['Improved Tools']);
        if (req.body['Improved Soft Skills'] !== undefined) updateData.improved_soft_skills = stringifyIfNeeded(req.body['Improved Soft Skills']);
        
        if (req.body['Key Improvements'] !== undefined) {
            // Key Improvements can be a string or object
            const keyImprovements = req.body['Key Improvements'];
            updateData.key_improvements = typeof keyImprovements === 'string' ? keyImprovements : JSON.stringify(keyImprovements);
        }
        if (req.body['Improved Key Improvements'] !== undefined) {
            const improvedKeyImprovements = req.body['Improved Key Improvements'];
            updateData.improved_key_improvements = typeof improvedKeyImprovements === 'string' ? improvedKeyImprovements : JSON.stringify(improvedKeyImprovements);
        }
        if (req.body.Summary !== undefined) updateData.summary = req.body.Summary;
        if (req.body['Experience Years'] !== undefined) updateData.experience_years = req.body['Experience Years'];
        if (req.body['Education Level'] !== undefined) updateData.education_level = req.body['Education Level'];
        if (req.body.Certifications !== undefined) updateData.certifications = req.body.Certifications;
        if (req.body.Languages !== undefined) updateData.languages = req.body.Languages;
        if (req.body['Original Name'] !== undefined) updateData.original_name = req.body['Original Name'];
        if (req.body['Analysis Date'] !== undefined) updateData.analyzed_at = new Date(req.body['Analysis Date']);

        // Set analyzed_at if analysis data is being updated
        if (req.body.Skills || req.body.Industries || req.body.Tools || req.body['Soft Skills']) {
            updateData.analyzed_at = new Date();
            
            // Automatically calculate cleaned tags when raw tags are provided
            const rawTags = {
                skills: Array.isArray(req.body.Skills) ? req.body.Skills : [],
                industries: Array.isArray(req.body.Industries) ? req.body.Industries : [],
                tools: Array.isArray(req.body.Tools) ? req.body.Tools : [],
                softSkills: Array.isArray(req.body['Soft Skills']) ? req.body['Soft Skills'] : []
            };
            
            const { cleanedTags } = processAnalysisTags({ tags: rawTags });
            
            // Add cleaned tags to update data
            if (cleanedTags.skills.length > 0) {
                updateData.skills_cleaned = JSON.stringify(cleanedTags.skills);
            }
            if (cleanedTags.industries.length > 0) {
                updateData.industries_cleaned = JSON.stringify(cleanedTags.industries);
            }
            if (cleanedTags.tools.length > 0) {
                updateData.tools_cleaned = JSON.stringify(cleanedTags.tools);
            }
            if (cleanedTags.softSkills.length > 0) {
                updateData.soft_skills_cleaned = JSON.stringify(cleanedTags.softSkills);
            }
            
            safeLog('info', 'Auto-calculated cleaned tags', {
                resumeId: id,
                rawSkills: rawTags.skills.length,
                cleanedSkills: cleanedTags.skills.length,
                rawIndustries: rawTags.industries.length,
                cleanedIndustries: cleanedTags.industries.length
            });
        }

        // Only update if there are fields to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        safeLog('info', 'PUT /api/resumes/:id - updateData prepared', { 
            resumeId: id,
            fieldsToUpdate: Object.keys(updateData),
            hasGlobalRating: updateData.global_rating !== undefined,
            globalRatingMapped: updateData.global_rating
        });

        // Check if improved_text is being updated and has changed
        const isImprovedTextUpdate = updateData.improved_text !== undefined;
        let shouldCreateVersion = false;
        let changeReason = 'manual_edit';

        if (isImprovedTextUpdate) {
            // Determine change reason based on status or other indicators
            if (req.body.Status === 'Improved' || req.body['Last Improved']) {
                changeReason = 'initial_improvement';
            }
            
            // Check if the text has actually changed
            shouldCreateVersion = await hasImprovedTextChanged(id, updateData.improved_text);
            
            safeLog('info', 'Improved text update detected', {
                resumeId: id,
                shouldCreateVersion,
                changeReason,
                textLength: updateData.improved_text?.length || 0
            });
        }

        const updatedResume = await resumesService.updateResume(id, updateData);

        // Create a new version if improved text was changed
        if (shouldCreateVersion && updateData.improved_text) {
            try {
                const versionData = await createVersion({
                    resumeId: id,
                    improvedText: updateData.improved_text,
                    scores: {
                        improvedGlobalRating: updateData.improved_global_rating,
                        improvedSkillsScore: updateData.improved_skills_score,
                        improvedExperienceScore: updateData.improved_experience_score,
                        improvedEducationScore: updateData.improved_education_score,
                        improvedAtsScore: updateData.improved_ats_score,
                        improvedExecutiveSummaryScore: updateData.improved_executive_summary_score,
                        improvedHobbiesLanguagesScore: updateData.improved_hobbies_languages_score
                    },
                    tags: {
                        improvedSkills: updateData.improved_skills ? JSON.parse(updateData.improved_skills) : [],
                        improvedIndustries: updateData.improved_industries ? JSON.parse(updateData.improved_industries) : [],
                        improvedTools: updateData.improved_tools ? JSON.parse(updateData.improved_tools) : [],
                        improvedSoftSkills: updateData.improved_soft_skills ? JSON.parse(updateData.improved_soft_skills) : []
                    },
                    keyImprovements: updateData.improved_key_improvements,
                    userId: req.user?.id,
                    changeReason
                });
                
                // Update the current_version in the response
                updatedResume.current_version = versionData.versionNumber;
                
                safeLog('info', 'Resume version created', {
                    resumeId: id,
                    versionNumber: versionData.versionNumber
                });
            } catch (versionError) {
                // Log error but don't fail the update
                safeLog('error', 'Failed to create resume version', {
                    error: versionError.message,
                    resumeId: id
                });
            }
        }
        
        // Invalidate tags cache if tags were updated
        if (updateData.skills_cleaned || updateData.industries_cleaned || 
            updateData.tools_cleaned || updateData.soft_skills_cleaned) {
            invalidateTagsCache();
        }

        res.json(mapResumeToFrontend(updatedResume));
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        safeLog('error', 'Error updating resume', { error: error.message, resumeId: req.params.id });
        res.status(500).json({ error: 'Failed to update resume' });
    }
});

// DELETE /api/resumes/:id - Delete resume
router.delete('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify user has access to this resume (firm-based access control)
        const { hasAccess, error: accessError } = await checkResumeAccess(req, id);
        
        if (!hasAccess) {
            const statusCode = accessError === 'Resume not found' ? 404 : 403;
            return res.status(statusCode).json({ error: accessError });
        }
        
        await resumesService.deleteResume(id);
        
        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.RESUME_DELETED, {
            ...getRequestMetadata(req),
            resumeId: id,
            deletedBy: req.user?.id,
            action: 'RESUME_DELETED',
            message: 'Resume deleted'
        });
        
        safeLog('info', 'Resume deleted', { resumeId: id, userId: req.user?.id });
        res.json({ message: 'Resume deleted successfully' });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        safeLog('error', 'Error deleting resume', { error: error.message, resumeId: req.params.id });
        res.status(500).json({ error: 'Failed to delete resume' });
    }
});

export default router;
