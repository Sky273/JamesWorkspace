/**
 * Error Handling Utilities
 * TypeScript version with full type safety
 */

import { Response } from 'express';
import { safeLog } from './logger.backend.js';

// ============================================
// TYPES
// ============================================

export interface DatabaseError extends Error {
  statusCode?: number;
  code?: string;
}

// Legacy alias for backward compatibility
export type AirtableError = DatabaseError;

export interface ErrorResponse {
  error: string;
  message?: string;
  statusCode?: number;
  timestamp?: string;
  details?: unknown;
  retryAfter?: number;
}

// ============================================
// ERROR HANDLING HELPERS
// ============================================

/**
 * Handle database errors and return appropriate HTTP status codes
 */
export function handleDatabaseError(
  error: DatabaseError, 
  res: Response, 
  operation: string = 'operation'
): Response {
  safeLog('error', `Database ${operation} failed`, {
    message: error.message,
    statusCode: error.statusCode
  });

  // Common database error codes
  if (error.statusCode === 404 || error.message?.includes('NOT_FOUND')) {
    return res.status(404).json({
      error: 'Resource not found',
      message: 'The requested record does not exist'
    });
  }

  if (error.statusCode === 403 || error.message?.includes('FORBIDDEN')) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'You do not have permission to access this resource'
    });
  }

  if (error.statusCode === 429 || error.message?.includes('RATE_LIMIT')) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: 60
    });
  }

  if (error.statusCode === 422 || error.message?.includes('INVALID_REQUEST')) {
    return res.status(422).json({
      error: 'Invalid request',
      message: 'The request data is invalid or malformed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }

  if (error.statusCode === 503 || error.message?.includes('SERVICE_UNAVAILABLE')) {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Database service is temporarily unavailable. Please try again later.'
    });
  }

  // Network/timeout errors
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return res.status(504).json({
      error: 'Request timeout',
      message: 'The database request timed out. Please try again.'
    });
  }

  // Generic server error
  return res.status(500).json({
    error: 'Internal server error',
    message: `Failed to ${operation}`,
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}

// Legacy alias for backward compatibility
export const handleAirtableError = handleDatabaseError;

/**
 * Standardized error response format
 */
export function sendError(
  res: Response, 
  statusCode: number, 
  message: string, 
  details: unknown = null
): Response {
  const errorResponse: ErrorResponse = {
    error: message,
    statusCode: statusCode,
    timestamp: new Date().toISOString()
  };
  
  if (details && process.env.NODE_ENV === 'development') {
    errorResponse.details = details;
  }
  
  return res.status(statusCode).json(errorResponse);
}

/**
 * Standard error responses
 */
export const ErrorResponses = {
  UNAUTHORIZED: (res: Response): Response => sendError(res, 401, 'Unauthorized'),
  FORBIDDEN: (res: Response): Response => sendError(res, 403, 'Forbidden'),
  NOT_FOUND: (res: Response): Response => sendError(res, 404, 'Not found'),
  VALIDATION_ERROR: (res: Response, details?: unknown): Response => 
    sendError(res, 400, 'Validation error', details),
  INTERNAL_ERROR: (res: Response): Response => sendError(res, 500, 'Internal server error')
} as const;

/**
 * Custom error classes
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public details: unknown;

  constructor(message: string, details?: unknown) {
    super(message, 400);
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403);
  }
}
