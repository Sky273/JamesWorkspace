/**
 * Error Handling Utilities
 * JavaScript version for Node.js backend
 */

import { safeLog } from './logger.backend.js';

// ============================================
// ERROR HANDLING HELPERS
// ============================================

/**
 * Standardized error response format
 */
export function sendError(res, statusCode, message, details = null) {
  const errorResponse = {
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
  UNAUTHORIZED: (res) => sendError(res, 401, 'Unauthorized'),
  FORBIDDEN: (res) => sendError(res, 403, 'Forbidden'),
  NOT_FOUND: (res) => sendError(res, 404, 'Not found'),
  VALIDATION_ERROR: (res, details) => sendError(res, 400, 'Validation error', details),
  INTERNAL_ERROR: (res) => sendError(res, 500, 'Internal server error')
};

/**
 * Custom error classes
 */
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400);
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

/**
 * Sanitize error message for client response
 * Removes technical details that could expose server architecture
 * @param {Error} error - The error object
 * @param {string} fallbackMessage - Generic message to return
 * @returns {string} Safe error message for client
 */
export function sanitizeErrorMessage(error, fallbackMessage = 'An error occurred') {
  // Never expose these technical details to clients
  const dangerousPatterns = [
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
    /ECONNABORTED/i,
    /connect ECONNREFUSED/i,
    /getaddrinfo/i,
    /localhost:\d+/i,
    /127\.0\.0\.1:\d+/i,
    /:\d{4,5}/i, // Port numbers
    /\/[a-zA-Z0-9_\-/]+\.js/i, // File paths
    /at [a-zA-Z0-9_.]+\s*\(/i, // Stack trace patterns
    /node_modules/i,
    /Error: /i
  ];

  const message = error?.message || fallbackMessage;

  // Check if message contains dangerous patterns
  const containsDangerousInfo = dangerousPatterns.some(pattern => pattern.test(message));

  if (containsDangerousInfo) {
    // Return generic message instead
    return fallbackMessage;
  }

  // In production, always use generic messages
  if (process.env.NODE_ENV === 'production') {
    return fallbackMessage;
  }

  // In development, return the actual message (for debugging)
  return message;
}
