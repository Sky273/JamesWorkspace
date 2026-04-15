import { safeLog } from '../../../utils/logger.backend.js';
import { extractFromDOCX, extractFromPDF } from './extractors.js';
import { inferMimeTypeFromFilename } from '../../../utils/uploadFileTypes.js';
import { isValidDocxArchive, isValidFileSignature } from '../../../utils/fileSignature.js';
import { executeAiWorkflowWithCredits, runAiActionWithCredits, workflowReservationCoversAction } from '../../../services/aiCredits.service.js';

function createExtractFromCvHandler() {
    return async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { buffer, originalname, mimetype } = req.file;
            const resolvedMimeType = inferMimeTypeFromFilename(originalname) || mimetype;
            const hasValidContents = resolvedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                ? await isValidDocxArchive(buffer)
                : isValidFileSignature(buffer, resolvedMimeType);
            if (!hasValidContents) {
                return res.status(400).json({ error: 'Invalid file contents.' });
            }
            let result;

            safeLog('info', 'Starting template extraction', {
                fileName: originalname,
                mimetype: resolvedMimeType,
                fileSize: buffer.length,
                userId: req.user?.id
            });

            try {
                result = await executeAiWorkflowWithCredits({
                    firmId: req.user?.firmId || req.user?.firm_id || null,
                    userId: req.user?.id || null,
                    workflowActionType: 'template.extract',
                    steps: [{ actionType: 'template.extract' }],
                    metadata: {
                        fileName: originalname,
                        mimeType: resolvedMimeType
                    }
                }, ({ workflowReservation }) => runAiActionWithCredits({
                    firmId: req.user?.firmId || req.user?.firm_id || null,
                    userId: req.user?.id || null,
                    actionType: 'template.extract',
                    metadata: {
                        fileName: originalname,
                        mimeType: resolvedMimeType
                    },
                    reservation: workflowReservationCoversAction(workflowReservation, 'template.extract')
                        ? workflowReservation
                        : null
                }, async (actionConfig = {}) => {
                    if (resolvedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                        return extractFromDOCX(buffer, originalname, { maxTokens: actionConfig.maxTokens });
                    }
                    if (resolvedMimeType === 'application/pdf') {
                        return extractFromPDF(buffer, originalname, { maxTokens: actionConfig.maxTokens });
                    }
                    if (resolvedMimeType === 'application/msword') {
                        throw Object.assign(new Error('Old .doc format is not supported. Please convert to .docx or PDF.'), { statusCode: 400 });
                    }
                    throw Object.assign(new Error('Unsupported file type.'), { statusCode: 400 });
                }));
            } catch (error) {
                if (error.code === 'INSUFFICIENT_CREDITS') {
                    return res.status(402).json({
                        code: 'INSUFFICIENT_CREDITS',
                        error: 'Insufficient credits for this AI action',
                        details: error.details
                    });
                }
                if (error.statusCode === 400) {
                    return res.status(400).json({ error: error.message });
                }
                throw error;
            }

            return res.json({
                success: true,
                template: result.template,
                model: result.model,
                usage: result.usage,
                extractionMethod: result.extractionMethod
            });
        } catch (error) {
            safeLog('error', 'Template extraction failed', {
                error: error.message,
                stack: error.stack
            });
            return res.status(500).json({ error: 'Failed to extract template from CV' });
        }
    };
}

export { createExtractFromCvHandler };
