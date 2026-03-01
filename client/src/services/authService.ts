/**
 * Authentication Service
 * TypeScript version with full type safety
 */

import { clearCsrfToken, resetSessionState } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';

// ============================================
// TYPES
// ============================================

export interface User {
  id: string;
  name: string;
  email: string;
  jobTitle?: string;
  phone?: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'Active' | 'Inactive' | 'Pending' | 'active' | 'inactive' | 'pending';
  firm?: string;
  FirmName?: string;
  FirmLogo?: string;
  // Google SSO fields
  google_id?: string;
  google_email?: string;
  // Legacy uppercase properties for backward compatibility
  Name?: string;
  Email?: string;
  Role?: 'admin' | 'user' | 'viewer';
  Status?: 'Active' | 'Inactive' | 'Pending';
  Firm?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
}

export interface SignInResponse {
  user?: User;
  requires2FA?: boolean;
  userId?: string;
  message?: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  jobTitle?: string;
  phone?: string;
  role?: string;
  status?: string;
  firm?: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  jobTitle?: string;
  phone?: string;
  role?: string;
  status?: string;
  firm?: string;
}

// ============================================
// CUSTOM ERROR
// ============================================

class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// ============================================
// AUTH SERVICE
// ============================================

// In-memory user cache (no localStorage for security)
let cachedUser: User | null = null;

export const authService = {
  async getCsrfToken(): Promise<string> {
    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token');
      }
      const data = await response.json();
      return data.csrfToken;
    } catch (error) {
      logger.error('Error fetching CSRF token:', error);
      throw error;
    }
  },

  async signIn(email: string, password: string, totpCode?: string): Promise<User | SignInResponse> {
    try {
      const csrfToken = await this.getCsrfToken();

      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ email, password, totpCode })
      });

      const data = await response.json();

      // Check if 2FA is required
      if (data.requires2FA) {
        return {
          requires2FA: true,
          userId: data.userId,
          message: data.message
        } as SignInResponse;
      }

      if (!response.ok) {
        throw new AuthenticationError(data.error || 'Failed to sign in');
      }

      cachedUser = data.user as User;
      
      // Reset session state on successful login (clears isSessionExpiring flag)
      resetSessionState();
      
      return cachedUser;
    } catch (error) {
      if (!(error instanceof AuthenticationError)) {
        logger.error('Unexpected error during sign in:', error);
      }
      throw error;
    }
  },

  async register(userData: RegisterData): Promise<RegisterResponse> {
    try {
      const csrfToken = await this.getCsrfToken();

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          name: userData.name
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new AuthenticationError(data.error || 'Failed to register');
      }

      return {
        success: true,
        message: data.message || 'Registration successful. Please wait for admin approval to access your account.'
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      logger.error('Registration error:', error);
      throw new Error('Failed to register user');
    }
  },

  async signOut(): Promise<void> {
    try {
      const csrfToken = await this.getCsrfToken();

      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });
    } catch (error) {
      logger.error('Logout error:', error);
    } finally {
      cachedUser = null;
      clearCsrfToken();
    }
  },

  async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      cachedUser = data.user as User;
      return true;
    } catch (error) {
      logger.error('Token refresh error:', error);
      this.signOut();
      throw error;
    }
  },

  getAuthHeader(): Record<string, string> {
    return {};
  },

  getCurrentUser(): User | null {
    return cachedUser;
  },

  setCurrentUser(user: User | null): void {
    cachedUser = user;
  },

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  },

  async createUser(userData: CreateUserData): Promise<User> {
    try {
      const csrfToken = await this.getCsrfToken();

      const response = await fetch('/api/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create user');
      }

      return await response.json();
    } catch (error) {
      logger.error('Create user error:', error);
      throw error;
    }
  },

  async updateUser(userId: string, updateData: UpdateUserData): Promise<User> {
    try {
      const csrfToken = await this.getCsrfToken();

      const response = await fetch(`/api/auth/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }

      return await response.json();
    } catch (error) {
      logger.error('Update user error:', error);
      throw error;
    }
  },

  async deleteUser(userId: string): Promise<{ message: string }> {
    try {
      const csrfToken = await this.getCsrfToken();

      const response = await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }

      return await response.json();
    } catch (error) {
      logger.error('Delete user error:', error);
      throw error;
    }
  }
};

export default authService;
