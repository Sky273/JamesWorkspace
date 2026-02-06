/**
 * Validation Utilities
 * TypeScript version with full type safety
 */

import { z, ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { MAX_TEXT_LENGTH } from '../config/constants.js';
import { safeLog } from './logger.backend.js';

// ============================================
// TYPES
// ============================================

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidatorResult<T = unknown> {
  valid: boolean;
  value?: T;
  error?: string;
}

export type ValidatorFn<T = unknown> = (value: unknown) => ValidatorResult<T>;

export interface ValidatedRequest extends Request {
  validatedQuery?: Record<string, unknown>;
}

// ============================================
// ZOD SCHEMAS
// ============================================

// Common schemas
export const emailSchema = z.string().email().max(255);
export const passwordSchema = z.string().min(8).max(100);
export const nameSchema = z.string().min(1).max(255);
export const airtableIdSchema = z.string().regex(/^rec[a-zA-Z0-9]{14}$/);

// Auth schemas
export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema
});

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  status: z.enum(['Active', 'Inactive', 'Pending']).optional()
});

// Mission schemas
export const createMissionSchema = z.object({
  Title: z.string().min(1).max(500),
  Content: z.string().optional(),
  Status: z.enum(['Open', 'Closed', 'In Progress']).optional(),
  Customer: z.string().optional()
});

export const updateMissionSchema = z.object({
  Title: z.string().min(1).max(500).optional(),
  Content: z.string().optional(),
  Status: z.enum(['Open', 'Closed', 'In Progress']).optional()
});

// Template schemas
export const createTemplateSchema = z.object({
  Name: z.string().min(1).max(255),
  Description: z.string().optional(),
  TemplateContent: z.string().min(1),
  Status: z.enum(['Active', 'Inactive']).optional(),
  Tags: z.array(z.string()).optional(),
  Popular: z.boolean().optional()
});

// Customer schemas
export const createCustomerSchema = z.object({
  Name: z.string().min(1).max(255),
  CustomerName: z.string().min(1).max(255).optional()
});

// Resume schemas
export const updateResumeSchema = z.object({
  'Original Text': z.string().max(MAX_TEXT_LENGTH).optional(),
  'Improved Text': z.string().max(MAX_TEXT_LENGTH).optional(),
  'Analysis': z.string().optional(),
  'Skills': z.string().optional(),
  'Industries': z.string().optional(),
  'Tools': z.string().optional(),
  'Soft Skills': z.string().optional(),
  'Key Improvements': z.string().optional(),
  'Improved Key Improvements': z.string().optional(),
  'Original Score': z.string().optional(),
  'Improved Score': z.string().optional(),
  'Candidate Name': z.string().max(255).optional(),
  'Professional Title': z.string().max(255).optional(),
  'Status': z.enum(['Pending', 'Processing', 'Analyzed', 'Improved', 'Error']).optional(),
  'Analysis Date': z.string().optional(),
  'Last Improved': z.string().optional(),
  'CustomerName': z.string().nullable().optional(),
  'Created At': z.string().optional(),
  'Name': z.string().max(255).optional(),
  'Title': z.string().max(255).optional(),
  'Global Rating': z.string().optional(),
  'Executive Summary Score': z.string().optional(),
  'Skills Score': z.string().optional(),
  'Experience Score': z.string().optional(),
  'Education Score': z.string().optional(),
  'ATS Score': z.string().optional(),
  'Hobbies Languages Score': z.string().optional(),
  'Improved Global Rating': z.string().optional(),
  'Improved Skills Score': z.string().optional(),
  'Improved Experience Score': z.string().optional(),
  'Improved Education Score': z.string().optional(),
  'Improved ATS Score': z.string().optional(),
  'Improved Executive Summary Score': z.string().optional(),
  'Improved Hobbies Languages Score': z.string().optional()
}).passthrough();

export const improveTextSchema = z.object({
  text: z.string().min(1).max(MAX_TEXT_LENGTH),
  analysis: z.object({}).passthrough()
});

// LLM route schemas
export const matchResumeSchema = z.object({
  resumeId: airtableIdSchema.optional(),
  missionId: airtableIdSchema.optional()
});

export const adaptResumeSchema = z.object({
  resumeId: airtableIdSchema.optional(),
  missionId: airtableIdSchema.optional()
});

// Adaptation schemas
export const updateAdaptationSchema = z.object({
  'Adapted Text': z.string().optional()
}).strict();

// Settings schemas
export const updateSettingsSchema = z.object({
  llmModel: z.string().optional(),
  cvMode: z.enum(['nominative', 'anonymous']).optional(),
  chatbotEnabled: z.enum(['on', 'off']).optional(),
  'Analysis Prompt': z.string().optional(),
  'Improvement Prompt': z.string().optional(),
  'Match Analysis Prompt': z.string().optional(),
  'Adaptation Prompt': z.string().optional(),
  'Executive Summary Weight': z.number().min(0).max(100).optional(),
  'Skills Weight': z.number().min(0).max(100).optional(),
  'Experience Weight': z.number().min(0).max(100).optional(),
  'Education Weight': z.number().min(0).max(100).optional(),
  'Hobbies Languages Weight': z.number().min(0).max(100).optional(),
  'ATS Weight': z.number().min(0).max(100).optional()
}).strict();

// ============================================
// TYPE INFERENCE FROM SCHEMAS
// ============================================

export type SignInInput = z.infer<typeof signInSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateMissionInput = z.infer<typeof createMissionSchema>;
export type UpdateMissionInput = z.infer<typeof updateMissionSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateResumeInput = z.infer<typeof updateResumeSchema>;
export type ImproveTextInput = z.infer<typeof improveTextSchema>;
export type UpdateAdaptationInput = z.infer<typeof updateAdaptationSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

/**
 * Middleware to validate request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: ValidationError[] = error.issues.map((err) => ({
          field: err.path?.join('.') || 'unknown',
          message: err.message || 'Validation error',
          code: err.code
        }));
        
        safeLog('error', 'Request validation failed', {
          path: req.path,
          errors: JSON.stringify(errors),
          receivedFields: Object.keys(req.body || {}),
          bodyPreview: JSON.stringify(req.body).substring(0, 500)
        });
        
        res.status(400).json({
          error: 'Validation failed',
          details: errors
        });
        return;
      }
      
      safeLog('error', 'Validation middleware error', {
        path: req.path,
        error: (error as Error).message,
        errorType: (error as Error).constructor.name
      });
      
      next(error);
    }
  };
}

// ============================================
// PARAMETER VALIDATION
// ============================================

/**
 * Check if a string is a valid Airtable record ID
 */
export function isValidAirtableId(id: string): boolean {
  return /^rec[a-zA-Z0-9]{14}$/.test(id);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize text input
 */
export function sanitizeText(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, MAX_TEXT_LENGTH);
}

/**
 * Middleware to validate route parameters
 */
export function validateParams(...paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const paramName of paramNames) {
      const value = req.params[paramName] as string | undefined;
      
      if (!value) {
        res.status(400).json({
          error: 'Validation failed',
          details: [{ field: paramName, message: 'Parameter is required' }]
        });
        return;
      }
      
      if (paramName === 'id' && !isValidAirtableId(value)) {
        res.status(400).json({
          error: 'Validation failed',
          details: [{ field: paramName, message: 'Invalid Airtable record ID format' }]
        });
        return;
      }
    }
    next();
  };
}

/**
 * Middleware to validate query parameters
 */
export function validateQuery(schema: Record<string, ValidatorFn>) {
  return (req: ValidatedRequest, res: Response, next: NextFunction): void => {
    const validation: Record<string, unknown> = {};
    
    for (const [key, validator] of Object.entries(schema)) {
      const rawValue = req.query[key];
      // Handle both string and string[] query params
      const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
      
      if (value !== undefined) {
        const result = validator(value);
        if (!result.valid) {
          res.status(400).json({
            error: 'Validation failed',
            details: [{ field: key, message: result.error }]
          });
          return;
        }
        validation[key] = result.value;
      }
    }
    
    req.validatedQuery = validation;
    next();
  };
}

// ============================================
// COMMON VALIDATORS
// ============================================

export const validators = {
  positiveInteger: (value: unknown): ValidatorResult<number> => {
    const num = parseInt(String(value), 10);
    if (isNaN(num) || num < 0) {
      return { valid: false, error: 'must be a positive integer' };
    }
    return { valid: true, value: num };
  },
  
  maxLength: (max: number): ValidatorFn<string> => (value: unknown): ValidatorResult<string> => {
    if (typeof value !== 'string' || value.length > max) {
      return { valid: false, error: `must be a string with max length ${max}` };
    }
    return { valid: true, value: sanitizeText(value) };
  },
  
  enum: <T extends string>(allowedValues: readonly T[]): ValidatorFn<T> => (value: unknown): ValidatorResult<T> => {
    if (!allowedValues.includes(value as T)) {
      return { valid: false, error: `must be one of: ${allowedValues.join(', ')}` };
    }
    return { valid: true, value: value as T };
  }
};
