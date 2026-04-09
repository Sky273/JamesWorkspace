/**
 * User Service
 * TypeScript service for managing users and firms
 */

import { authDelete, authPost, authPut, fetchWithAuth, createAuthOptions, fetchCsrfToken } from './apiInterceptor';
import logger from './logger.frontend';

// ============================================
// TYPES
// ============================================

interface Firm {
  id: string;
  name: string;
  status?: string;
  logo_url?: string;
  created_at?: string;
  updated_at?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  jobTitle?: string;
  job_title?: string;
  phone?: string;
  role?: string;
  status?: string;
  firmId?: string;
  firm?: string;
  firmName?: string;
  firm_name?: string;
}

interface Pagination {
  page: number;
  pageSize?: number;
  limit?: number;
  totalCount: number | null;
  hasMore: boolean;
  nextPage?: number | null;
}

interface PaginatedFirmsResponse {
  firms: Firm[];
  pagination: Pagination;
}

interface PaginatedUsersResponse {
  users: User[];
  pagination: Pagination;
}

interface FirmFormData {
  name?: string;
  status?: string;
  logo_url?: string;
}

interface UserFormData {
  name?: string;
  email?: string;
  password?: string;
  jobTitle?: string;
  phone?: string;
  firmId?: string;
  role?: string;
  status?: string;
}

interface UploadLogoResponse {
  success: boolean;
  logo_url: string;
  message: string;
}

// ============================================
// SERVICE
// ============================================

const userService = {
  // ============================================
  // FIRMS (formerly Customers)
  // ============================================
  async getAllFirms(): Promise<Firm[]> {
    try {
      const response = await fetchWithAuth('/api/firms?limit=100', createAuthOptions());
      if (!response.ok) {
        throw new Error('Failed to fetch firms');
      }
      const data = await response.json();
      const firms = data.data || data;
      logger.log('Fetched firms:', firms);
      return firms;
    } catch (error) {
      logger.error('Error fetching firms:', error);
      throw error;
    }
  },

  async getAllCustomers(): Promise<Firm[]> {
    return this.getAllFirms();
  },

  async getFirmsPaginated({ page = 1, pageSize = 12, search = '' } = {}): Promise<PaginatedFirmsResponse> {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pageSize.toString());
      if (search) params.append('search', search);

      const response = await fetchWithAuth(`/api/firms?${params.toString()}`, createAuthOptions());
      if (!response.ok) {
        throw new Error('Failed to fetch firms');
      }
      const data = await response.json();
      
      if (data.data && data.pagination) {
        return {
          firms: data.data,
          pagination: data.pagination
        };
      }
      
      return {
        firms: Array.isArray(data) ? data : [],
        pagination: {
          page: 1,
          pageSize: Array.isArray(data) ? data.length : 0,
          totalCount: Array.isArray(data) ? data.length : 0,
          hasMore: false
        }
      };
    } catch (error) {
      logger.error('Error fetching paginated firms:', error);
      throw error;
    }
  },

  async getCustomersPaginated(options?: { page?: number; pageSize?: number; search?: string }): Promise<{ customers: Firm[]; pagination: Pagination }> {
    const result = await this.getFirmsPaginated(options);
    return {
      customers: result.firms,
      pagination: result.pagination
    };
  },

  async getAllUsers(): Promise<User[]> {
    try {
      const response = await fetchWithAuth('/api/users?limit=100', createAuthOptions());
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      const users = data.data || data;
      logger.log('Fetched users:', users);
      return users;
    } catch (error) {
      logger.error('Error fetching users:', error);
      throw error;
    }
  },

  async getUsersPaginated({ page = 1, pageSize = 12, search = '', role = '', status = '' } = {}): Promise<PaginatedUsersResponse> {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pageSize.toString());
      if (search) params.append('search', search);
      if (role) params.append('role', role);
      if (status) params.append('status', status);

      const response = await fetchWithAuth(`/api/users?${params.toString()}`, createAuthOptions());
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      
      if (data.data && data.pagination) {
        return {
          users: data.data,
          pagination: data.pagination
        };
      }
      
      return {
        users: Array.isArray(data) ? data : [],
        pagination: {
          page: 1,
          pageSize: Array.isArray(data) ? data.length : 0,
          totalCount: Array.isArray(data) ? data.length : 0,
          hasMore: false
        }
      };
    } catch (error) {
      logger.error('Error fetching paginated users:', error);
      throw error;
    }
  },

  async createUser(userData: UserFormData): Promise<User> {
    try {
      const response = await authPost('/api/auth/users', userData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create user');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  },

  async updateUser(userId: string, userData: UserFormData): Promise<User> {
    try {
      const response = await authPut(`/api/auth/users/${userId}`, userData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  },

  async deleteUser(userId: string): Promise<{ message: string }> {
    try {
      const response = await authDelete(`/api/auth/users/${userId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  },

  async updateFirm(firmId: string, firmData: FirmFormData): Promise<Firm> {
    try {
      const response = await authPut(`/api/firms/${firmId}`, firmData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update firm');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error updating firm:', error);
      throw error;
    }
  },

  async updateCustomer(customerId: string, customerData: FirmFormData): Promise<Firm> {
    return this.updateFirm(customerId, customerData);
  },

  async createFirm(firmData: FirmFormData): Promise<Firm> {
    try {
      const response = await authPost('/api/firms', firmData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create firm');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error creating firm:', error);
      throw error;
    }
  },

  async createCustomer(customerData: FirmFormData): Promise<Firm> {
    return this.createFirm(customerData);
  },

  async deleteFirm(firmId: string): Promise<{ message: string }> {
    try {
      const response = await authDelete(`/api/firms/${firmId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete firm');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error deleting firm:', error);
      throw error;
    }
  },

  async deleteCustomer(customerId: string): Promise<{ message: string }> {
    return this.deleteFirm(customerId);
  },

  async uploadFirmLogo(firmId: string, file: File): Promise<UploadLogoResponse> {
    try {
      const formData = new FormData();
      formData.append('logo', file);
      
      // Get CSRF token for multipart request
      const csrfToken = await fetchCsrfToken();
      
      const response = await fetchWithAuth(`/api/firms/${firmId}/logo`, {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken
        },
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload logo');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error uploading firm logo:', error);
      throw error;
    }
  },

  async deleteFirmLogo(firmId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await authDelete(`/api/firms/${firmId}/logo`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete logo');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error deleting firm logo:', error);
      throw error;
    }
  },

  async changeUserPassword(userId: string, newPassword: string): Promise<{ message: string }> {
    try {
      const response = await authPut(`/api/auth/users/${userId}/password`, { password: newPassword });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change password');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error changing password:', error);
      throw error;
    }
  },
};

export default userService;
