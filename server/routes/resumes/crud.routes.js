/**
 * Resume Routes - CRUD Operations
 * GET /, GET /:id, PUT /:id, DELETE /:id
 */

import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { validateParams, validateBody, updateResumeSchema } from '../../utils/validation.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../../services/security.service.js';
import { analyzeResume, cleanupText } from '../../services/openai.service.js';
import { getLLMSettings, calculateWeightedGlobalRating } from '../../services/settings.service.js';
import { getAcceptedIndustriesString, getIndustryMappingString } from '../../services/industry.service.js';
import { DEFAULT_ANALYSIS_PROMPT, ANONYMIZATION_RULES_ANONYMOUS, ANONYMIZATION_RULES_NOMINATIVE } from '../../config/prompts.backend.js';
import { query } from '../../services/database.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import { getUserFirmId, isUserAdmin } from '../../utils/firmHelpers.js';
import { processAnalysisTags } from '../../utils/tagCleaner.js';
import { invalidateTagsCache } from '../tags.routes.js';
import { createVersion, hasImprovedTextChanged } from '../../services/resumeVersions.service.js';
import * as resumesService from '../../services/resumes.service.js';
import { 
    checkResumeAccess, 
    normalizeResumeUpdatePayload,
    parseScore, 
    stringifyIfNeeded, 
    mapResumeToFrontend
} from './helpers.js';

const router = express.Router();
function hasSuggestionContent(suggestions) {
    if (!suggestions || typeof suggestions !== 'object') return false;
    return Object.values(suggestions).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
}

function parseSuggestionsPayload(rawSuggestions) {
    if (!rawSuggestions) return {};
    if (typeof rawSuggestions === 'string') {
        try {
            return JSON.parse(rawSuggestions);
        } catch {
            return {};
        }
    }
    return rawSuggestions;
}

function stringifyJsonField(value, fallback = null) {
    if (value === undefined) return undefined;
    if (value === null) return fallback;
    return JSON.stringify(value);
}

function extractSummaryText(analysis) {
    const summary = analysis?.summary ?? analysis?.Summary;
    if (typeof summary === 'string') {
        return summary.trim() || null;
    }
    if (summary && typeof summary === 'object') {
        const highlights = Array.isArray(summary.profileHighlights) ? summary.profileHighlights.filter(Boolean).map(String) : [];
        if (highlights.length > 0) {
            return highlights.join(' ');
        }
    }
    return null;
}

function buildImprovedResumeUpdateData(improvedText, analysis) {
    const improvedTags = analysis?.tags || {};
    const summaryText = extractSummaryText(analysis);
    return {
        improved_text: improvedText,
        improved_global_rating: parseScore(analysis?.globalRating || analysis?.['Global Rating']) || 0,
        improved_skills_score: parseScore(analysis?.skillsRating || analysis?.['Skills']) || 0,
        improved_experience_score: parseScore(analysis?.experiencesRating || analysis?.['Experience']) || 0,
        improved_education_score: parseScore(analysis?.educationRating || analysis?.['Education']) || 0,
        improved_ats_score: parseScore(analysis?.atsOptimizationRating || analysis?.['ATS Compatibility']) || 0,
        improved_executive_summary_score: parseScore(analysis?.executiveSummaryRating || analysis?.['Executive Summary']) || 0,
        improved_hobbies_languages_score: parseScore(analysis?.hobbiesLanguagesRating || analysis?.['Hobbies Languages']) || 0,
        improved_skills: JSON.stringify(improvedTags.skills || []),
        improved_industries: JSON.stringify(improvedTags.industries || []),
        improved_tools: JSON.stringify(improvedTags.tools || []),
        improved_soft_skills: JSON.stringify(improvedTags.softSkills || []),
        improved_key_improvements: JSON.stringify(analysis?.suggestions || {}),
        improvement_suggestions: JSON.stringify(analysis?.suggestions || {}),
        analysis_details: analysis,
        summary: summaryText ?? undefined,
        title: analysis?.title || analysis?.Title || undefined,
        experience_years: analysis?.experienceYears ?? analysis?.experience_years,
        education_level: analysis?.educationLevel ?? analysis?.education_level,
        certifications: stringifyJsonField(analysis?.certifications),
        languages: stringifyJsonField(analysis?.languages),
        status: 'improved',
        improvement_date: new Date()
    };
}

async function updateResumeVersionWithPostAnalysis(resumeId, versionNumber, analysis) {
    const improvedTags = analysis?.tags || {};
    await query(
        `UPDATE resume_versions SET
            improved_global_rating = $1,
            improved_skills_score = $2,
            improved_experience_score = $3,
            improved_education_score = $4,
            improved_ats_score = $5,
            improved_executive_summary_score = $6,
            improved_hobbies_languages_score = $7,
            improved_skills = $8,
            improved_industries = $9,
            improved_tools = $10,
            improved_soft_skills = $11,
            improved_key_improvements = $12
         WHERE resume_id = $13 AND version_number = $14`,
        [
            parseScore(analysis?.globalRating || analysis?.['Global Rating']) || 0,
            parseScore(analysis?.skillsRating || analysis?.['Skills']) || 0,
            parseScore(analysis?.experiencesRating || analysis?.['Experience']) || 0,
            parseScore(analysis?.educationRating || analysis?.['Education']) || 0,
            parseScore(analysis?.atsOptimizationRating || analysis?.['ATS Compatibility']) || 0,
            parseScore(analysis?.executiveSummaryRating || analysis?.['Executive Summary']) || 0,
            parseScore(analysis?.hobbiesLanguagesRating || analysis?.['Hobbies Languages']) || 0,
            JSON.stringify(improvedTags.skills || []),
            JSON.stringify(improvedTags.industries || []),
            JSON.stringify(improvedTags.tools || []),
            JSON.stringify(improvedTags.softSkills || []),
            JSON.stringify(analysis?.suggestions || {}),
            resumeId,
            versionNumber
        ]
    );
}
async function persistDeferredPostImprovementAnalysis({ resumeId, improvedText, fileName, userMetadata, currentVersion }) {
    const settings = await getLLMSettings();
    const model = settings.llmModel;
    const cvMode = settings.cvMode || 'nominative';
    let analysisPrompt = settings['Analysis Prompt'] || DEFAULT_ANALYSIS_PROMPT;
    const acceptedIndustries = await getAcceptedIndustriesString();
    const industryMapping = await getIndustryMappingString();
    analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
    analysisPrompt = analysisPrompt.replace('{INDUSTRY_MAPPING}', industryMapping);

    let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
    anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileName || 'Non disponible');
    analysisPrompt = analysisPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

    let improvedAnalysis = await analyzeResume(
        cleanupText(improvedText),
        model,
        analysisPrompt,
        userMetadata,
        true,
        fileName || null
    );
    improvedAnalysis = await calculateWeightedGlobalRating(improvedAnalysis, settings);

    const updatedResume = await resumesService.updateResume(resumeId, buildImprovedResumeUpdateData(improvedText, improvedAnalysis));

    if (currentVersion) {
        await updateResumeVersionWithPostAnalysis(resumeId, currentVersion, improvedAnalysis);
    }

    safeLog('info', 'Deferred post-improvement analysis saved from PUT flow', {
        resumeId,
        currentVersion,
        hasSuggestions: hasSuggestionContent(improvedAnalysis.suggestions),
        suggestionsKeys: Object.keys(improvedAnalysis.suggestions || {})
    });

    return {
        updatedResume,
        improvedAnalysis
    };
}

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
        const isAdmin = isUserAdmin(req);

        // Fetch resume with file data
        const resume = await resumesService.getResumeFileForDownload(id);

        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Verify user has access to this resume (firm-based access control using firm_id)
        if (!isAdmin) {
            const userFirmId = await getUserFirmId(req);
            if (!userFirmId || resume.firm_id !== userFirmId) {
                safeLog('warn', 'Access denied: user tried to download resume from different firm', {
                    userId: req.user?.id,
                    userFirmId,
                    resumeFirmId: resume.firm_id,
                    resumeId: id
                });
                return res.status(403).json({ error: 'Access denied' });
            }
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
        
        const normalizedBody = normalizeResumeUpdatePayload(req.body);

        safeLog('info', 'PUT /api/resumes/:id called', { 
            resumeId: id, 
            bodyKeys: Object.keys(req.body),
            hasImprovedGlobalRating: normalizedBody.improvedGlobalRating !== undefined,
            improvedGlobalRatingValue: normalizedBody.improvedGlobalRating,
            improvedSkillsScoreValue: normalizedBody.improvedSkillsScore,
            improvedExperienceScoreValue: normalizedBody.improvedExperienceScore
        });
        const updateData = {};

        if (normalizedBody.name !== undefined) updateData.name = normalizedBody.name;
        if (normalizedBody.title !== undefined) updateData.title = normalizedBody.title;
        if (normalizedBody.status !== undefined) updateData.status = String(normalizedBody.status).toLowerCase();
        if (normalizedBody.originalText !== undefined) updateData.original_text = normalizedBody.originalText;
        if (normalizedBody.improvedText !== undefined) updateData.improved_text = normalizedBody.improvedText;

        if (normalizedBody.globalRating !== undefined) updateData.global_rating = parseScore(normalizedBody.globalRating);
        if (normalizedBody.skillsScore !== undefined) updateData.skills_score = parseScore(normalizedBody.skillsScore);
        if (normalizedBody.experienceScore !== undefined) updateData.experience_score = parseScore(normalizedBody.experienceScore);
        if (normalizedBody.educationScore !== undefined) updateData.education_score = parseScore(normalizedBody.educationScore);
        if (normalizedBody.atsScore !== undefined) updateData.ats_score = parseScore(normalizedBody.atsScore);
        if (normalizedBody.executiveSummaryScore !== undefined) updateData.executive_summary_score = parseScore(normalizedBody.executiveSummaryScore);
        if (normalizedBody.hobbiesLanguagesScore !== undefined) updateData.hobbies_languages_score = parseScore(normalizedBody.hobbiesLanguagesScore);

        if (normalizedBody.improvedGlobalRating !== undefined) updateData.improved_global_rating = parseScore(normalizedBody.improvedGlobalRating);
        if (normalizedBody.improvedSkillsScore !== undefined) updateData.improved_skills_score = parseScore(normalizedBody.improvedSkillsScore);
        if (normalizedBody.improvedExperienceScore !== undefined) updateData.improved_experience_score = parseScore(normalizedBody.improvedExperienceScore);
        if (normalizedBody.improvedEducationScore !== undefined) updateData.improved_education_score = parseScore(normalizedBody.improvedEducationScore);
        if (normalizedBody.improvedAtsScore !== undefined) updateData.improved_ats_score = parseScore(normalizedBody.improvedAtsScore);
        if (normalizedBody.improvedExecutiveSummaryScore !== undefined) updateData.improved_executive_summary_score = parseScore(normalizedBody.improvedExecutiveSummaryScore);
        if (normalizedBody.improvedHobbiesLanguagesScore !== undefined) updateData.improved_hobbies_languages_score = parseScore(normalizedBody.improvedHobbiesLanguagesScore);

        if (normalizedBody.skills !== undefined) updateData.skills = stringifyIfNeeded(normalizedBody.skills);
        if (normalizedBody.industries !== undefined) updateData.industries = stringifyIfNeeded(normalizedBody.industries);
        if (normalizedBody.tools !== undefined) updateData.tools = stringifyIfNeeded(normalizedBody.tools);
        if (normalizedBody.softSkills !== undefined) updateData.soft_skills = stringifyIfNeeded(normalizedBody.softSkills);
        if (normalizedBody.skillsCleaned !== undefined) updateData.skills_cleaned = stringifyIfNeeded(normalizedBody.skillsCleaned);
        if (normalizedBody.industriesCleaned !== undefined) updateData.industries_cleaned = stringifyIfNeeded(normalizedBody.industriesCleaned);
        if (normalizedBody.toolsCleaned !== undefined) updateData.tools_cleaned = stringifyIfNeeded(normalizedBody.toolsCleaned);
        if (normalizedBody.softSkillsCleaned !== undefined) updateData.soft_skills_cleaned = stringifyIfNeeded(normalizedBody.softSkillsCleaned);
        if (normalizedBody.skillsEsco !== undefined) updateData.skills_esco = stringifyIfNeeded(normalizedBody.skillsEsco);
        if (normalizedBody.industriesEsco !== undefined) updateData.industries_esco = stringifyIfNeeded(normalizedBody.industriesEsco);
        if (normalizedBody.toolsEsco !== undefined) updateData.tools_esco = stringifyIfNeeded(normalizedBody.toolsEsco);
        if (normalizedBody.softSkillsEsco !== undefined) updateData.soft_skills_esco = stringifyIfNeeded(normalizedBody.softSkillsEsco);

        if (normalizedBody.improvedSkills !== undefined) updateData.improved_skills = stringifyIfNeeded(normalizedBody.improvedSkills);
        if (normalizedBody.improvedIndustries !== undefined) updateData.improved_industries = stringifyIfNeeded(normalizedBody.improvedIndustries);
        if (normalizedBody.improvedTools !== undefined) updateData.improved_tools = stringifyIfNeeded(normalizedBody.improvedTools);
        if (normalizedBody.improvedSoftSkills !== undefined) updateData.improved_soft_skills = stringifyIfNeeded(normalizedBody.improvedSoftSkills);

        if (normalizedBody.keyImprovements !== undefined) {
            updateData.key_improvements = typeof normalizedBody.keyImprovements === 'string'
                ? normalizedBody.keyImprovements
                : JSON.stringify(normalizedBody.keyImprovements);
        }
        if (normalizedBody.improvedKeyImprovements !== undefined) {
            updateData.improved_key_improvements = typeof normalizedBody.improvedKeyImprovements === 'string'
                ? normalizedBody.improvedKeyImprovements
                : JSON.stringify(normalizedBody.improvedKeyImprovements);
            updateData.improvement_suggestions = updateData.improved_key_improvements;
        }
        if (normalizedBody.summary !== undefined) updateData.summary = normalizedBody.summary;
        if (normalizedBody.experienceYears !== undefined) updateData.experience_years = normalizedBody.experienceYears;
        if (normalizedBody.educationLevel !== undefined) updateData.education_level = normalizedBody.educationLevel;
        if (normalizedBody.certifications !== undefined) updateData.certifications = normalizedBody.certifications;
        if (normalizedBody.languages !== undefined) updateData.languages = normalizedBody.languages;
        if (normalizedBody.originalName !== undefined) updateData.original_name = normalizedBody.originalName;
        if (normalizedBody.analysisDate !== undefined) updateData.analyzed_at = new Date(normalizedBody.analysisDate);
        if (normalizedBody.lastImproved !== undefined) updateData.improvement_date = new Date(normalizedBody.lastImproved);

        if (normalizedBody.skills || normalizedBody.industries || normalizedBody.tools || normalizedBody.softSkills) {
            updateData.analyzed_at = new Date();

            const rawTags = {
                skills: Array.isArray(normalizedBody.skills) ? normalizedBody.skills : [],
                industries: Array.isArray(normalizedBody.industries) ? normalizedBody.industries : [],
                tools: Array.isArray(normalizedBody.tools) ? normalizedBody.tools : [],
                softSkills: Array.isArray(normalizedBody.softSkills) ? normalizedBody.softSkills : []
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
            if (normalizedBody.status === 'Improved' || normalizedBody.status === 'improved' || normalizedBody.lastImproved) {
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

        let updatedResume = await resumesService.updateResume(id, updateData);

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

        const improvedSuggestionsPayload = parseSuggestionsPayload(updateData.improved_key_improvements);
        const hasImmediatePostAnalysisPayload = Boolean(
            updateData.analysis_details ||
            updateData.summary ||
            updateData.experience_years !== undefined ||
            updateData.education_level !== undefined ||
            updateData.certifications !== undefined ||
            updateData.languages !== undefined
        );
        const shouldRunDeferredPostAnalysis = Boolean(
            changeReason === 'initial_improvement' &&
            updateData.improved_text &&
            (!hasSuggestionContent(improvedSuggestionsPayload) || !hasImmediatePostAnalysisPayload)
        );

        safeLog('info', 'Deferred post-improvement analysis decision', {
            resumeId: id,
            changeReason,
            hasImprovedText: !!updateData.improved_text,
            hasImmediateSuggestions: hasSuggestionContent(improvedSuggestionsPayload),
            hasImmediatePostAnalysisPayload,
            shouldRunDeferredPostAnalysis
        });

        if (shouldRunDeferredPostAnalysis) {
            const deferredResult = await persistDeferredPostImprovementAnalysis({
                resumeId: id,
                improvedText: updateData.improved_text,
                fileName: updatedResume.file_name || updatedResume.name || null,
                userMetadata: getRequestMetadata(req),
                currentVersion: updatedResume.current_version || null
            });
            updatedResume = deferredResult.updatedResume;
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






