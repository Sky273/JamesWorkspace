import { findResumeRecord } from '../../../services/resumes.service.js';
import { executeResumeAdaptation } from '../../../services/resumeAdaptation.service.js';
import { getRequestMetadata } from '../../../services/security.service.js';
import { safeLog } from '../../../utils/logger.backend.js';
import { handleLLMError } from './handlers.analysis.js';

function createAdaptHandler() {
    return async (req, res) => {
        try {
            const { id } = req.params;
            const { missionId } = req.body;
            const userMetadata = getRequestMetadata(req);
            if (!missionId) {
                return res.status(400).json({ error: 'Mission ID is required' });
            }

            const resumeRecord = await findResumeRecord(id);
            const isAdmin = req.user?.role === 'admin';
            const userFirm = req.user?.firm || req.user?.customer;
            if (!isAdmin && resumeRecord.firm_name !== userFirm) {
                return res.status(403).json({ error: 'Access denied: You can only adapt resumes from your firm' });
            }

            const result = await executeResumeAdaptation({ resumeId: id, missionId, userMetadata });
            return res.json({
                adaptedText: result.adaptedText,
                adaptedTitle: result.adaptedTitle,
                matchAnalysis: result.matchAnalysis,
                adaptationId: result.adaptationRecord.id,
                structuredAdaptation: result.structuredAdaptation,
                adaptationNotes: result.adaptationNotes
            });
        } catch (error) {
            safeLog('error', 'Error adapting resume to mission', { error: error.message, status: error.response?.status });
            return handleLLMError(error, res, 'adapting resume to mission');
        }
    };
}

export { createAdaptHandler };
