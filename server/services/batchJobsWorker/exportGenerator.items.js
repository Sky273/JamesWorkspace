import { safeLog } from '../../utils/logger.backend.js';
import {
    buildProcessedTemplateSections,
    generateDocumentWithRetry,
    loadExportSourceData,
    resolveFirmLogoMarkup
} from './exportGenerator.documents.js';

function buildExportFileName({ item, sourceType, trigram, templateName, fileExtension }) {
    const sanitizedItemName = (item.file_name || '')
        .replace(/[^a-zA-Z0-9\-_\s]/g, '')
        .replace(/\s+/g, '_');

    if (sourceType === 'adaptation' && sanitizedItemName) {
        return `${trigram}_${sanitizedItemName}_${templateName}.${fileExtension}`;
    }

    return `${trigram}_${templateName}.${fileExtension}`;
}

export async function processExportItemForFormat({
    item,
    format,
    jobId,
    template,
    templateName,
    pdfServerUrl,
    firmLogoMarkupCache
}) {
    const fileExtension = format === 'pdf' ? 'pdf' : format;
    const fallbackSourceType = item.source_type || 'resume';

    try {
        const exportSource = await loadExportSourceData(item);
        if (!exportSource.success) {
            return {
                success: false,
                itemId: item.id,
                error: exportSource.error,
                resumeId: item.resume_id,
                format,
                sourceType: exportSource.sourceType
            };
        }

        const {
            sourceType,
            content,
            candidateName,
            candidateTitle,
            trigram,
            firmId
        } = exportSource;

        const logoMarkup = await resolveFirmLogoMarkup({
            firmId,
            template,
            firmLogoMarkupCache
        });

        const {
            processedBody,
            processedHeader,
            processedFooter
        } = buildProcessedTemplateSections(template, {
            candidateName,
            candidateTitle,
            content,
            logoMarkup
        });

        const result = await generateDocumentWithRetry({
            pdfServerUrl,
            template,
            jobId,
            processedBody,
            processedHeader,
            processedFooter,
            candidateName,
            format,
            diagnostics: {
                itemId: item.id,
                resumeId: item.resume_id || null,
                adaptationId: item.adaptation_id || null,
                sourceType
            }
        });

        if (!result.success) {
            return {
                success: false,
                itemId: item.id,
                error: result.error,
                resumeId: item.resume_id,
                format,
                sourceType
            };
        }

        const fileName = buildExportFileName({
            item,
            sourceType,
            trigram,
            templateName,
            fileExtension
        });

        return {
            success: true,
            itemId: item.id,
            fileName,
            content: result.content,
            resumeId: item.resume_id,
            format,
            relativePath: item.relative_path,
            sourceType
        };
    } catch (error) {
        safeLog('error', `Error processing ${fallbackSourceType} for ${format.toUpperCase()} export`, {
            resumeId: item.resume_id,
            adaptationId: item.adaptation_id,
            error: error.message
        });
        return {
            success: false,
            itemId: item.id,
            error: error.message,
            resumeId: item.resume_id,
            format,
            sourceType: fallbackSourceType
        };
    }
}
