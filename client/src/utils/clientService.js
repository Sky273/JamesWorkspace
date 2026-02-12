// Client service for managing clients, contacts, and submissions
import { fetchWithAuth, createAuthOptions, authPost, authPut, authDelete } from './apiInterceptor';
import logger from './logger.frontend';

const clientService = {
  // ============================================
  // CLIENTS
  // ============================================
  
  async getClients({ page = 1, pageSize = 20, search = '', type = '' } = {}) {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pageSize.toString());
      if (search) params.append('search', search);
      if (type) params.append('type', type);

      const response = await fetchWithAuth(`/api/clients?${params.toString()}`, createAuthOptions());
      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }
      const data = await response.json();
      
      return {
        clients: data.data || [],
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

  async getClient(id) {
    try {
      const response = await fetchWithAuth(`/api/clients/${id}`, createAuthOptions());
      if (!response.ok) {
        throw new Error('Failed to fetch client');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error fetching client:', error);
      throw error;
    }
  },

  async createClient(clientData) {
    try {
      const response = await authPost('/api/clients', clientData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create client');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error creating client:', error);
      throw error;
    }
  },

  async updateClient(id, clientData) {
    try {
      const response = await authPut(`/api/clients/${id}`, clientData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update client');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error updating client:', error);
      throw error;
    }
  },

  async deleteClient(id) {
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

  async getContacts(clientId) {
    try {
      const response = await fetchWithAuth(`/api/clients/${clientId}/contacts`, createAuthOptions());
      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error fetching contacts:', error);
      throw error;
    }
  },

  async createContact(clientId, contactData) {
    try {
      const response = await authPost(`/api/clients/${clientId}/contacts`, contactData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create contact');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error creating contact:', error);
      throw error;
    }
  },

  async updateContact(clientId, contactId, contactData) {
    try {
      const response = await authPut(`/api/clients/${clientId}/contacts/${contactId}`, contactData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update contact');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error updating contact:', error);
      throw error;
    }
  },

  async deleteContact(clientId, contactId) {
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

  async getSubmissions({ page = 1, pageSize = 20, clientId = '', resumeId = '', missionId = '', status = '' } = {}) {
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

  async getSubmission(id) {
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

  async createSubmission(submissionData) {
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

  async updateSubmission(id, submissionData) {
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

  async deleteSubmission(id) {
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

  async getSubmissionStats() {
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

  async getIndustries() {
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
