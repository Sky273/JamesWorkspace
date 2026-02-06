// User service for managing users and customers
import { fetchWithAuth, createAuthOptions, createAuthOptionsWithCsrf } from './apiInterceptor';
import logger from './logger.frontend';

const userService = {
  async getAllCustomers() {
    try {
      const response = await fetchWithAuth('/api/customers?limit=100', createAuthOptions());
      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }
      const data = await response.json();
      // Handle paginated response
      const customers = data.data || data;
      logger.log('Fetched customers:', customers);
      return customers;
    } catch (error) {
      logger.error('Error fetching customers:', error);
      throw error;
    }
  },

  async getCustomersPaginated({ page = 1, pageSize = 12, search = '' } = {}) {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pageSize.toString());
      if (search) params.append('search', search);

      const response = await fetchWithAuth(`/api/customers?${params.toString()}`, createAuthOptions());
      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }
      const data = await response.json();
      
      // Handle paginated response
      if (data.data && data.pagination) {
        return {
          customers: data.data,
          pagination: data.pagination
        };
      }
      
      // Fallback for non-paginated response
      return {
        customers: Array.isArray(data) ? data : [],
        pagination: {
          page: 1,
          pageSize: Array.isArray(data) ? data.length : 0,
          totalCount: Array.isArray(data) ? data.length : 0,
          hasMore: false
        }
      };
    } catch (error) {
      logger.error('Error fetching paginated customers:', error);
      throw error;
    }
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

  async updateCustomer(customerId, customerData) {
    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });
      const response = await fetchWithAuth(`/api/customers/${customerId}`, authOptions);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update customer');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error updating customer:', error);
      throw error;
    }
  },

  async createCustomer(customerData) {
    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });
      const response = await fetchWithAuth('/api/customers', authOptions);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create customer');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error creating customer:', error);
      throw error;
    }
  },

  async deleteCustomer(customerId) {
    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'DELETE'
      });
      const response = await fetchWithAuth(`/api/customers/${customerId}`, authOptions);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete customer');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error deleting customer:', error);
      throw error;
    }
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
