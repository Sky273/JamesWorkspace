/**
 * Client service for managing clients, contacts, and submissions
 */

import { fetchWithAuth, createAuthOptions, authPost, authPut, authDelete } from './apiInterceptor';
import logger from './logger.frontend';

// Types
type ClientType = 'client' | 'prospect';
type ClientStatus = 'active' | 'inactive';
type SubmissionStatus = 'sent' | 'viewed' | 'rejected' | 'accepted' | 'pending';

export interface Client {
    id: string;
    name: string;
    type: ClientType;
    status?: ClientStatus;
    address?: string;
    website?: string;
    industry?: string;
    notes?: string;
    firmId?: string;
    firm_id?: string;
    firm_name?: string;
    created_by?: string;
    contacts_count?: number;
    submissions_count?: number;
    createdAt?: string;
    created_at?: string;
    updatedAt?: string;
    updated_at?: string;
    contacts?: Contact[];
    recentSubmissions?: Submission[];
}

export interface Contact {
    id: string;
    clientId: string;
    client_id: string;
    name: string;
    email: string;
    role?: string;
    phone?: string;
    is_primary: boolean;
    createdAt?: string;
    updatedAt?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Submission {
    id: string;
    resumeId: string;
    resume_id?: string;
    clientId: string;
    client_id?: string;
    contactId?: string;
    contact_id?: string;
    missionId?: string;
    mission_id?: string;
    status: SubmissionStatus;
    notes?: string;
    sentAt?: string;
    sent_at?: string;
    createdAt?: string;
    created_at?: string;
    resume_name?: string;
    resume_title?: string;
    contact_name?: string;
    mission_title?: string;
    sent_by_name?: string;
    version_number?: number;
}

function normalizeContact(contact: Partial<Contact> | null | undefined): Contact {
    return {
        id: contact?.id || '',
        clientId: contact?.clientId || contact?.client_id || '',
        client_id: contact?.client_id || contact?.clientId || '',
        name: contact?.name || '',
        email: contact?.email || '',
        role: contact?.role || '',
        phone: contact?.phone || '',
        is_primary: Boolean(contact?.is_primary),
        createdAt: contact?.createdAt || contact?.created_at,
        updatedAt: contact?.updatedAt || contact?.updated_at,
        created_at: contact?.created_at || contact?.createdAt,
        updated_at: contact?.updated_at || contact?.updatedAt,
    };
}

function normalizeSubmission(submission: Partial<Submission> | null | undefined): Submission {
    return {
        id: submission?.id || '',
        resumeId: submission?.resumeId || submission?.resume_id || '',
        resume_id: submission?.resume_id || submission?.resumeId || '',
        clientId: submission?.clientId || submission?.client_id || '',
        client_id: submission?.client_id || submission?.clientId || '',
        contactId: submission?.contactId || submission?.contact_id,
        contact_id: submission?.contact_id || submission?.contactId,
        missionId: submission?.missionId || submission?.mission_id,
        mission_id: submission?.mission_id || submission?.missionId,
        status: submission?.status || 'pending',
        notes: submission?.notes,
        sentAt: submission?.sentAt || submission?.sent_at,
        sent_at: submission?.sent_at || submission?.sentAt,
        createdAt: submission?.createdAt || submission?.created_at,
        created_at: submission?.created_at || submission?.createdAt,
        resume_name: submission?.resume_name,
        resume_title: submission?.resume_title,
        contact_name: submission?.contact_name,
        mission_title: submission?.mission_title,
        sent_by_name: submission?.sent_by_name,
        version_number: submission?.version_number,
    };
}

function normalizeClient(client: Partial<Client> | null | undefined): Client {
    return {
        id: client?.id || '',
        name: client?.name || '',
        type: (client?.type as Client['type']) || 'prospect',
        address: client?.address,
        website: client?.website,
        industry: client?.industry,
        status: client?.status,
        notes: client?.notes,
        firmId: client?.firmId || client?.firm_id,
        firm_id: client?.firm_id || client?.firmId,
        created_by: (client as Client & { created_by?: string })?.created_by,
        firm_name: (client as Client & { firm_name?: string })?.firm_name,
        contacts_count: (client as Client & { contacts_count?: number }).contacts_count,
        submissions_count: (client as Client & { submissions_count?: number }).submissions_count,
        createdAt: client?.createdAt || client?.created_at,
        created_at: client?.created_at || client?.createdAt,
        updatedAt: client?.updatedAt || client?.updated_at,
        updated_at: client?.updated_at || client?.updatedAt,
        contacts: Array.isArray(client?.contacts) ? client.contacts.map(normalizeContact) : undefined,
        recentSubmissions: Array.isArray(client?.recentSubmissions) ? client.recentSubmissions.map(normalizeSubmission) : undefined,
    };
}

export interface Pagination {
    page: number;
    pageSize: number;
    totalCount: number;
    hasMore: boolean;
}

export interface GetClientsParams {
    page?: number;
    pageSize?: number;
    search?: string;
    type?: string;
    forceRefresh?: boolean;
}

export interface GetSubmissionsParams {
    page?: number;
    pageSize?: number;
    clientId?: string;
    resumeId?: string;
    missionId?: string;
    status?: string;
}

const clientService = {
    // ============================================
    // CLIENTS
    // ============================================
    
    async getClients({ page = 1, pageSize = 20, search = '', type = '', forceRefresh = false }: GetClientsParams = {}): Promise<{ clients: Client[]; pagination: Pagination }> {
        try {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('limit', pageSize.toString());
            if (search) params.append('search', search);
            if (type) params.append('type', type);
            if (forceRefresh) params.append('refresh', '1');

            const response = await fetchWithAuth(`/api/clients?${params.toString()}`, createAuthOptions());
            if (!response.ok) {
                throw new Error('Failed to fetch clients');
            }
            const data = await response.json();
            
            return {
                clients: (data.data || []).map(normalizeClient),
                pagination: data.pagination || {
                    page: 1,
                    pageSize: data.data?.length || 0,
                    totalCount: data.data?.length || 0,
                    hasMore: false
                }
            };
        } catch (error) {
            logger.error('Error fetching clients:', error);
            throw error;
        }
    },

    async getClient(id: string, options: { forceRefresh?: boolean } = {}): Promise<Client> {
        try {
            const params = new URLSearchParams();
            if (options.forceRefresh) params.append('refresh', '1');
            const suffix = params.size > 0 ? `?${params.toString()}` : '';
            const response = await fetchWithAuth(`/api/clients/${id}${suffix}`, createAuthOptions());
            if (!response.ok) {
                throw new Error('Failed to fetch client');
            }
            return normalizeClient(await response.json());
        } catch (error) {
            logger.error('Error fetching client:', error);
            throw error;
        }
    },

    async createClient(clientData: Partial<Client>): Promise<Client> {
        try {
            const response = await authPost('/api/clients', clientData);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create client');
            }
            return normalizeClient(await response.json());
        } catch (error) {
            logger.error('Error creating client:', error);
            throw error;
        }
    },

    async updateClient(id: string, clientData: Partial<Client>): Promise<Client> {
        try {
            const response = await authPut(`/api/clients/${id}`, clientData);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update client');
            }
            return normalizeClient(await response.json());
        } catch (error) {
            logger.error('Error updating client:', error);
            throw error;
        }
    },

    async deleteClient(id: string): Promise<{ success: boolean }> {
        try {
            const response = await authDelete(`/api/clients/${id}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete client');
            }
            return await response.json();
        } catch (error) {
            logger.error('Error deleting client:', error);
            throw error;
        }
    },

    // ============================================
    // CONTACTS
    // ============================================

    async getContacts(clientId: string, options: { forceRefresh?: boolean } = {}): Promise<Contact[]> {
        try {
            const suffix = options.forceRefresh ? '?refresh=1' : '';
            const response = await fetchWithAuth(`/api/clients/${clientId}/contacts${suffix}`, createAuthOptions());
            if (!response.ok) {
                throw new Error('Failed to fetch contacts');
            }
            return (await response.json()).map(normalizeContact);
        } catch (error) {
            logger.error('Error fetching contacts:', error);
            throw error;
        }
    },

    async createContact(clientId: string, contactData: Partial<Contact>): Promise<Contact> {
        try {
            const response = await authPost(`/api/clients/${clientId}/contacts`, contactData);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create contact');
            }
            return normalizeContact(await response.json());
        } catch (error) {
            logger.error('Error creating contact:', error);
            throw error;
        }
    },

    async updateContact(clientId: string, contactId: string, contactData: Partial<Contact>): Promise<Contact> {
        try {
            const response = await authPut(`/api/clients/${clientId}/contacts/${contactId}`, contactData);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update contact');
            }
            return normalizeContact(await response.json());
        } catch (error) {
            logger.error('Error updating contact:', error);
            throw error;
        }
    },

    async deleteContact(clientId: string, contactId: string): Promise<{ success: boolean }> {
        try {
            const response = await authDelete(`/api/clients/${clientId}/contacts/${contactId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete contact');
            }
            return await response.json();
        } catch (error) {
            logger.error('Error deleting contact:', error);
            throw error;
        }
    },

    // ============================================
    // SUBMISSIONS
    // ============================================

    async getSubmissions({ page = 1, pageSize = 20, clientId = '', resumeId = '', missionId = '', status = '' }: GetSubmissionsParams = {}): Promise<{ submissions: Submission[]; pagination: Pagination }> {
        try {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('limit', pageSize.toString());
            if (clientId) params.append('clientId', clientId);
            if (resumeId) params.append('resumeId', resumeId);
            if (missionId) params.append('missionId', missionId);
            if (status) params.append('status', status);

            const response = await fetchWithAuth(`/api/submissions?${params.toString()}`, createAuthOptions());
            if (!response.ok) {
                throw new Error('Failed to fetch submissions');
            }
            const data = await response.json();
            
            return {
                submissions: data.data || [],
                pagination: data.pagination || {
                    page: 1,
                    pageSize: data.data?.length || 0,
                    totalCount: data.data?.length || 0,
                    hasMore: false
                }
            };
        } catch (error) {
            logger.error('Error fetching submissions:', error);
            throw error;
        }
    },

    async getSubmission(id: string): Promise<Submission> {
        try {
            const response = await fetchWithAuth(`/api/submissions/${id}`, createAuthOptions());
            if (!response.ok) {
                throw new Error('Failed to fetch submission');
            }
            return await response.json();
        } catch (error) {
            logger.error('Error fetching submission:', error);
            throw error;
        }
    },

    async createSubmission(submissionData: Partial<Submission>): Promise<Submission> {
        try {
            const response = await authPost('/api/submissions', submissionData);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create submission');
            }
            return await response.json();
        } catch (error) {
            logger.error('Error creating submission:', error);
            throw error;
        }
    },

    async updateSubmission(id: string, submissionData: Partial<Submission>): Promise<Submission> {
        try {
            const response = await authPut(`/api/submissions/${id}`, submissionData);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update submission');
            }
            return await response.json();
        } catch (error) {
            logger.error('Error updating submission:', error);
            throw error;
        }
    },

    async deleteSubmission(id: string): Promise<{ success: boolean }> {
        try {
            const response = await authDelete(`/api/submissions/${id}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete submission');
            }
            return await response.json();
        } catch (error) {
            logger.error('Error deleting submission:', error);
            throw error;
        }
    },

    async getSubmissionStats(): Promise<Record<string, unknown>> {
        try {
            const response = await fetchWithAuth('/api/submissions/stats/summary', createAuthOptions());
            if (!response.ok) {
                throw new Error('Failed to fetch submission stats');
            }
            return await response.json();
        } catch (error) {
            logger.error('Error fetching submission stats:', error);
            throw error;
        }
    },

    // ============================================
    // INDUSTRIES
    // ============================================

    async getIndustries(): Promise<string[]> {
        try {
            const response = await fetchWithAuth('/api/clients/industries/list', createAuthOptions());
            if (!response.ok) {
                throw new Error('Failed to fetch industries');
            }
            return await response.json();
        } catch (error) {
            logger.error('Error fetching industries:', error);
            throw error;
        }
    }
};

export default clientService;
