import { safeLog } from '../../../utils/logger.backend.js';
import { extractFromDOCX, extractFromPDF } from './extractors.js';
import { inferMimeTypeFromFilename } from '../../../utils/uploadFileTypes.js';
import { isValidFileSignature } from '../../../utils/fileSignature.js';

function createExtractFromCvHandler() {
    return async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { buffer, originalname, mimetype } = req.file;
            const resolvedMimeType = inferMimeTypeFromFilename(originalname) || mimetype;
            if (!isValidFileSignature(buffer, resolvedMimeType)) {
                return res.status(400).json({ error: 'Invalid file contents.' });
            }
            let result;

            safeLog('info', 'Starting template extraction', {
                fileName: originalname,
                mimetype: resolvedMimeType,
                fileSize: buffer.length,
                userId: req.user?.id
            });

            if (resolvedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                result = await extractFromDOCX(buffer, originalname);
            } else if (resolvedMimeType === 'application/pdf') {
                result = await extractFromPDF(buffer, originalname);
            } else if (resolvedMimeType === 'application/msword') {
                return res.status(400).json({ error: 'Old .doc format is not supported. Please convert to .docx or PDF.' });
            } else {
                return res.status(400).json({ error: 'Unsupported file type.' });
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
