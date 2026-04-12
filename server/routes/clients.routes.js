import express from 'express';
import { authenticateToken, isUserAdmin } from '../middleware/auth.middleware.js';
import { userRateLimit } from '../middleware/rateLimit.middleware.js';
import { validateBody, validateParams, createClientSchema, updateClientSchema, createContactSchema, updateContactSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import * as clientsService from '../services/clients.service.js';
import {
    ensureFirmScopedAccess,
    normalizeClientPayload,
    normalizeContactPayload,
    parsePaginationParams
} from './clients.routes.helpers.js';

const router = express.Router();

function createClientsRouteHandler(logMessage, errorMessage, handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            safeLog('error', logMessage, { error: error.message, clientId: req.params.id ?? req.params.clientId });
            return res.status(500).json({ error: errorMessage });
        }
    };
}

async function getClientAccessContext(req, { missingFirmMessage } = {}) {
    const userFirmId = await getUserFirmId(req);
    const isAdmin = isUserAdmin(req);
    const access = ensureFirmScopedAccess({ isAdmin, userFirmId, missingFirmMessage });

    return {
        userFirmId,
        isAdmin,
        access
    };
}

async function getAccessibleClientRecord(req, res, clientId, {
    missingFirmMessage,
    fetchClientFn = clientsService.findClient
} = {}) {
    const { userFirmId, isAdmin, access } = await getClientAccessContext(req, { missingFirmMessage });
    if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return null;
    }

    const client = await fetchClientFn(clientId);
    if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return null;
    }

    if (!isAdmin && client.firm_id !== userFirmId) {
        res.status(403).json({ error: 'Access denied' });
        return null;
    }

    return { client, userFirmId, isAdmin };
}

// ============================================
// CLIENTS ROUTES
// ============================================

// GET /api/clients - Get all clients (with server-side pagination and firm segregation)
router.get('/', authenticateToken, createClientsRouteHandler('Error fetching clients', 'Failed to fetch clients', async (req, res) => {
        const pagination = parsePaginationParams(req.query.page, req.query.limit);
        if (!pagination.ok) {
            return res.status(400).json({ error: pagination.error });
        }
        const { search, type } = req.query;
        const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';
        const { userFirmId, isAdmin, access } = await getClientAccessContext(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const result = await clientsService.listClients({
            ...pagination.value,
            search,
            type,
            firmId: isAdmin ? null : userFirmId,
            bypassCache
        });

        return res.json(result);
}));

// ============================================
// INDUSTRIES ROUTES (MUST be before /:id routes)
// ============================================

// GET /api/clients/industries/list - Get all distinct industries from industry_aliases
router.get('/industries/list', authenticateToken, createClientsRouteHandler('Error fetching industries', 'Failed to fetch industries', async (req, res) => {
        safeLog('info', 'Fetching industries from industry_aliases');
        const industries = await clientsService.listIndustries();
        safeLog('info', 'Industries fetched', { count: industries.length });
        return res.json(industries);
}));

// GET /api/clients/:id - Get client by ID with contacts
router.get('/:id', authenticateToken, validateParams('id'), createClientsRouteHandler('Error fetching client', 'Failed to fetch client', async (req, res) => {
        const { id } = req.params;
        const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';
        const accessibleClient = await getAccessibleClientRecord(req, res, id, {
            fetchClientFn: (clientId) => clientsService.getClientById(clientId, { bypassCache })
        });
        if (!accessibleClient) {
            return;
        }

        const { client } = accessibleClient;
        return res.json(client);
}));

// POST /api/clients - Create client
router.post('/', authenticateToken, userRateLimit(), validateBody(createClientSchema), createClientsRouteHandler('Error creating client', 'Failed to create client', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { userFirmId, isAdmin, access } = await getClientAccessContext(req, {
            missingFirmMessage: 'User must belong to a firm to create clients'
        });
        if (!access.ok) {
            return res.status(400).json({ error: access.error });
        }

        const normalizedClient = normalizeClientPayload(req.body);
        const { name, type, status, address, website, industry, notes, firm_id } = normalizedClient;

        if (!name) {
            return res.status(400).json({ error: 'Client name is required' });
        }
        if (String(name).length > 255) {
            return res.status(400).json({ error: 'Client name is too long' });
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
        throw error;
    }
}));

// PUT /api/clients/:id - Update client
router.put('/:id', authenticateToken, userRateLimit(), validateParams('id'), validateBody(updateClientSchema), createClientsRouteHandler('Error updating client', 'Failed to update client', async (req, res) => {
    try {
        const { id } = req.params;
        const accessibleClient = await getAccessibleClientRecord(req, res, id);
        if (!accessibleClient) {
            return;
        }

        const { client: existing, isAdmin } = accessibleClient;

        const normalizedClient = normalizeClientPayload(req.body);
        const { name, type, status, address, website, industry, notes, firm_id } = normalizedClient;
        if (name !== undefined && String(name).length > 255) {
            return res.status(400).json({ error: 'Client name is too long' });
        }

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
        throw error;
    }
}));

// DELETE /api/clients/:id - Delete client
router.delete('/:id', authenticateToken, validateParams('id'), createClientsRouteHandler('Error deleting client', 'Failed to delete client', async (req, res) => {
        const { id } = req.params;
        const accessibleClient = await getAccessibleClientRecord(req, res, id);
        if (!accessibleClient) {
            return;
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
}));

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

    const { userFirmId, isAdmin, access } = await getClientAccessContext(req);
    if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return { ok: false };
    }
    if (!isAdmin && clientFirm.firm_id !== userFirmId) {
        res.status(403).json({ error: 'Access denied' });
        return { ok: false };
    }

    return { ok: true };
}

// GET /api/clients/:clientId/contacts - Get all contacts for a client
router.get('/:clientId/contacts', authenticateToken, validateParams('clientId'), createClientsRouteHandler('Error fetching contacts', 'Failed to fetch contacts', async (req, res) => {
        const { clientId } = req.params;
        const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';
        const access = await checkClientAccess(req, res, clientId);
        if (!access.ok) return;

        const contacts = await clientsService.listContacts(clientId, { bypassCache });
        return res.json(contacts);
}));

// POST /api/clients/:clientId/contacts - Create contact
router.post('/:clientId/contacts', authenticateToken, validateParams('clientId'), userRateLimit(), validateBody(createContactSchema), createClientsRouteHandler('Error creating contact', 'Failed to create contact', async (req, res) => {
        const { clientId } = req.params;
        const access = await checkClientAccess(req, res, clientId);
        if (!access.ok) return;

        const normalizedContact = normalizeContactPayload(req.body);
        const { name, role, email, phone, is_primary } = normalizedContact;

        if (!name) {
            return res.status(400).json({ error: 'Contact name is required' });
        }

        const contact = await clientsService.createContact(clientId, { name, role, email, phone, is_primary });
        return res.status(201).json(contact);
}));

// PUT /api/clients/:clientId/contacts/:id - Update contact
router.put('/:clientId/contacts/:id', authenticateToken, validateParams('clientId', 'id'), userRateLimit(), validateBody(updateContactSchema), createClientsRouteHandler('Error updating contact', 'Failed to update contact', async (req, res) => {
        const { clientId, id } = req.params;
        const access = await checkClientAccess(req, res, clientId);
        if (!access.ok) return;

        const normalizedContact = normalizeContactPayload(req.body);
        const { name, role, email, phone, is_primary } = normalizedContact;

        const updated = await clientsService.updateContact(id, clientId, { name, role, email, phone, is_primary });

        if (!updated) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        return res.json(updated);
}));

// DELETE /api/clients/:clientId/contacts/:id - Delete contact
router.delete('/:clientId/contacts/:id', authenticateToken, validateParams('clientId', 'id'), createClientsRouteHandler('Error deleting contact', 'Failed to delete contact', async (req, res) => {
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
}));

export default router;
