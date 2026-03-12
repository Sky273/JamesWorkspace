import express from 'express';
import { authenticateToken, isUserAdmin } from '../middleware/auth.middleware.js';
import { userRateLimit } from '../middleware/rateLimit.middleware.js';
import { validateBody, validateParams, createClientSchema, updateClientSchema, createContactSchema, updateContactSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import { query } from '../config/database.js';
import { getUserFirmId } from '../utils/firmHelpers.js';

const router = express.Router();

// ============================================
// CLIENTS ROUTES (PostgreSQL)
// ============================================

// GET /api/clients - Get all clients (with server-side pagination and firm segregation)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const { search, type } = req.query;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        // Build WHERE clause with firm segregation
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        // Firm segregation (non-admins only see their firm's clients)
        if (!isAdmin && userFirmId) {
            whereConditions.push(`firm_id = $${paramIndex}`);
            params.push(userFirmId);
            paramIndex++;
        }

        // Search filter
        if (search) {
            whereConditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(industry) LIKE $${paramIndex})`);
            params.push(`%${search.toLowerCase()}%`);
            paramIndex++;
        }

        // Type filter (client/prospect)
        if (type && ['client', 'prospect'].includes(type)) {
            whereConditions.push(`type = $${paramIndex}`);
            params.push(type);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Fetch clients with pagination
        const clientsQuery = `
            SELECT c.*, f.name as firm_name,
                (SELECT COUNT(*) FROM client_contacts cc WHERE cc.client_id = c.id) as contacts_count,
                (SELECT COUNT(*) FROM resume_submissions rs WHERE rs.client_id = c.id) as submissions_count
            FROM clients c
            LEFT JOIN firms f ON c.firm_id = f.id
            ${whereClause}
            ORDER BY c.name ASC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        params.push(limit + 1, offset);

        const result = await query(clientsQuery, params);
        const clients = result.rows;

        // Check if there are more records
        const hasMore = clients.length > limit;
        if (hasMore) {
            clients.pop();
        }

        // Get total count
        let totalCount = null;
        if (page === 1) {
            const countParams = params.slice(0, -2); // Remove limit and offset
            const countQuery = `SELECT COUNT(*) as count FROM clients c ${whereClause}`;
            const countResult = await query(countQuery, countParams);
            totalCount = parseInt(countResult.rows[0].count);
        }

        return res.json({
            data: clients,
            pagination: {
                page,
                limit,
                hasMore,
                totalCount,
                nextPage: hasMore ? page + 1 : null
            }
        });
    } catch (error) {
        safeLog('error', 'Error fetching clients', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch clients',
            message: error.message 
        });
    }
});

// ============================================
// INDUSTRIES ROUTES (MUST be before /:id routes)
// ============================================

// GET /api/clients/industries/list - Get all distinct industries from industry_aliases
router.get('/industries/list', authenticateToken, async (req, res) => {
    try {
        safeLog('info', 'Fetching industries from industry_aliases');
        const result = await query(
            `SELECT DISTINCT canonical_name 
             FROM industry_aliases 
             ORDER BY canonical_name ASC`
        );
        
        const industries = result.rows.map(row => row.canonical_name);
        safeLog('info', 'Industries fetched', { count: industries.length });
        return res.json(industries);
    } catch (error) {
        safeLog('error', 'Error fetching industries', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch industries',
            message: error.message 
        });
    }
});

// GET /api/clients/:id - Get client by ID with contacts
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        // Fetch client
        const clientResult = await query(
            `SELECT c.*, f.name as firm_name
             FROM clients c
             LEFT JOIN firms f ON c.firm_id = f.id
             WHERE c.id = $1`,
            [id]
        );

        if (clientResult.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const client = clientResult.rows[0];

        // Check firm access
        if (!isAdmin && userFirmId && client.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Fetch contacts
        const contactsResult = await query(
            `SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY is_primary DESC, name ASC`,
            [id]
        );

        // Fetch recent submissions
        const submissionsResult = await query(
            `SELECT rs.*, r.name as resume_name, r.title as resume_title,
                    cc.name as contact_name, m.title as mission_title,
                    u.name as sent_by_name
             FROM resume_submissions rs
             LEFT JOIN resumes r ON rs.resume_id = r.id
             LEFT JOIN client_contacts cc ON rs.contact_id = cc.id
             LEFT JOIN missions m ON rs.mission_id = m.id
             LEFT JOIN users u ON rs.sent_by = u.id
             WHERE rs.client_id = $1
             ORDER BY rs.sent_at DESC
             LIMIT 10`,
            [id]
        );

        return res.json({
            ...client,
            contacts: contactsResult.rows,
            recentSubmissions: submissionsResult.rows
        });
    } catch (error) {
        safeLog('error', 'Error fetching client', { error: error.message, clientId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to fetch client',
            message: error.message 
        });
    }
});

// POST /api/clients - Create client
router.post('/', authenticateToken, userRateLimit(), validateBody(createClientSchema), async (req, res) => {
    try {
        const userFirmId = await getUserFirmId(req);
        const userId = req.user?.id;
        const isAdmin = isUserAdmin(req);

        if (!userFirmId) {
            return res.status(400).json({ error: 'User must belong to a firm to create clients' });
        }

        const { name, type, status, address, website, industry, notes, firm_id } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Client name is required' });
        }

        // Determine target firm_id: admin can specify a different firm
        let targetFirmId = userFirmId;
        if (isAdmin && firm_id && firm_id !== userFirmId) {
            // Admin is creating for another firm - validate the firm exists
            const firmResult = await query('SELECT id, name FROM firms WHERE id = $1', [firm_id]);
            if (firmResult.rows.length === 0) {
                return res.status(400).json({ error: 'Specified firm not found' });
            }
            targetFirmId = firmResult.rows[0].id;
            safeLog('info', 'Admin creating client for another firm', { 
                adminId: userId, 
                targetFirmId, 
                targetFirmName: firmResult.rows[0].name 
            });
        }

        const result = await query(
            `INSERT INTO clients (firm_id, name, type, status, address, website, industry, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                targetFirmId,
                name,
                type || 'prospect',
                status || 'active',
                address || null,
                website || null,
                industry || null,
                notes || null,
                userId
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Client with this name already exists' });
        }
        safeLog('error', 'Error creating client', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to create client',
            message: error.message 
        });
    }
});

// PUT /api/clients/:id - Update client
router.put('/:id', authenticateToken, userRateLimit(), validateParams('id'), validateBody(updateClientSchema), async (req, res) => {
    try {
        const { id } = req.params;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        // Check if client exists and user has access
        const existingResult = await query('SELECT * FROM clients WHERE id = $1', [id]);
        if (existingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const existing = existingResult.rows[0];
        if (!isAdmin && userFirmId && existing.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { name, type, status, address, website, industry, notes, firm_id } = req.body;

        // Handle firm_id update (admin only)
        let targetFirmId = existing.firm_id;
        if (isAdmin && firm_id && firm_id !== existing.firm_id) {
            const firmResult = await query('SELECT id, name FROM firms WHERE id = $1', [firm_id]);
            if (firmResult.rows.length === 0) {
                return res.status(400).json({ error: 'Specified firm not found' });
            }
            targetFirmId = firmResult.rows[0].id;
            safeLog('info', 'Admin changing client firm', { 
                adminId: req.user?.id, 
                clientId: id,
                oldFirmId: existing.firm_id,
                newFirmId: targetFirmId 
            });
        }

        const result = await query(
            `UPDATE clients 
             SET name = COALESCE($1, name),
                 type = COALESCE($2, type),
                 status = COALESCE($3, status),
                 address = $4,
                 website = $5,
                 industry = $6,
                 notes = $7,
                 firm_id = $8,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $9
             RETURNING *`,
            [name, type, status, address, website, industry, notes, targetFirmId, id]
        );

        return res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Client with this name already exists' });
        }
        safeLog('error', 'Error updating client', { error: error.message, clientId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to update client',
            message: error.message 
        });
    }
});

// DELETE /api/clients/:id - Delete client
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        // Check if client exists and user has access
        const existingResult = await query('SELECT * FROM clients WHERE id = $1', [id]);
        if (existingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const existing = existingResult.rows[0];
        if (!isAdmin && userFirmId && existing.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check for submissions
        const submissionsResult = await query(
            'SELECT COUNT(*) as count FROM resume_submissions WHERE client_id = $1',
            [id]
        );
        if (parseInt(submissionsResult.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete client with submission history',
                submissionsCount: parseInt(submissionsResult.rows[0].count)
            });
        }

        await query('DELETE FROM clients WHERE id = $1', [id]);

        return res.json({ message: 'Client deleted successfully' });
    } catch (error) {
        safeLog('error', 'Error deleting client', { error: error.message, clientId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to delete client',
            message: error.message 
        });
    }
});

// ============================================
// CLIENT CONTACTS ROUTES
// ============================================

// GET /api/clients/:clientId/contacts - Get all contacts for a client
router.get('/:clientId/contacts', authenticateToken, async (req, res) => {
    try {
        const { clientId } = req.params;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        // Check client access
        const clientResult = await query('SELECT firm_id FROM clients WHERE id = $1', [clientId]);
        if (clientResult.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        if (!isAdmin && userFirmId && clientResult.rows[0].firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await query(
            `SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY is_primary DESC, name ASC`,
            [clientId]
        );

        return res.json(result.rows);
    } catch (error) {
        safeLog('error', 'Error fetching contacts', { error: error.message, clientId: req.params.clientId });
        return res.status(500).json({ 
            error: 'Failed to fetch contacts',
            message: error.message 
        });
    }
});

// POST /api/clients/:clientId/contacts - Create contact
router.post('/:clientId/contacts', authenticateToken, userRateLimit(), validateBody(createContactSchema), async (req, res) => {
    try {
        const { clientId } = req.params;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        // Check client access
        const clientResult = await query('SELECT firm_id FROM clients WHERE id = $1', [clientId]);
        if (clientResult.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        if (!isAdmin && userFirmId && clientResult.rows[0].firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { name, role, email, phone, is_primary } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Contact name is required' });
        }

        // If setting as primary, unset other primaries
        if (is_primary) {
            await query('UPDATE client_contacts SET is_primary = false WHERE client_id = $1', [clientId]);
        }

        const result = await query(
            `INSERT INTO client_contacts (client_id, name, role, email, phone, is_primary)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [clientId, name, role || null, email || null, phone || null, is_primary || false]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        safeLog('error', 'Error creating contact', { error: error.message, clientId: req.params.clientId });
        return res.status(500).json({ 
            error: 'Failed to create contact',
            message: error.message 
        });
    }
});

// PUT /api/clients/:clientId/contacts/:id - Update contact
router.put('/:clientId/contacts/:id', authenticateToken, userRateLimit(), validateBody(updateContactSchema), async (req, res) => {
    try {
        const { clientId, id } = req.params;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        // Check client access
        const clientResult = await query('SELECT firm_id FROM clients WHERE id = $1', [clientId]);
        if (clientResult.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        if (!isAdmin && userFirmId && clientResult.rows[0].firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { name, role, email, phone, is_primary } = req.body;

        // If setting as primary, unset other primaries
        if (is_primary) {
            await query('UPDATE client_contacts SET is_primary = false WHERE client_id = $1 AND id != $2', [clientId, id]);
        }

        const result = await query(
            `UPDATE client_contacts 
             SET name = COALESCE($1, name),
                 role = $2,
                 email = $3,
                 phone = $4,
                 is_primary = COALESCE($5, is_primary),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6 AND client_id = $7
             RETURNING *`,
            [name, role, email, phone, is_primary, id, clientId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        return res.json(result.rows[0]);
    } catch (error) {
        safeLog('error', 'Error updating contact', { error: error.message, contactId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to update contact',
            message: error.message 
        });
    }
});

// DELETE /api/clients/:clientId/contacts/:id - Delete contact
router.delete('/:clientId/contacts/:id', authenticateToken, async (req, res) => {
    try {
        const { clientId, id } = req.params;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        // Check client access
        const clientResult = await query('SELECT firm_id FROM clients WHERE id = $1', [clientId]);
        if (clientResult.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        if (!isAdmin && userFirmId && clientResult.rows[0].firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check for submissions using this contact
        const submissionsResult = await query(
            'SELECT COUNT(*) as count FROM resume_submissions WHERE contact_id = $1',
            [id]
        );
        if (parseInt(submissionsResult.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete contact with submission history',
                submissionsCount: parseInt(submissionsResult.rows[0].count)
            });
        }

        const result = await query(
            'DELETE FROM client_contacts WHERE id = $1 AND client_id = $2 RETURNING id',
            [id, clientId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        return res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
        safeLog('error', 'Error deleting contact', { error: error.message, contactId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to delete contact',
            message: error.message 
        });
    }
});

export default router;
