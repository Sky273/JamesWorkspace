import express from 'express';
import { authenticateToken, isUserAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, createSubmissionSchema, updateSubmissionSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import * as submissionsService from '../services/resumeSubmissions.service.js';

const router = express.Router();

function getFirstDefinedValue(source, keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
            return source[key];
        }
    }
    return undefined;
}

function normalizeSubmissionPayload(payload = {}) {
    return {
        ...payload,
        resume_id: getFirstDefinedValue(payload, ['resume_id', 'resumeId']),
        client_id: getFirstDefinedValue(payload, ['client_id', 'clientId']),
        contact_id: getFirstDefinedValue(payload, ['contact_id', 'contactId']),
        mission_id: getFirstDefinedValue(payload, ['mission_id', 'missionId']),
        notes: getFirstDefinedValue(payload, ['notes', 'Notes']),
        sent_at: getFirstDefinedValue(payload, ['sent_at', 'sentAt']),
        status: getFirstDefinedValue(payload, ['status', 'Status'])
    };
}

// ============================================
// RESUME SUBMISSIONS ROUTES (PostgreSQL)
// ============================================

// GET /api/submissions - Get all submissions (with pagination and firm segregation)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const { clientId, resumeId, missionId, status } = req.query;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        const firmId = (!isAdmin && userFirmId) ? userFirmId : null;

        const result = await submissionsService.listSubmissions({ page, limit, clientId, resumeId, missionId, status, firmId });
        return res.json(result);
    } catch (error) {
        safeLog('error', 'Error fetching submissions', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch submissions' 
        });
    }
});

// GET /api/submissions/:id - Get submission by ID
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        const submission = await submissionsService.getSubmissionById(id);

        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // Check firm access
        if (!isAdmin && userFirmId && submission.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        return res.json(submission);
    } catch (error) {
        safeLog('error', 'Error fetching submission', { error: error.message, submissionId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to fetch submission' 
        });
    }
});

// POST /api/submissions - Create submission (record a CV send)
router.post('/', authenticateToken, validateBody(createSubmissionSchema), async (req, res) => {
    try {
        const userFirmId = await getUserFirmId(req);
        const userId = req.user?.id;

        if (!userFirmId) {
            return res.status(400).json({ error: 'User must belong to a firm to create submissions' });
        }

        const normalizedSubmission = normalizeSubmissionPayload(req.body);
        const { resume_id, client_id, contact_id, mission_id, notes, sent_at, status } = normalizedSubmission;

        // Validate required fields
        if (!resume_id) {
            return res.status(400).json({ error: 'Resume ID is required' });
        }
        if (!client_id) {
            return res.status(400).json({ error: 'Client ID is required' });
        }
        if (!contact_id) {
            return res.status(400).json({ error: 'Contact ID is required' });
        }

        // Verify resume exists
        const resumeExists = await submissionsService.validateResume(resume_id);
        if (!resumeExists) {
            return res.status(400).json({ error: 'Resume not found' });
        }

        // Verify client exists and belongs to user's firm
        const clientCheck = await submissionsService.validateClient(client_id, userFirmId);
        if (!clientCheck.exists) {
            return res.status(400).json({ error: 'Client not found' });
        }
        if (!clientCheck.firmMatch) {
            return res.status(403).json({ error: 'Client does not belong to your firm' });
        }

        // Verify contact belongs to client
        const contactValid = await submissionsService.validateContact(contact_id, client_id);
        if (!contactValid) {
            return res.status(400).json({ error: 'Contact not found or does not belong to this client' });
        }

        // Verify mission if provided
        if (mission_id) {
            const missionExists = await submissionsService.validateMission(mission_id);
            if (!missionExists) {
                return res.status(400).json({ error: 'Mission not found' });
            }
        }

        const submission = await submissionsService.createSubmission({
            resume_id, client_id, contact_id, mission_id,
            firm_id: userFirmId, sent_by: userId,
            notes, sent_at, status
        });

        return res.status(201).json(submission);
    } catch (error) {
        safeLog('error', 'Error creating submission', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to create submission' 
        });
    }
});

// PUT /api/submissions/:id - Update submission status
router.put('/:id', authenticateToken, validateParams('id'), validateBody(updateSubmissionSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        const existing = await submissionsService.findSubmission(id);
        if (!existing) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        if (!isAdmin && userFirmId && existing.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const normalizedSubmission = normalizeSubmissionPayload(req.body);
        const { status, notes } = normalizedSubmission;
        const updated = await submissionsService.updateSubmission(id, { status, notes });

        return res.json(updated);
    } catch (error) {
        safeLog('error', 'Error updating submission', { error: error.message, submissionId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to update submission' 
        });
    }
});

// DELETE /api/submissions/:id - Delete submission
router.delete('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        const existing = await submissionsService.findSubmission(id);
        if (!existing) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        if (!isAdmin && userFirmId && existing.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await submissionsService.deleteSubmission(id);

        return res.json({ message: 'Submission deleted successfully' });
    } catch (error) {
        safeLog('error', 'Error deleting submission', { error: error.message, submissionId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to delete submission' 
        });
    }
});

// GET /api/submissions/stats - Get submission statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
    try {
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        const firmId = (!isAdmin && userFirmId) ? userFirmId : null;
        const stats = await submissionsService.getStatsSummary(firmId);

        return res.json(stats);
    } catch (error) {
        safeLog('error', 'Error fetching submission stats', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch submission stats' 
        });
    }
});

export default router;
