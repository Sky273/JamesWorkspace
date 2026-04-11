import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../../../services/security.service.js';
import { safeLog } from '../../../utils/logger.backend.js';
import { getUserFirmId, isUserAdmin } from '../../../utils/firmHelpers.js';
import { invalidateTagsCache } from '../../tags.routes.js';
import { createVersion, hasImprovedTextChanged } from '../../../services/resumeVersions.service.js';
import * as resumesService from '../../../services/resumes.service.js';
import {
    checkResumeAccess,
    normalizeResumeUpdatePayload,
    mapResumeToFrontend
} from '../helpers.js';
import {
    persistDeferredPostImprovementAnalysis
} from './improvementHelpers.js';
import { setSafeFileResponseHeaders } from '../../../utils/fileResponseSecurity.js';
import { persistResumeSkillEvidence } from '../../../services/skillEvidence.service.js';
import {
    buildDeferredPostAnalysisDecision,
    buildResumeUpdateData,
    buildVersionPayload,
    getCleanedTagsLogContext,
    getPreparedUpdateLogContext,
    getUpdateRequestLogContext,
    resolveResumeChangeReason,
    shouldInvalidateResumeTagsCache
} from './updateResumeFlow.js';

function createListResumesHandler() {
    return async (req, res) => {
        try {
            const isAdmin = req.user?.role === 'admin';
            const parsedPage = Number.parseInt(req.query.page, 10);
            const parsedLimit = Number.parseInt(req.query.limit, 10);
            const page = Number.isNaN(parsedPage) ? 1 : parsedPage;
            const limit = Number.isNaN(parsedLimit) ? 50 : parsedLimit;

            if (page < 1 || limit < 1 || limit > 100) {
                return res.status(400).json({ error: 'Invalid pagination parameters' });
            }

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
                    safeLog('warn', 'User has no valid firm_id, denying resume list access', { userId: req.user?.id });
                    return res.status(403).json({ error: 'User has no valid firm association' });
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

            setSafeFileResponseHeaders(res, {
                contentType: resume.resume_file_type,
                filename: resume.file_name,
                contentLength: resume.resume_file_size || resume.resume_file_data.length
            });
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
                ...getUpdateRequestLogContext(normalizedBody, req.body)
            });

            const { updateData, cleanedTagsMetadata } = buildResumeUpdateData(normalizedBody);
            const cleanedTagsLogContext = getCleanedTagsLogContext(cleanedTagsMetadata);
            if (cleanedTagsLogContext) {
                safeLog('info', 'Auto-calculated cleaned tags', {
                    resumeId: id,
                    ...cleanedTagsLogContext
                });
            }

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            safeLog('info', 'PUT /api/resumes/:id - updateData prepared', {
                resumeId: id,
                ...getPreparedUpdateLogContext(updateData)
            });

            const isImprovedTextUpdate = updateData.improved_text !== undefined;
            let shouldCreateVersion = false;
            let changeReason = resolveResumeChangeReason(normalizedBody, updateData);

            if (isImprovedTextUpdate) {
                shouldCreateVersion = await hasImprovedTextChanged(id, updateData.improved_text);
                safeLog('info', 'Improved text update detected', {
                    resumeId: id,
                    shouldCreateVersion,
                    changeReason,
                    textLength: updateData.improved_text?.length || 0
                });
            }

            let updatedResume = await resumesService.updateResume(id, updateData);

            if (updateData.analysis_details) {
                const analysisPhase = (
                    updateData.improved_text !== undefined
                    || updateData.improvement_date !== undefined
                    || updateData.status === 'improved'
                    || updateData.improved_skills !== undefined
                    || updateData.improved_tools !== undefined
                    || updateData.improved_soft_skills !== undefined
                ) ? 'improved' : 'initial';

                await persistResumeSkillEvidence({
                    candidateId: id,
                    analysis: updateData.analysis_details,
                    phase: analysisPhase
                });
            }

            if (shouldCreateVersion && updateData.improved_text) {
                try {
                    const versionData = await createVersion(buildVersionPayload({
                        resumeId: id,
                        updateData,
                        userId: req.user?.id,
                        changeReason
                    }));
                    updatedResume.current_version = versionData.versionNumber;
                    safeLog('info', 'Resume version created', { resumeId: id, versionNumber: versionData.versionNumber });
                } catch (versionError) {
                    safeLog('error', 'Failed to create resume version', { error: versionError.message, resumeId: id });
                }
            }

            if (shouldInvalidateResumeTagsCache(updateData)) {
                await invalidateTagsCache();
            }

            const deferredPostAnalysisDecision = buildDeferredPostAnalysisDecision(changeReason, updateData);

            safeLog('info', 'Deferred post-improvement analysis decision', {
                resumeId: id,
                changeReason,
                hasImprovedText: !!updateData.improved_text,
                ...deferredPostAnalysisDecision
            });

            if (deferredPostAnalysisDecision.shouldRunDeferredPostAnalysis) {
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
