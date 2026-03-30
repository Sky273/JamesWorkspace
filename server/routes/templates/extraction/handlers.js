import { safeLog } from '../../../utils/logger.backend.js';
import { extractFromDOCX, extractFromPDF } from './extractors.js';

function createExtractFromCvHandler() {
    return async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { buffer, originalname, mimetype } = req.file;
            let result;

            safeLog('info', 'Starting template extraction', {
                fileName: originalname,
                mimetype,
                fileSize: buffer.length,
                userId: req.user?.id
            });

            if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                result = await extractFromDOCX(buffer, originalname);
            } else if (mimetype === 'application/pdf') {
                result = await extractFromPDF(buffer, originalname);
            } else if (mimetype === 'application/msword') {
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
