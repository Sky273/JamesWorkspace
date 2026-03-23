import express from 'express';
import { authenticateToken, isUserAdmin } from '../middleware/auth.middleware.js';
import { userRateLimit } from '../middleware/rateLimit.middleware.js';
import { validateBody, validateParams, createClientSchema, updateClientSchema, createContactSchema, updateContactSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import * as clientsService from '../services/clients.service.js';

const router = express.Router();

function getFirstDefinedValue(source, keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
            return source[key];
        }
    }
    return undefined;
}

function normalizeClientPayload(payload = {}) {
    return {
        ...payload,
        name: getFirstDefinedValue(payload, ['name', 'Name']),
        type: getFirstDefinedValue(payload, ['type', 'Type']),
        status: getFirstDefinedValue(payload, ['status', 'Status']),
        address: getFirstDefinedValue(payload, ['address', 'Address']),
        website: getFirstDefinedValue(payload, ['website', 'Website']),
        industry: getFirstDefinedValue(payload, ['industry', 'Industry']),
        notes: getFirstDefinedValue(payload, ['notes', 'Notes']),
        firm_id: getFirstDefinedValue(payload, ['firm_id', 'firmId', 'FirmId'])
    };
}

function normalizeContactPayload(payload = {}) {
    return {
        ...payload,
        name: getFirstDefinedValue(payload, ['name', 'Name']),
        role: getFirstDefinedValue(payload, ['role', 'Role']),
        email: getFirstDefinedValue(payload, ['email', 'Email']),
        phone: getFirstDefinedValue(payload, ['phone', 'Phone']),
        job_title: getFirstDefinedValue(payload, ['job_title', 'jobTitle', 'JobTitle']),
        is_primary: getFirstDefinedValue(payload, ['is_primary', 'isPrimary', 'IsPrimary'])
    };
}

// ============================================
// CLIENTS ROUTES
// ============================================

// GET /api/clients - Get all clients (with server-side pagination and firm segregation)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const { search, type } = req.query;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        const result = await clientsService.listClients({
            page,
            limit,
            search,
            type,
            firmId: isAdmin ? null : userFirmId
        });

        return res.json(result);
    } catch (error) {
        safeLog('error', 'Error fetching clients', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch clients' 
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
        const industries = await clientsService.listIndustries();
        safeLog('info', 'Industries fetched', { count: industries.length });
        return res.json(industries);
    } catch (error) {
        safeLog('error', 'Error fetching industries', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch industries' 
        });
    }
});

// GET /api/clients/:id - Get client by ID with contacts
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userFirmId = await getUserFirmId(req);
        const isAdmin = isUserAdmin(req);

        const client = await clientsService.getClientById(id);

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // Check firm access
        if (!isAdmin && userFirmId && client.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        return res.json(client);
    } catch (error) {
        safeLog('error', 'Error fetching client', { error: error.message, clientId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to fetch client' 
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

        const normalizedClient = normalizeClientPayload(req.body);
        const { name, type, status, address, website, industry, notes, firm_id } = normalizedClient;

        if (!name) {
            return res.status(400).json({ error: 'Client name is required' });
        }

        // Determine target firm_id: admin can specify a different firm
        let targetFirmId = userFirmId;
        if (isAdmin && firm_id && firm_id !== userFirmId) {
            const firm = await clientsService.validateFirm(firm_id);
            if (!firm) {
                return res.status(400).json({ error: 'Specified firm not found' });
            }
            targetFirmId = firm.id;
            safeLog('info', 'Admin creating client for another firm', { 
                adminId: userId, 
                targetFirmId, 
                targetFirmName: firm.name 
            });
        }

        const client = await clientsService.createClient({
            firmId: targetFirmId,
            name, type, status, address, website, industry, notes,
            createdBy: userId
        });

        return res.status(201).json(client);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Client with this name already exists' });
        }
        safeLog('error', 'Error creating client', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to create client' 
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
        const existing = await clientsService.findClient(id);
        if (!existing) {
            return res.status(404).json({ error: 'Client not found' });
        }

        if (!isAdmin && userFirmId && existing.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const normalizedClient = normalizeClientPayload(req.body);
        const { name, type, status, address, website, industry, notes, firm_id } = normalizedClient;

        // Handle firm_id update (admin only)
        let targetFirmId = existing.firm_id;
        if (isAdmin && firm_id && firm_id !== existing.firm_id) {
            const firm = await clientsService.validateFirm(firm_id);
            if (!firm) {
                return res.status(400).json({ error: 'Specified firm not found' });
            }
            targetFirmId = firm.id;
            safeLog('info', 'Admin changing client firm', { 
                adminId: req.user?.id, 
                clientId: id,
                oldFirmId: existing.firm_id,
                newFirmId: targetFirmId 
            });
        }

        const updated = await clientsService.updateClient(id, {
            name, type, status, address, website, industry, notes,
            firmId: targetFirmId
        });

        return res.json(updated);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Client with this name already exists' });
        }
        safeLog('error', 'Error updating client', { error: error.message, clientId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to update client' 
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
        const existing = await clientsService.findClient(id);
        if (!existing) {
            return res.status(404).json({ error: 'Client not found' });
        }

        if (!isAdmin && userFirmId && existing.firm_id !== userFirmId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check for submissions
        const submissionsCount = await clientsService.countClientSubmissions(id);
        if (submissionsCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete client with submission history',
                submissionsCount
            });
        }

        await clientsService.deleteClient(id);

        return res.json({ message: 'Client deleted successfully' });
    } catch (error) {
        safeLog('error', 'Error deleting client', { error: error.message, clientId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to delete client' 
        });
    }
});

// ============================================
// CLIENT CONTACTS ROUTES
// ============================================

/**
 * Check client access: exists + firm segregation
 * Returns { ok: true, firmId } or sends error response and returns { ok: false }
 */
async function checkClientAccess(req, res, clientId) {
    const clientFirm = await clientsService.getClientFirmId(clientId);
    if (!clientFirm) {
        res.status(404).json({ error: 'Client not found' });
        return { ok: false };
    }

    const userFirmId = await getUserFirmId(req);
    const isAdmin = isUserAdmin(req);
    if (!isAdmin && userFirmId && clientFirm.firm_id !== userFirmId) {
        res.status(403).json({ error: 'Access denied' });
        return { ok: false };
    }

    return { ok: true };
}

// GET /api/clients/:clientId/contacts - Get all contacts for a client
router.get('/:clientId/contacts', authenticateToken, async (req, res) => {
    try {
        const { clientId } = req.params;
        const access = await checkClientAccess(req, res, clientId);
        if (!access.ok) return;

        const contacts = await clientsService.listContacts(clientId);
        return res.json(contacts);
    } catch (error) {
        safeLog('error', 'Error fetching contacts', { error: error.message, clientId: req.params.clientId });
        return res.status(500).json({ 
            error: 'Failed to fetch contacts' 
        });
    }
});

// POST /api/clients/:clientId/contacts - Create contact
router.post('/:clientId/contacts', authenticateToken, userRateLimit(), validateBody(createContactSchema), async (req, res) => {
    try {
        const { clientId } = req.params;
        const access = await checkClientAccess(req, res, clientId);
        if (!access.ok) return;

        const normalizedContact = normalizeContactPayload(req.body);
        const { name, role, email, phone, job_title, is_primary } = normalizedContact;

        if (!name) {
            return res.status(400).json({ error: 'Contact name is required' });
        }

        const contact = await clientsService.createContact(clientId, { name, role, email, phone, job_title, is_primary });
        return res.status(201).json(contact);
    } catch (error) {
        safeLog('error', 'Error creating contact', { error: error.message, clientId: req.params.clientId });
        return res.status(500).json({ 
            error: 'Failed to create contact' 
        });
    }
});

// PUT /api/clients/:clientId/contacts/:id - Update contact
router.put('/:clientId/contacts/:id', authenticateToken, userRateLimit(), validateBody(updateContactSchema), async (req, res) => {
    try {
        const { clientId, id } = req.params;
        const access = await checkClientAccess(req, res, clientId);
        if (!access.ok) return;

        const normalizedContact = normalizeContactPayload(req.body);
        const { name, role, email, phone, job_title, is_primary } = normalizedContact;

        const updated = await clientsService.updateContact(id, clientId, { name, role, email, phone, job_title, is_primary });

        if (!updated) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        return res.json(updated);
    } catch (error) {
        safeLog('error', 'Error updating contact', { error: error.message, contactId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to update contact' 
        });
    }
});

// DELETE /api/clients/:clientId/contacts/:id - Delete contact
router.delete('/:clientId/contacts/:id', authenticateToken, async (req, res) => {
    try {
        const { clientId, id } = req.params;
        const access = await checkClientAccess(req, res, clientId);
        if (!access.ok) return;

        // Check for submissions using this contact
        const submissionsCount = await clientsService.countContactSubmissions(id);
        if (submissionsCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete contact with submission history',
                submissionsCount
            });
        }

        const deleted = await clientsService.deleteContact(id, clientId);

        if (!deleted) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        return res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
        safeLog('error', 'Error deleting contact', { error: error.message, contactId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to delete contact' 
        });
    }
});

export default router;
