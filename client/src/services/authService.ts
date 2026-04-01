/**
 * Authentication Service
 * TypeScript version with full type safety
 */

import { 
  fetchWithAuth, 
  fetchWithCsrfRetry, 
  getCsrfToken, 
  clearCsrfToken, 
  resetSessionState,
  createAuthOptionsWithCsrf,
  isSessionRedirectError
} from '../utils/apiInterceptor';
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
  status: 'active' | 'inactive' | 'pending';
  firmId?: string;
  firmName?: string;
  firm?: string;
  firmLogo?: string;
  firm_id?: string;
  customerId?: string;
  customerName?: string;
  customer?: string;
  // Google SSO fields
  google_id?: string;
  google_email?: string;
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
  firmId?: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  jobTitle?: string;
  phone?: string;
  role?: string;
  status?: string;
  firmId?: string;
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
  /**
   * Sign in — uses fetchWithAuth for timeout/cache-busting.
   * CSRF token comes from the shared interceptor cache.
   * Bug fix: check !response.ok BEFORE checking requires2FA.
   */
  async signIn(email: string, password: string, totpCode?: string): Promise<User | SignInResponse> {
    try {
      const csrfToken = await getCsrfToken();

      const response = await fetchWithAuth('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || ''
        },
        body: JSON.stringify({ email, password, totpCode })
      });

      const data = await response.json();

      // Check if 2FA is required (server returns 200 with requires2FA flag)
      if (response.ok && data.requires2FA) {
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
      if (isSessionRedirectError(error)) throw error;
      if (!(error instanceof AuthenticationError)) {
        logger.error('Unexpected error during sign in:', error);
      }
      throw error;
    }
  },

  /**
   * Register — uses fetchWithAuth for timeout/cache-busting.
   */
  async register(userData: RegisterData): Promise<RegisterResponse> {
    try {
      const csrfToken = await getCsrfToken();

      const response = await fetchWithAuth('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || ''
        },
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
      if (error instanceof AuthenticationError) throw error;
      if (isSessionRedirectError(error)) throw error;
      logger.error('Registration error:', error);
      throw new Error('Failed to register user');
    }
  },

  /**
   * Sign out — uses fetchWithCsrfRetry for automatic CSRF retry.
   * Always clears local state, even if the API call fails.
   */
  async signOut(): Promise<void> {
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'POST' });
      await fetchWithCsrfRetry('/api/auth/logout', options);
    } catch (error) {
      if (!isSessionRedirectError(error)) {
        logger.error('Logout error:', error);
      }
    } finally {
      cachedUser = null;
      clearCsrfToken();
    }
  },

  /**
   * Refresh the access token. Backend now returns { user } on success.
   */
  async refreshToken(): Promise<boolean> {
    try {
      const response = await fetchWithAuth('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      if (data.user) {
        cachedUser = data.user as User;
      }
      return true;
    } catch (error) {
      logger.error('Token refresh error:', error);
      this.signOut();
      throw error;
    }
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

  /**
   * Admin: Create user — uses fetchWithCsrfRetry for auth + CSRF retry.
   */
  async createUser(userData: CreateUserData): Promise<User> {
    try {
      const options = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const response = await fetchWithCsrfRetry('/api/auth/users', options);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create user');
      }

      return await response.json();
    } catch (error) {
      if (isSessionRedirectError(error)) throw error;
      logger.error('Create user error:', error);
      throw error;
    }
  },

  /**
   * Admin: Update user — uses fetchWithCsrfRetry for auth + CSRF retry.
   */
  async updateUser(userId: string, updateData: UpdateUserData): Promise<User> {
    try {
      const options = await createAuthOptionsWithCsrf({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      const response = await fetchWithCsrfRetry(`/api/auth/users/${userId}`, options);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }

      return await response.json();
    } catch (error) {
      if (isSessionRedirectError(error)) throw error;
      logger.error('Update user error:', error);
      throw error;
    }
  },

  /**
   * Request a password reset email (forgot password flow)
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetchWithAuth('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || ''
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      return { success: true, message: data.message };
    } catch (error) {
      logger.error('Forgot password error:', error);
      // Always return success to prevent email enumeration on client side too
      return { success: true, message: 'Si un compte existe avec cette adresse email, un lien de réinitialisation a été envoyé.' };
    }
  },

  /**
   * Reset password using a valid token
   */
  async resetPassword(token: string, password: string): Promise<{ success: boolean; message: string; code?: string }> {
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetchWithAuth('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken || ''
        },
        body: JSON.stringify({ token, password })
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.error || 'Erreur lors de la réinitialisation.', code: data.code };
      }

      return { success: true, message: data.message };
    } catch (error) {
      logger.error('Reset password error:', error);
      throw new Error('Erreur lors de la réinitialisation du mot de passe.');
    }
  },

  /**
   * Admin: Delete user — uses fetchWithCsrfRetry for auth + CSRF retry.
   */
  async deleteUser(userId: string): Promise<{ message: string }> {
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'DELETE' });
      const response = await fetchWithCsrfRetry(`/api/auth/users/${userId}`, options);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }

      return await response.json();
    } catch (error) {
      if (isSessionRedirectError(error)) throw error;
      logger.error('Delete user error:', error);
      throw error;
    }
  }
};

export default authService;
