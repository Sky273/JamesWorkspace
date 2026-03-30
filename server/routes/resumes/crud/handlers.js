import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../../../services/security.service.js';
import { safeLog } from '../../../utils/logger.backend.js';
import { getUserFirmId, isUserAdmin } from '../../../utils/firmHelpers.js';
import { processAnalysisTags } from '../../../utils/tagCleaner.js';
import { invalidateTagsCache } from '../../tags.routes.js';
import { createVersion, hasImprovedTextChanged } from '../../../services/resumeVersions.service.js';
import * as resumesService from '../../../services/resumes.service.js';
import {
    checkResumeAccess,
    normalizeResumeUpdatePayload,
    parseScore,
    stringifyIfNeeded,
    mapResumeToFrontend
} from '../helpers.js';
import {
    hasSuggestionContent,
    parseSuggestionsPayload,
    persistDeferredPostImprovementAnalysis
} from './improvementHelpers.js';

function createListResumesHandler() {
    return async (req, res) => {
        try {
            const isAdmin = req.user?.role === 'admin';
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const offset = (page - 1) * limit;
            const { search, status, tags: _tags, dealId } = req.query;

            const conditions = [];
            const params = [];
            let paramIndex = 1;

            if (!isAdmin) {
                const userFirmId = await getUserFirmId(req);
                safeLog('info', 'Resumes GET - user firm filter', { userFirmId, userId: req.user?.id });
                if (userFirmId) {
                    conditions.push(`firm_id = $${paramIndex}`);
                    params.push(userFirmId);
                    paramIndex++;
                } else {
                    safeLog('warn', 'User has no valid firm_id, returning empty results', { userId: req.user?.id });
                    return res.json({
                        data: [],
                        pagination: { page: 1, limit, totalPages: 0, totalCount: 0, hasMore: false }
                    });
                }
            }

            if (status && status !== 'all') {
                conditions.push(`status = $${paramIndex}`);
                params.push(status.toLowerCase());
                paramIndex++;
            }

            if (search) {
                const escaped = search.toLowerCase().replace(/[%_\\]/g, '\\$&');
                conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(title) LIKE $${paramIndex} OR LOWER(file_name) LIKE $${paramIndex})`);
                params.push(`%${escaped}%`);
                paramIndex++;
            }

            const totalCount = await resumesService.countResumes({
                conditions, params, dealId, dealParamIndex: paramIndex
            });

            const resumes = await resumesService.listResumes({
                conditions, params, dealId, dealParamIndex: paramIndex, limit, offset
            });

            const hasMore = resumes.length > limit;
            if (hasMore) {
                resumes.pop();
            }

            const processedRecords = resumes.map(mapResumeToFrontend);
            return res.json({
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
            });
        } catch (error) {
            safeLog('error', 'Error fetching resumes', { error: error.message });
            return res.status(500).json({ error: 'Failed to fetch resumes' });
        }
    };
}

function createDownloadResumeHandler() {
    return async (req, res) => {
        try {
            const { id } = req.params;
            const isAdmin = isUserAdmin(req);
            const resume = await resumesService.getResumeFileForDownload(id);

            if (!resume) {
                return res.status(404).json({ error: 'Resume not found' });
            }

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

            if (!resume.resume_file_data) {
                return res.status(404).json({ error: 'File not found in database' });
            }

            res.setHeader('Content-Type', resume.resume_file_type || 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resume.file_name)}"`);
            res.setHeader('Content-Length', resume.resume_file_size || resume.resume_file_data.length);
            return res.send(resume.resume_file_data);
        } catch (error) {
            safeLog('error', 'Error downloading resume file', { id: req.params.id, error: error.message });
            return res.status(500).json({ error: 'Failed to download file' });
        }
    };
}

function createGetResumeHandler() {
    return async (req, res) => {
        try {
            const { id } = req.params;
            const resume = await resumesService.getResumeById(id);
            if (!resume) {
                return res.status(404).json({ error: 'Resume not found' });
            }

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

            return res.json(mapResumeToFrontend(resume));
        } catch (error) {
            if (error.statusCode === 404) {
                return res.status(404).json({ error: 'Resume not found' });
            }
            safeLog('error', 'Error fetching resume', { error: error.message, resumeId: req.params.id });
            return res.status(500).json({ error: 'Failed to fetch resume' });
        }
    };
}

function createUpdateResumeHandler() {
    return async (req, res) => {
        try {
            const { id } = req.params;
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
                if (cleanedTags.skills.length > 0) updateData.skills_cleaned = JSON.stringify(cleanedTags.skills);
                if (cleanedTags.industries.length > 0) updateData.industries_cleaned = JSON.stringify(cleanedTags.industries);
                if (cleanedTags.tools.length > 0) updateData.tools_cleaned = JSON.stringify(cleanedTags.tools);
                if (cleanedTags.softSkills.length > 0) updateData.soft_skills_cleaned = JSON.stringify(cleanedTags.softSkills);
                safeLog('info', 'Auto-calculated cleaned tags', {
                    resumeId: id,
                    rawSkills: rawTags.skills.length,
                    cleanedSkills: cleanedTags.skills.length,
                    rawIndustries: rawTags.industries.length,
                    cleanedIndustries: cleanedTags.industries.length
                });
            }

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            safeLog('info', 'PUT /api/resumes/:id - updateData prepared', {
                resumeId: id,
                fieldsToUpdate: Object.keys(updateData),
                hasGlobalRating: updateData.global_rating !== undefined,
                globalRatingMapped: updateData.global_rating
            });

            const isImprovedTextUpdate = updateData.improved_text !== undefined;
            let shouldCreateVersion = false;
            let changeReason = 'manual_edit';

            if (isImprovedTextUpdate) {
                if (normalizedBody.status === 'Improved' || normalizedBody.status === 'improved' || normalizedBody.lastImproved) {
                    changeReason = 'initial_improvement';
                }
                shouldCreateVersion = await hasImprovedTextChanged(id, updateData.improved_text);
                safeLog('info', 'Improved text update detected', {
                    resumeId: id,
                    shouldCreateVersion,
                    changeReason,
                    textLength: updateData.improved_text?.length || 0
                });
            }

            let updatedResume = await resumesService.updateResume(id, updateData);

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
                    updatedResume.current_version = versionData.versionNumber;
                    safeLog('info', 'Resume version created', { resumeId: id, versionNumber: versionData.versionNumber });
                } catch (versionError) {
                    safeLog('error', 'Failed to create resume version', { error: versionError.message, resumeId: id });
                }
            }

            if (updateData.skills_cleaned || updateData.industries_cleaned || updateData.tools_cleaned || updateData.soft_skills_cleaned) {
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

            return res.json(mapResumeToFrontend(updatedResume));
        } catch (error) {
            if (error.statusCode === 404) {
                return res.status(404).json({ error: 'Resume not found' });
            }
            safeLog('error', 'Error updating resume', { error: error.message, resumeId: req.params.id });
            return res.status(500).json({ error: 'Failed to update resume' });
        }
    };
}

function createDeleteResumeHandler() {
    return async (req, res) => {
        try {
            const { id } = req.params;
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
            return res.json({ message: 'Resume deleted successfully' });
        } catch (error) {
            if (error.statusCode === 404) {
                return res.status(404).json({ error: 'Resume not found' });
            }
            safeLog('error', 'Error deleting resume', { error: error.message, resumeId: req.params.id });
            return res.status(500).json({ error: 'Failed to delete resume' });
        }
    };
}

export {
    createDeleteResumeHandler,
    createDownloadResumeHandler,
    createGetResumeHandler,
    createListResumesHandler,
    createUpdateResumeHandler
};
