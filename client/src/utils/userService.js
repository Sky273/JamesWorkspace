// User service for managing users and firms (formerly customers)
import { fetchWithAuth, createAuthOptions, createAuthOptionsWithCsrf } from './apiInterceptor';
import logger from './logger.frontend';

const userService = {
  // ============================================
  // FIRMS (formerly Customers)
  // ============================================
  async getAllFirms() {
    try {
      const response = await fetchWithAuth('/api/firms?limit=100', createAuthOptions());
      if (!response.ok) {
        throw new Error('Failed to fetch firms');
      }
      const data = await response.json();
      // Handle paginated response
      const firms = data.data || data;
      logger.log('Fetched firms:', firms);
      return firms;
    } catch (error) {
      logger.error('Error fetching firms:', error);
      throw error;
    }
  },

  // Backward compatibility alias
  async getAllCustomers() {
    return this.getAllFirms();
  },

  async getFirmsPaginated({ page = 1, pageSize = 12, search = '' } = {}) {
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
      
      // Handle paginated response
      if (data.data && data.pagination) {
        return {
          firms: data.data,
          pagination: data.pagination
        };
      }
      
      // Fallback for non-paginated response
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

  // Backward compatibility alias
  async getCustomersPaginated(options) {
    const result = await this.getFirmsPaginated(options);
    return {
      customers: result.firms,
      pagination: result.pagination
    };
  },

  async getAllUsers() {
    try {
      const response = await fetchWithAuth('/api/users?limit=100', createAuthOptions());
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      // Handle paginated response
      const users = data.data || data;
      logger.log('Fetched users:', users);
      return users;
    } catch (error) {
      logger.error('Error fetching users:', error);
      throw error;
    }
  },

  async getUsersPaginated({ page = 1, pageSize = 12, search = '', role = '', status = '' } = {}) {
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
      
      // Handle paginated response
      if (data.data && data.pagination) {
        return {
          users: data.data,
          pagination: data.pagination
        };
      }
      
      // Fallback for non-paginated response
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

  async createUser(userData) {
    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      const response = await fetchWithAuth('/api/auth/users', authOptions);
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

  async updateUser(userId, userData) {
    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      const response = await fetchWithAuth(`/api/auth/users/${userId}`, authOptions);
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

  async deleteUser(userId) {
    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'DELETE'
      });
      const response = await fetchWithAuth(`/api/auth/users/${userId}`, authOptions);
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

  async updateFirm(firmId, firmData) {
    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(firmData)
      });
      const response = await fetchWithAuth(`/api/firms/${firmId}`, authOptions);
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

  // Backward compatibility alias
  async updateCustomer(customerId, customerData) {
    return this.updateFirm(customerId, customerData);
  },

  async createFirm(firmData) {
    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(firmData)
      });
      const response = await fetchWithAuth('/api/firms', authOptions);
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

  // Backward compatibility alias
  async createCustomer(customerData) {
    return this.createFirm(customerData);
  },

  async deleteFirm(firmId) {
    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'DELETE'
      });
      const response = await fetchWithAuth(`/api/firms/${firmId}`, authOptions);
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

  // Backward compatibility alias
  async deleteCustomer(customerId) {
    return this.deleteFirm(customerId);
  },

  async changeUserPassword(userId, newPassword) {
    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: newPassword })
      });
      const response = await fetchWithAuth(`/api/auth/users/${userId}/password`, authOptions);
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
