import express from 'express';
import { authenticateToken, isUserAdmin } from '../middleware/auth.middleware.js';
import { safeLog } from '../utils/logger.backend.js';
import { query } from '../config/database.js';
import { getUserFirmId } from '../utils/firmHelpers.js';

const router = express.Router();

// ============================================
// RESUME SUBMISSIONS ROUTES (PostgreSQL)
// ============================================

// GET /api/submissions - Get all submissions (with pagination and firm segregation)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const { clientId, resumeId, missionId, status } = req.query;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        // Build WHERE clause with firm segregation
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        // Firm segregation
        if (!isAdmin && userFirmId) {
            whereConditions.push(`rs.firm_id = $${paramIndex}`);
            params.push(userFirmId);
            paramIndex++;
        }

        // Filters
        if (clientId) {
            whereConditions.push(`rs.client_id = $${paramIndex}`);
            params.push(clientId);
            paramIndex++;
        }

        if (resumeId) {
            whereConditions.push(`rs.resume_id = $${paramIndex}`);
            params.push(resumeId);
            paramIndex++;
        }

        if (missionId) {
            whereConditions.push(`rs.mission_id = $${paramIndex}`);
            params.push(missionId);
            paramIndex++;
        }

        if (status) {
            whereConditions.push(`rs.status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Fetch submissions with pagination
        const submissionsQuery = `
            SELECT rs.*,
                   r.name as resume_name, r.title as resume_title,
                   c.name as client_name, c.type as client_type,
                   cc.name as contact_name, cc.email as contact_email,
                   m.title as mission_title,
                   u.name as sent_by_name,
                   f.name as firm_name
            FROM resume_submissions rs
            LEFT JOIN resumes r ON rs.resume_id = r.id
            LEFT JOIN clients c ON rs.client_id = c.id
            LEFT JOIN client_contacts cc ON rs.contact_id = cc.id
            LEFT JOIN missions m ON rs.mission_id = m.id
            LEFT JOIN users u ON rs.sent_by = u.id
            LEFT JOIN firms f ON rs.firm_id = f.id
            ${whereClause}
            ORDER BY rs.sent_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        params.push(limit + 1, offset);

        const result = await query(submissionsQuery, params);
        const submissions = result.rows;

        // Check if there are more records
        const hasMore = submissions.length > limit;
        if (hasMore) {
            submissions.pop();
        }

        // Get total count
        let totalCount = null;
        if (page === 1) {
            const countParams = params.slice(0, -2);
            const countQuery = `SELECT COUNT(*) as count FROM resume_submissions rs ${whereClause}`;
            const countResult = await query(countQuery, countParams);
            totalCount = parseInt(countResult.rows[0].count);
        }

        return res.json({
            data: submissions,
            pagination: {
                page,
                limit,
                hasMore,
                totalCount,
                nextPage: hasMore ? page + 1 : null
            }
        });
    } catch (error) {
        safeLog('error', 'Error fetching submissions', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch submissions',
            message: error.message 
        });
    }
});

// GET /api/submissions/:id - Get submission by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        const result = await query(
            `SELECT rs.*,
                    r.name as resume_name, r.title as resume_title,
                    c.name as client_name, c.type as client_type,
                    cc.name as contact_name, cc.email as contact_email, cc.phone as contact_phone,
                    m.title as mission_title,
                    u.name as sent_by_name,
                    f.name as firm_name
             FROM resume_submissions rs
             LEFT JOIN resumes r ON rs.resume_id = r.id
             LEFT JOIN clients c ON rs.client_id = c.id
             LEFT JOIN client_contacts cc ON rs.contact_id = cc.id
             LEFT JOIN missions m ON rs.mission_id = m.id
             LEFT JOIN users u ON rs.sent_by = u.id
             LEFT JOIN firms f ON rs.firm_id = f.id
             WHERE rs.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        const submission = result.rows[0];

        // Check firm access
        if (!isAdmin && userFirmId && submission.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        return res.json(submission);
    } catch (error) {
        safeLog('error', 'Error fetching submission', { error: error.message, submissionId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to fetch submission',
            message: error.message 
        });
    }
});

// POST /api/submissions - Create submission (record a CV send)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const userFirmId = await getUserFirmId(req);
        const userId = req.user?.id;

        if (!userFirmId) {
            return res.status(400).json({ error: 'User must belong to a firm to create submissions' });
        }

        const { resume_id, client_id, contact_id, mission_id, notes, sent_at, status } = req.body;

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
        const resumeResult = await query('SELECT id FROM resumes WHERE id = $1', [resume_id]);
        if (resumeResult.rows.length === 0) {
            return res.status(400).json({ error: 'Resume not found' });
        }

        // Verify client exists and belongs to user's firm
        const clientResult = await query('SELECT firm_id FROM clients WHERE id = $1', [client_id]);
        if (clientResult.rows.length === 0) {
            return res.status(400).json({ error: 'Client not found' });
        }
        if (clientResult.rows[0].firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Client does not belong to your firm' });
        }

        // Verify contact belongs to client
        const contactResult = await query('SELECT id FROM client_contacts WHERE id = $1 AND client_id = $2', [contact_id, client_id]);
        if (contactResult.rows.length === 0) {
            return res.status(400).json({ error: 'Contact not found or does not belong to this client' });
        }

        // Verify mission if provided
        if (mission_id) {
            const missionResult = await query('SELECT id FROM missions WHERE id = $1', [mission_id]);
            if (missionResult.rows.length === 0) {
                return res.status(400).json({ error: 'Mission not found' });
            }
        }

        const result = await query(
            `INSERT INTO resume_submissions (resume_id, client_id, contact_id, mission_id, firm_id, sent_by, notes, sent_at, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                resume_id,
                client_id,
                contact_id,
                mission_id || null,
                userFirmId,
                userId,
                notes || null,
                sent_at || new Date().toISOString(),
                status || 'sent'
            ]
        );

        // Fetch full submission with joins
        const fullResult = await query(
            `SELECT rs.*,
                    r.name as resume_name, r.title as resume_title,
                    c.name as client_name, c.type as client_type,
                    cc.name as contact_name, cc.email as contact_email,
                    m.title as mission_title,
                    u.name as sent_by_name
             FROM resume_submissions rs
             LEFT JOIN resumes r ON rs.resume_id = r.id
             LEFT JOIN clients c ON rs.client_id = c.id
             LEFT JOIN client_contacts cc ON rs.contact_id = cc.id
             LEFT JOIN missions m ON rs.mission_id = m.id
             LEFT JOIN users u ON rs.sent_by = u.id
             WHERE rs.id = $1`,
            [result.rows[0].id]
        );

        return res.status(201).json(fullResult.rows[0]);
    } catch (error) {
        safeLog('error', 'Error creating submission', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to create submission',
            message: error.message 
        });
    }
});

// PUT /api/submissions/:id - Update submission status
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        // Check if submission exists and user has access
        const existingResult = await query('SELECT * FROM resume_submissions WHERE id = $1', [id]);
        if (existingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        const existing = existingResult.rows[0];
        if (!isAdmin && userFirmId && existing.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { status, notes } = req.body;

        const result = await query(
            `UPDATE resume_submissions 
             SET status = COALESCE($1, status),
                 notes = COALESCE($2, notes)
             WHERE id = $3
             RETURNING *`,
            [status, notes, id]
        );

        return res.json(result.rows[0]);
    } catch (error) {
        safeLog('error', 'Error updating submission', { error: error.message, submissionId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to update submission',
            message: error.message 
        });
    }
});

// DELETE /api/submissions/:id - Delete submission
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        // Check if submission exists and user has access
        const existingResult = await query('SELECT * FROM resume_submissions WHERE id = $1', [id]);
        if (existingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        const existing = existingResult.rows[0];
        if (!isAdmin && userFirmId && existing.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await query('DELETE FROM resume_submissions WHERE id = $1', [id]);

        return res.json({ message: 'Submission deleted successfully' });
    } catch (error) {
        safeLog('error', 'Error deleting submission', { error: error.message, submissionId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to delete submission',
            message: error.message 
        });
    }
});

// GET /api/submissions/stats - Get submission statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
    try {
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        let firmFilter = '';
        let params = [];

        if (!isAdmin && userFirmId) {
            firmFilter = 'WHERE firm_id = $1';
            params = [userFirmId];
        }

        const statsQuery = `
            SELECT 
                COUNT(*) as total_submissions,
                COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
                COUNT(CASE WHEN status = 'viewed' THEN 1 END) as viewed,
                COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(DISTINCT client_id) as unique_clients,
                COUNT(DISTINCT resume_id) as unique_resumes
            FROM resume_submissions
            ${firmFilter}
        `;

        const result = await query(statsQuery, params);

        return res.json(result.rows[0]);
    } catch (error) {
        safeLog('error', 'Error fetching submission stats', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch submission stats',
            message: error.message 
        });
    }
});

export default router;
