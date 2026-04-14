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
    extractTextFromWordBuffer,
    convertWordBufferToPdfBuffer,
    hasSofficeCli,
    DOCX_MIME_TYPE,
    DOC_MIME_TYPE
} from '../../../services/wordTextExtraction.service.js';
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

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderWordTextPreviewDocument({ title, text }) {
    const safeTitle = escapeHtml(title || 'Document source');
    const paragraphs = String(text || '')
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
        .join('\n');

    return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f7fb;
        --surface: #ffffff;
        --text: #142033;
        --muted: #66758c;
        --border: #d8e1ef;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px;
        background: linear-gradient(180deg, #f7f9fc 0%, #eef3fa 100%);
        color: var(--text);
        font: 15px/1.7 "Segoe UI", Arial, sans-serif;
      }
      main {
        max-width: 880px;
        margin: 0 auto;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 32px;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
      }
      header {
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border);
      }
      h1 {
        margin: 0;
        font-size: 24px;
        line-height: 1.2;
      }
      p {
        margin: 0 0 16px;
        white-space: normal;
      }
      .empty {
        color: var(--muted);
        font-style: italic;
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${safeTitle}</h1>
      </header>
      ${paragraphs || '<p class="empty">Aucun contenu prévisualisable disponible pour ce document.</p>'}
    </main>
  </body>
</html>`;
}

async function buildResumePreviewPayload(resume) {
    const mimeType = resume.resume_file_type || 'application/octet-stream';

    if (mimeType === 'application/pdf') {
        return {
            kind: 'binary',
            contentType: mimeType,
            body: resume.resume_file_data,
            contentLength: resume.resume_file_size || resume.resume_file_data.length
        };
    }

    if (mimeType === DOCX_MIME_TYPE || mimeType === DOC_MIME_TYPE) {
        if (await hasSofficeCli()) {
            const pdfBuffer = await convertWordBufferToPdfBuffer(resume.resume_file_data, {
                fileName: resume.file_name || (mimeType === DOC_MIME_TYPE ? 'resume.doc' : 'resume.docx'),
                mimeType
            });

            return {
                kind: 'binary',
                contentType: 'application/pdf',
                body: pdfBuffer,
                contentLength: pdfBuffer.length
            };
        }

        if (mimeType === DOC_MIME_TYPE) {
            const extraction = await extractTextFromWordBuffer(resume.resume_file_data, {
                fileName: resume.file_name || 'resume.doc',
                mimeType,
                minTextLength: 1
            });

            return {
                kind: 'html',
                body: renderWordTextPreviewDocument({
                    title: resume.file_name || 'Document source',
                    text: extraction.text
                })
            };
        }

        const mammoth = await import('mammoth');
        const result = await mammoth.convertToHtml({
            buffer: resume.resume_file_data
        });

        return {
            kind: 'html',
            body: `<!doctype html><html lang="fr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(resume.file_name || 'Document source')}</title></head><body>${result.value || '<p>Aucun contenu prévisualisable disponible pour ce document.</p>'}</body></html>`
        };
    }

    if (mimeType === DOC_MIME_TYPE) {
        const extraction = await extractTextFromWordBuffer(resume.resume_file_data, {
            fileName: resume.file_name || 'resume.doc',
            mimeType,
            minTextLength: 1
        });

        return {
            kind: 'html',
            body: renderWordTextPreviewDocument({
                title: resume.file_name || 'Document source',
                text: extraction.text
            })
        };
    }

    return {
        kind: 'html',
        body: renderWordTextPreviewDocument({
            title: resume.file_name || 'Document source',
            text: ''
        })
    };
}

async function loadAccessibleResumeFile(req, id) {
    const isAdmin = isUserAdmin(req);
    const resume = await resumesService.getResumeFileForDownload(id);

    if (!resume) {
        return { error: 'Resume not found', statusCode: 404, resume: null };
    }

    if (!isAdmin) {
        const userFirmId = await getUserFirmId(req);
        if (!userFirmId || resume.firm_id !== userFirmId) {
            safeLog('warn', 'Access denied: user tried to access resume file from different firm', {
                userId: req.user?.id,
                userFirmId,
                resumeFirmId: resume.firm_id,
                resumeId: id
            });
            return { error: 'Access denied', statusCode: 403, resume };
        }
    }

    if (!resume.resume_file_data) {
        return { error: 'File not found in database', statusCode: 404, resume };
    }

    return { error: null, statusCode: 200, resume };
}

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
            const { resume, error, statusCode } = await loadAccessibleResumeFile(req, id);
            if (error) {
                return res.status(statusCode).json({ error });
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

function createPreviewResumeHandler() {
    return async (req, res) => {
        try {
            const { id } = req.params;
            const { resume, error, statusCode } = await loadAccessibleResumeFile(req, id);
            if (error) {
                return res.status(statusCode).json({ error });
            }

            const preview = await buildResumePreviewPayload(resume);

            if (preview.kind === 'binary') {
                setSafeFileResponseHeaders(res, {
                    contentType: preview.contentType,
                    filename: resume.file_name,
                    contentLength: preview.contentLength,
                    inline: true
                });
                return res.send(preview.body);
            }

            res.set({
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'private, no-store, max-age=0',
                'X-Content-Type-Options': 'nosniff',
                'Content-Security-Policy': "default-src 'none'; img-src data: blob: https:; style-src 'unsafe-inline'; font-src data: https:;"
            });
            return res.send(preview.body);
        } catch (error) {
            safeLog('error', 'Error previewing resume file', { id: req.params.id, error: error.message });
            return res.status(500).json({ error: 'Failed to preview file' });
        }
    };
}

function createGetResumeHandler() {
    return async (req, res) => {
        try {
            const { id } = req.params;
            // Resume detail pages are edited inline and must always reflect the latest persisted value.
            const bypassCache = true;
            const resume = await resumesService.getResumeById(id, { bypassCache });
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
            const { hasAccess, error: accessError } = await checkResumeAccess(req, id, { bypassCache: true });
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
            if (error.code === 'INSUFFICIENT_CREDITS') {
                return res.status(402).json({
                    error: 'Insufficient credits for this AI action',
                    details: error.details
                });
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
            const { hasAccess, error: accessError } = await checkResumeAccess(req, id, { bypassCache: true });
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
    createPreviewResumeHandler,
    createUpdateResumeHandler
};
