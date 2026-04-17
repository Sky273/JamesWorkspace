import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';
import { getPdfServerAuthHeaders } from '../../utils/pdfServerAuth.js';
import { getBatchExportPdfTimeoutMs } from '../../utils/pdfServiceTimeouts.js';
import { buildFirmLogoMarkup, replaceExportTemplatePlaceholders } from '../../utils/exportTemplatePlaceholders.js';
import { removeSuggestionMarkers } from './helpers.js';

function templateUsesLogoPlaceholder(template = {}) {
    return /-logo-/i.test(template?.template_content || '')
        || /-logo-/i.test(template?.header_content || '')
        || /-logo-/i.test(template?.footer_content || '');
}

function buildCandidateTrigram(candidateName, existingTrigram = '') {
    return existingTrigram || candidateName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
}

export async function loadExportSourceData(item) {
    const sourceType = item.source_type || 'resume';

    if (sourceType === 'adaptation' && item.adaptation_id) {
        const adaptResult = await query(
            'SELECT adapted_text, candidate_name, adapted_title, mission_title, firm_id FROM resume_adaptations WHERE id = $1',
            [item.adaptation_id]
        );
        if (adaptResult.rows.length === 0) {
            return { success: false, error: 'Adaptation not found', sourceType };
        }

        const adaptation = adaptResult.rows[0];
        const content = removeSuggestionMarkers(adaptation.adapted_text || '');
        if (!content || content.trim().length === 0) {
            return { success: false, error: 'Adaptation has no content', sourceType };
        }

        const candidateName = adaptation.candidate_name || 'Candidat';
        return {
            success: true,
            sourceType,
            content,
            candidateName,
            candidateTitle: adaptation.adapted_title || '',
            firmId: adaptation.firm_id || null,
            trigram: buildCandidateTrigram(candidateName)
        };
    }

    const resumeResult = await query('SELECT * FROM resumes WHERE id = $1', [item.resume_id]);
    if (resumeResult.rows.length === 0) {
        return { success: false, error: 'Resume not found in database', sourceType };
    }

    const resume = resumeResult.rows[0];
    const content = removeSuggestionMarkers(resume.improved_text || resume.original_text || '');
    if (!content || content.trim().length === 0) {
        return { success: false, error: 'Resume has no content', sourceType };
    }

    const candidateName = resume.name || 'Candidat';
    return {
        success: true,
        sourceType,
        content,
        candidateName,
        candidateTitle: resume.title || '',
        firmId: resume.firm_id || null,
        trigram: buildCandidateTrigram(candidateName, resume.trigram)
    };
}

export async function resolveFirmLogoMarkup({ firmId, template, firmLogoMarkupCache }) {
    if (!firmId || !templateUsesLogoPlaceholder(template)) {
        return '';
    }

    if (!firmLogoMarkupCache.has(firmId)) {
        const firmResult = await query(
            'SELECT id, logo_url, logo_data, logo_mime_type FROM firms WHERE id = $1',
            [firmId]
        );
        firmLogoMarkupCache.set(firmId, buildFirmLogoMarkup(firmResult.rows[0] || null));
    }

    return firmLogoMarkupCache.get(firmId) || '';
}

export function buildProcessedTemplateSections(template, { candidateName, candidateTitle, content, logoMarkup }) {
    let processedBody = replaceExportTemplatePlaceholders(template.template_content, {
        name: candidateName,
        title: candidateTitle,
        logoMarkup
    });
    processedBody = processedBody.replace(/-content-/g, content);

    const processedHeader = replaceExportTemplatePlaceholders(template.header_content, {
        name: candidateName,
        title: candidateTitle,
        logoMarkup
    });

    const processedFooter = replaceExportTemplatePlaceholders(template.footer_content, {
        name: candidateName,
        title: candidateTitle,
        logoMarkup
    });

    return {
        processedBody,
        processedHeader,
        processedFooter
    };
}

export async function generateDocumentWithRetry({
    pdfServerUrl,
    template,
    jobId,
    processedBody,
    processedHeader,
    processedFooter,
    candidateName,
    format,
    diagnostics = {}
}) {
    const endpoint = format === 'pdf' ? '/generate-pdf' : '/generate-docx';
    const fileExtension = format === 'pdf' ? 'pdf' : format;
    const maxRetries = 3;
    const requestTimeoutMs = getBatchExportPdfTimeoutMs();
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const headers = getPdfServerAuthHeaders({ 'Content-Type': 'application/json' });
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort(new Error(`PDF server timeout after ${requestTimeoutMs}ms`));
            }, requestTimeoutMs);
            const response = await fetch(`${pdfServerUrl}${endpoint}`, {
                method: 'POST',
                headers,
                signal: controller.signal,
                body: JSON.stringify({
                    htmlContent: processedBody,
                    filename: `${candidateName.replace(/\s+/g, '_')}.${fileExtension}`,
                    stylesheet: template.stylesheet || '',
                    headerContent: processedHeader || undefined,
                    footerContent: processedFooter || undefined,
                    footerHeight: template.footer_height || 25,
                    format
                })
            }).finally(() => {
                clearTimeout(timeoutId);
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                lastError = `${format.toUpperCase()} generation failed (status ${response.status}): ${errorText}`;
                safeLog('warn', 'Batch export document generation attempt failed', {
                    jobId,
                    endpoint,
                    attempt,
                    maxRetries,
                    candidateName,
                    format,
                    status: response.status,
                    ...diagnostics
                });
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    continue;
                }
                return { success: false, error: lastError };
            }

            const buffer = await response.arrayBuffer();
            return { success: true, content: buffer };
        } catch (fetchErr) {
            if (fetchErr?.code === 'PDF_SERVER_AUTH_NOT_CONFIGURED') {
                return { success: false, error: 'PDF server authentication is not configured on the backend.' };
            }
            lastError = fetchErr.message;
            safeLog('warn', 'Batch export document generation request errored', {
                jobId,
                endpoint,
                attempt,
                maxRetries,
                candidateName,
                format,
                error: fetchErr.message,
                ...diagnostics
            });
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
            }
        }
    }

    return { success: false, error: lastError || 'Unknown error after retries' };
}
