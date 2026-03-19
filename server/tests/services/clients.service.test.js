/**
 * Tests for Clients Service
 * Tests CRUD operations for clients and contacts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../utils/postgresHelpers.js', () => ({
    escapeLike: vi.fn((str) => str.replace(/[%_\\]/g, '\\$&'))
}));

// Import after mocks
import { query } from '../../config/database.js';
import {
    listClients,
    listIndustries,
    getClientById,
    validateFirm,
    createClient,
    findClient,
    updateClient,
    countClientSubmissions,
    deleteClient,
    getClientFirmId,
    listContacts,
    createContact,
    updateContact,
    countContactSubmissions,
    deleteContact
} from '../../services/clients.service.js';

describe('Clients Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ============================================
    // CLIENTS
    // ============================================

    describe('listClients', () => {
        it('should return paginated clients without filters', async () => {
            const mockClients = [
                { id: '1', name: 'Client A' },
                { id: '2', name: 'Client B' }
            ];
            query
                .mockResolvedValueOnce({ rows: mockClients }) // data query
                .mockResolvedValueOnce({ rows: [{ count: '2' }] }); // count query (page 1)

            const result = await listClients({ page: 1, limit: 20 });

            expect(result.data).toEqual(mockClients);
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.hasMore).toBe(false);
            expect(result.pagination.totalCount).toBe(2);
        });

        it('should apply firm filter', async () => {
            query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] });

            await listClients({ page: 1, limit: 20, firmId: 'firm-1' });

            const callArgs = query.mock.calls[0];
            expect(callArgs[0]).toContain('firm_id = $1');
            expect(callArgs[1]).toContain('firm-1');
        });

        it('should apply search filter', async () => {
            query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] });

            await listClients({ page: 1, limit: 20, search: 'test' });

            const callArgs = query.mock.calls[0];
            expect(callArgs[0]).toContain('LOWER(name) LIKE');
            expect(callArgs[1]).toContain('%test%');
        });

        it('should apply type filter for valid types', async () => {
            query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] });

            await listClients({ page: 1, limit: 20, type: 'client' });

            const callArgs = query.mock.calls[0];
            expect(callArgs[0]).toContain('type = $');
            expect(callArgs[1]).toContain('client');
        });

        it('should not apply type filter for invalid types', async () => {
            query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] });

            await listClients({ page: 1, limit: 20, type: 'invalid' });

            const callArgs = query.mock.calls[0];
            expect(callArgs[0]).not.toContain('type = $');
        });

        it('should detect hasMore when results exceed limit', async () => {
            const mockClients = Array(21).fill(null).map((_, i) => ({ id: `${i}`, name: `Client ${i}` }));
            query.mockResolvedValueOnce({ rows: mockClients }); // 21 items = hasMore

            const result = await listClients({ page: 2, limit: 20 });

            expect(result.data.length).toBe(20); // popped extra item
            expect(result.pagination.hasMore).toBe(true);
            expect(result.pagination.totalCount).toBeNull(); // no count on page > 1
        });

        it('should skip count query on pages > 1', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await listClients({ page: 2, limit: 20 });

            expect(query).toHaveBeenCalledTimes(1); // only data query
            expect(result.pagination.totalCount).toBeNull();
        });
    });

    describe('listIndustries', () => {
        it('should return sorted industry names', async () => {
            query.mockResolvedValueOnce({ rows: [{ canonical_name: 'Finance' }, { canonical_name: 'IT' }] });

            const result = await listIndustries();

            expect(result).toEqual(['Finance', 'IT']);
            expect(query.mock.calls[0][0]).toContain('industry_aliases');
        });
    });

    describe('getClientById', () => {
        it('should return client with contacts and submissions', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: '1', name: 'Client A', firm_name: 'Firm' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'c1', name: 'Contact 1' }] })
                .mockResolvedValueOnce({ rows: [{ id: 's1', resume_name: 'Resume 1' }] });

            const result = await getClientById('1');

            expect(result.id).toBe('1');
            expect(result.contacts).toHaveLength(1);
            expect(result.recentSubmissions).toHaveLength(1);
        });

        it('should return null if client not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await getClientById('999');

            expect(result).toBeNull();
            expect(query).toHaveBeenCalledTimes(1); // no follow-up queries
        });
    });

    describe('validateFirm', () => {
        it('should return firm data if found', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'f1', name: 'Firm A' }] });

            const result = await validateFirm('f1');

            expect(result).toEqual({ id: 'f1', name: 'Firm A' });
        });

        it('should return null if firm not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await validateFirm('missing');

            expect(result).toBeNull();
        });
    });

    describe('createClient', () => {
        it('should create a client with all fields', async () => {
            const created = { id: '1', name: 'New Client', type: 'client', status: 'active' };
            query.mockResolvedValueOnce({ rows: [created] });

            const result = await createClient({
                firmId: 'f1', name: 'New Client', type: 'client', status: 'active',
                address: '123 St', website: 'https://example.com', industry: 'IT',
                notes: 'Some notes', createdBy: 'user-1'
            });

            expect(result).toEqual(created);
            expect(query.mock.calls[0][0]).toContain('INSERT INTO clients');
        });

        it('should use defaults for optional fields', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: '1', type: 'prospect', status: 'active' }] });

            await createClient({ firmId: 'f1', name: 'Minimal' });

            const params = query.mock.calls[0][1];
            expect(params[2]).toBe('prospect'); // default type
            expect(params[3]).toBe('active');   // default status
            expect(params[4]).toBeNull();       // address
        });
    });

    describe('findClient', () => {
        it('should return client if found', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: '1', name: 'Found' }] });
            expect(await findClient('1')).toEqual({ id: '1', name: 'Found' });
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await findClient('999')).toBeNull();
        });
    });

    describe('updateClient', () => {
        it('should update client and return result', async () => {
            const updated = { id: '1', name: 'Updated' };
            query.mockResolvedValueOnce({ rows: [updated] });

            const result = await updateClient('1', { name: 'Updated', type: 'client' });

            expect(result).toEqual(updated);
            expect(query.mock.calls[0][0]).toContain('UPDATE clients');
        });
    });

    describe('countClientSubmissions', () => {
        it('should return submission count', async () => {
            query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

            const result = await countClientSubmissions('1');

            expect(result).toBe(5);
        });
    });

    describe('deleteClient', () => {
        it('should delete a client', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await deleteClient('1');

            expect(query.mock.calls[0][0]).toContain('DELETE FROM clients');
            expect(query.mock.calls[0][1]).toEqual(['1']);
        });
    });

    // ============================================
    // CONTACTS
    // ============================================

    describe('getClientFirmId', () => {
        it('should return firm_id for existing client', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });
            expect(await getClientFirmId('1')).toEqual({ firm_id: 'f1' });
        });

        it('should return null if client not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getClientFirmId('999')).toBeNull();
        });
    });

    describe('listContacts', () => {
        it('should return contacts for a client ordered by primary', async () => {
            const contacts = [{ id: 'c1', is_primary: true }, { id: 'c2', is_primary: false }];
            query.mockResolvedValueOnce({ rows: contacts });

            const result = await listContacts('client-1');

            expect(result).toEqual(contacts);
            expect(query.mock.calls[0][1]).toEqual(['client-1']);
        });
    });

    describe('createContact', () => {
        it('should create a contact', async () => {
            const contact = { id: 'c1', name: 'John', client_id: 'cl1' };
            query.mockResolvedValueOnce({ rows: [contact] });

            const result = await createContact('cl1', { name: 'John', email: 'john@test.com' });

            expect(result).toEqual(contact);
            expect(query.mock.calls[0][0]).toContain('INSERT INTO client_contacts');
        });

        it('should unset other primaries when creating a primary contact', async () => {
            query
                .mockResolvedValueOnce({ rows: [] }) // unset primaries
                .mockResolvedValueOnce({ rows: [{ id: 'c1', is_primary: true }] }); // insert

            await createContact('cl1', { name: 'Primary', is_primary: true });

            expect(query).toHaveBeenCalledTimes(2);
            expect(query.mock.calls[0][0]).toContain('UPDATE client_contacts SET is_primary = false');
        });
    });

    describe('updateContact', () => {
        it('should update a contact', async () => {
            const updated = { id: 'c1', name: 'Updated' };
            query.mockResolvedValueOnce({ rows: [updated] });

            const result = await updateContact('c1', 'cl1', { name: 'Updated' });

            expect(result).toEqual(updated);
        });

        it('should unset other primaries when setting as primary', async () => {
            query
                .mockResolvedValueOnce({ rows: [] }) // unset primaries
                .mockResolvedValueOnce({ rows: [{ id: 'c1', is_primary: true }] }); // update

            await updateContact('c1', 'cl1', { name: 'Primary', is_primary: true });

            expect(query).toHaveBeenCalledTimes(2);
            expect(query.mock.calls[0][0]).toContain('is_primary = false');
        });

        it('should return null if contact not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await updateContact('missing', 'cl1', { name: 'X' });

            expect(result).toBeNull();
        });
    });

    describe('countContactSubmissions', () => {
        it('should return submission count for contact', async () => {
            query.mockResolvedValueOnce({ rows: [{ count: '3' }] });
            expect(await countContactSubmissions('c1')).toBe(3);
        });
    });

    describe('deleteContact', () => {
        it('should return true when contact deleted', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
            expect(await deleteContact('c1', 'cl1')).toBe(true);
        });

        it('should return false when contact not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await deleteContact('missing', 'cl1')).toBe(false);
        });
    });
});
