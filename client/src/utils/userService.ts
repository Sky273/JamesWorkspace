/**
 * User Service
 * TypeScript service for managing users and firms
 */

import { authDelete, authPost, authPut, fetchWithAuth, createAuthOptions, fetchCsrfToken } from './apiInterceptor';
import logger from './logger.frontend';

// ============================================
// TYPES
// ============================================

export interface Firm {
  id: string;
  name: string;
  status?: string;
  credits?: number;
  total_credits_consumed?: number;
  total_credits_added?: number;
  last_credit_activity_at?: string | null;
  top_consumers?: Array<{
    user_id?: string | null;
    user_name: string;
    credits_consumed: number;
    action_count: number;
    last_used_at?: string | null;
  }>;
  recent_credit_transactions?: Array<{
    id: string;
    user_id?: string | null;
    user_name: string;
    action_type: string;
    credits_delta: number;
    balance_after: number;
    created_at: string;
  }>;
  logo_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FirmCreditSummary {
  transaction_count: number;
  total_credits_consumed: number;
  total_credits_added: number;
  total_credits_refunded: number;
  last_credit_activity_at?: string | null;
}

export interface FirmCreditBreakdownItem {
  user_id?: string | null;
  user_name?: string;
  action_type?: string;
  transaction_count: number;
  consumed_credits: number;
  added_credits: number;
  refunded_credits: number;
  net_credits: number;
  last_activity_at?: string | null;
  unique_user_count?: number;
}

export interface FirmCreditTransactionDetail {
  id: string;
  user_id?: string | null;
  user_name: string;
  action_type: string;
  credits_delta: number;
  balance_after: number;
  metadata?: Record<string, unknown>;
  related_transaction_id?: string | null;
  created_at: string;
}

export interface FirmCreditsDetailResponse {
  firm: Firm;
  summary: FirmCreditSummary;
  userBreakdown: FirmCreditBreakdownItem[];
  actionBreakdown: FirmCreditBreakdownItem[];
  userActionBreakdown: FirmCreditBreakdownItem[];
  recentTransactions: FirmCreditTransactionDetail[];
}

export interface StripeCreditPack {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  description: string;
  currency: string;
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
  firm_id?: string;
  firm?: string;
  firmName?: string;
  firm_name?: string;
  customerId?: string;
  customerName?: string;
  customer?: string;
  invitationSent?: boolean;
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

interface StripeCreditPacksResponse {
  enabled: boolean;
  currency: string;
  packs: StripeCreditPack[];
}

// ============================================
// SERVICE
// ============================================

const userService = {
  firstNonEmptyString(...values: Array<string | undefined>): string | undefined {
    return values.find((value) => typeof value === 'string' && value.length > 0);
  },

  normalizeUser(user: Partial<User> | null | undefined): User {
    const firmId = this.firstNonEmptyString(user?.firmId, user?.firm_id, user?.customerId);
    const firmName = this.firstNonEmptyString(user?.firmName, user?.firm_name, user?.firm, user?.customerName, user?.customer);

    return {
      id: user?.id || '',
      name: user?.name || '',
      email: user?.email || '',
      jobTitle: user?.jobTitle || user?.job_title,
      job_title: user?.job_title || user?.jobTitle,
      phone: user?.phone,
      role: user?.role,
      status: user?.status,
      firmId,
      firm_id: firmId,
      firm: firmName,
      firmName,
      firm_name: firmName,
      customerId: firmId,
      customerName: firmName,
      customer: firmName,
      invitationSent: user?.invitationSent
    };
  },
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
    return userService.getAllFirms();
  },

  async getFirmsPaginated({ page = 1, pageSize = 12, search = '', forceRefresh = false } = {}): Promise<PaginatedFirmsResponse> {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pageSize.toString());
      if (search) params.append('search', search);
      if (forceRefresh) params.append('refresh', '1');

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

  async getCustomersPaginated(options?: { page?: number; pageSize?: number; search?: string; forceRefresh?: boolean }): Promise<{ customers: Firm[]; pagination: Pagination }> {
    const result = await this.getFirmsPaginated(options);
    return {
      customers: result.firms,
      pagination: result.pagination
    };
  },

  async getFirmCreditsPaginated({ page = 1, pageSize = 12, search = '', forceRefresh = false } = {}): Promise<PaginatedFirmsResponse> {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pageSize.toString());
      if (search) params.append('search', search);
      if (forceRefresh) params.append('refresh', '1');

      const response = await fetchWithAuth(`/api/firms/credits?${params.toString()}`, createAuthOptions());
      if (!response.ok) {
        throw new Error('Failed to fetch firm credits');
      }

      const data = await response.json();
      return {
        firms: data.data || [],
        pagination: data.pagination || {
          page,
          pageSize,
          totalCount: Array.isArray(data.data) ? data.data.length : 0,
          hasMore: false,
        }
      };
    } catch (error) {
      logger.error('Error fetching firm credits:', error);
      throw error;
    }
  },

  async getFirmCreditsDetail(firmId: string): Promise<FirmCreditsDetailResponse> {
    try {
      const response = await fetchWithAuth(`/api/firms/${firmId}/credits/detail`, createAuthOptions());
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch firm credit detail');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error fetching firm credit detail:', error);
      throw error;
    }
  },

  async getAllUsers(): Promise<User[]> {
    try {
      const response = await fetchWithAuth('/api/users?limit=100', createAuthOptions());
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      const users = (data.data || data).map((user: User) => userService.normalizeUser(user));
      logger.log('Fetched users:', users);
      return users;
    } catch (error) {
      logger.error('Error fetching users:', error);
      throw error;
    }
  },

  async getUsersPaginated({ page = 1, pageSize = 12, search = '', role = '', status = '', forceRefresh = false } = {}): Promise<PaginatedUsersResponse> {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pageSize.toString());
      if (search) params.append('search', search);
      if (role) params.append('role', role);
      if (status) params.append('status', status);
      if (forceRefresh) params.append('refresh', '1');

      const response = await fetchWithAuth(`/api/users?${params.toString()}`, createAuthOptions());
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      
      if (data.data && data.pagination) {
        return {
          users: data.data.map((user: User) => userService.normalizeUser(user)),
          pagination: data.pagination
        };
      }
      
      return {
        users: Array.isArray(data) ? data.map((user: User) => userService.normalizeUser(user)) : [],
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
      return userService.normalizeUser(await response.json());
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
      return userService.normalizeUser(await response.json());
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
    return userService.updateFirm(customerId, customerData);
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
    return userService.createFirm(customerData);
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
    return userService.deleteFirm(customerId);
  },

  async addFirmCredits(firmId: string, amount: number): Promise<Firm> {
    try {
      const response = await authPost(`/api/firms/${firmId}/credits`, { amount });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add firm credits');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error adding firm credits:', error);
      throw error;
    }
  },

  async getStripeCreditPacks(): Promise<StripeCreditPacksResponse> {
    try {
      const response = await fetchWithAuth('/api/billing/stripe/credit-packs', createAuthOptions());
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch Stripe credit packs');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error fetching Stripe credit packs:', error);
      throw error;
    }
  },

  async createStripeCheckoutSession(packId: string): Promise<{ id: string; url: string }> {
    try {
      const response = await authPost('/api/billing/stripe/checkout-session', { packId });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create Stripe checkout session');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error creating Stripe checkout session:', error);
      throw error;
    }
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

  async forcePasswordReset(userId: string): Promise<{ message: string; success?: boolean }> {
    try {
      const response = await authPost(`/api/auth/users/${userId}/force-password-reset`, {});
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to force password reset');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error forcing password reset:', error);
      throw error;
    }
  },
};

export default userService;
