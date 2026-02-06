/**
 * Authentication Types for ResumeConverter
 */

import { Request } from 'express';

// ============================================
// USER TYPES
// ============================================

export interface User {
  id: string;
  'Name': string;
  'Email': string;
  'Password'?: string;
  'Role': UserRole;
  'Status': UserStatus;
  'Customer'?: string;
  'CustomerName'?: string;
  'Last Login'?: string;
  'Created At'?: string;
  'Updated At'?: string;
}

export type UserRole = 'admin' | 'user' | 'viewer';
export type UserStatus = 'Active' | 'Inactive' | 'Pending';

// ============================================
// AUTH CONTEXT TYPES
// ============================================

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

// ============================================
// JWT TYPES
// ============================================

export interface JWTPayload {
  id: string;
  email: string;
  role: UserRole;
  customer?: string;
  iat?: number;
  exp?: number;
}

export interface DecodedToken extends JWTPayload {
  iat: number;
  exp: number;
}

// ============================================
// REQUEST TYPES (Express extensions)
// ============================================

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  customer?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  csrfToken?: () => string;
}

// ============================================
// LOGIN/REGISTER TYPES
// ============================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  customer?: string;
}
