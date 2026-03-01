/**
 * Validation Utilities
 * JavaScript version for Node.js backend
 */

import { z } from 'zod';
import { MAX_TEXT_LENGTH } from '../config/constants.js';
import { safeLog } from './logger.backend.js';

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
  password: passwordSchema,
  totpCode: z.string().min(6).max(8).optional() // 6-digit TOTP code or 8-char backup code
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
  jobTitle: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  role: z.enum(['admin', 'Admin', 'user', 'User']).optional(),
  status: z.enum(['Active', 'Inactive', 'Pending', 'active', 'inactive', 'pending']).optional(),
  customer: z.string().optional(),
  CustomerName: z.string().optional(),
  firm: z.string().optional(),
  FirmName: z.string().optional()
});

// Mission schemas
export const createMissionSchema = z.object({
  Title: z.string().min(1).max(500),
  Content: z.string().optional(),
  Status: z.enum(['Active', 'Closed', 'Draft']).optional(),
  Customer: z.string().optional(),
  'Client ID': z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  'Contact ID': z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable()
});

export const updateMissionSchema = z.object({
  Title: z.string().min(1).max(500).optional(),
  Content: z.string().optional(),
  Status: z.enum(['Active', 'Closed', 'Draft']).optional(),
  'Client ID': z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  'Contact ID': z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable()
});

// Template schemas
export const createTemplateSchema = z.object({
  Name: z.string().min(1).max(255),
  Description: z.string().optional(),
  HeaderContent: z.string().optional(),
  TemplateContent: z.string().min(1),
  FooterContent: z.string().optional(),
  FooterHeight: z.number().min(10).max(250).optional(),
  Stylesheet: z.string().optional(),
  Status: z.enum(['Active', 'Inactive']).optional(),
  Tags: z.array(z.string()).optional(),
  Popular: z.boolean().optional()
});

// Firm schemas
export const createFirmSchema = z.object({
  Name: z.string().min(1).max(255),
  FirmName: z.string().min(1).max(255).optional()
});

// Keep alias for backward compatibility during transition
export const createCustomerSchema = createFirmSchema;

// Resume schemas
export const updateResumeSchema = z.object({
  'Original Text': z.string().max(MAX_TEXT_LENGTH).optional(),
  'Improved Text': z.string().max(MAX_TEXT_LENGTH).optional(),
  'Analysis': z.string().optional(),
  'Skills': z.union([z.string(), z.array(z.string())]).optional(),
  'Industries': z.union([z.string(), z.array(z.string())]).optional(),
  'Tools': z.union([z.string(), z.array(z.string())]).optional(),
  'Soft Skills': z.union([z.string(), z.array(z.string())]).optional(),
  'Key Improvements': z.string().optional(),
  'Original Score': z.union([z.string(), z.number()]).optional(),
  'Improved Score': z.union([z.string(), z.number()]).optional(),
  'Candidate Name': z.string().max(255).optional(),
  'Professional Title': z.string().max(255).optional(),
  'Status': z.enum(['Pending', 'Processing', 'Analyzed', 'Improved', 'Error', 'Active', 'active', 'analyzed']).optional(),
  'Analysis Date': z.string().optional(),
  'Last Improved': z.string().optional(),
  'CustomerName': z.string().nullable().optional(),
  'Created At': z.string().optional(),
  'Name': z.string().max(255).optional(),
  'Title': z.string().max(255).optional(),
  'Original Name': z.string().max(255).optional(),
  'Global Rating': z.union([z.string(), z.number()]).optional(),
  'Executive Summary Score': z.union([z.string(), z.number()]).optional(),
  'Skills Score': z.union([z.string(), z.number()]).optional(),
  'Experience Score': z.union([z.string(), z.number()]).optional(),
  'Education Score': z.union([z.string(), z.number()]).optional(),
  'ATS Score': z.union([z.string(), z.number()]).optional(),
  'Hobbies Languages Score': z.union([z.string(), z.number()]).optional(),
  'Improved Global Rating': z.union([z.string(), z.number()]).optional(),
  'Improved Skills Score': z.union([z.string(), z.number()]).optional(),
  'Improved Experience Score': z.union([z.string(), z.number()]).optional(),
  'Improved Education Score': z.union([z.string(), z.number()]).optional(),
  'Improved ATS Score': z.union([z.string(), z.number()]).optional(),
  'Improved Executive Summary Score': z.union([z.string(), z.number()]).optional(),
  'Improved Hobbies Languages Score': z.union([z.string(), z.number()]).optional(),
  'Skills_cleaned': z.array(z.string()).optional(),
  'Industries_cleaned': z.array(z.string()).optional(),
  'Tools_cleaned': z.array(z.string()).optional(),
  'Soft Skills_cleaned': z.array(z.string()).optional(),
  'Skills_esco': z.array(z.any()).optional(),
  'Industries_esco': z.array(z.any()).optional(),
  'Tools_esco': z.array(z.any()).optional(),
  'Soft Skills_esco': z.array(z.any()).optional()
}).passthrough();

export const improveTextSchema = z.object({
  text: z.string().min(1).max(MAX_TEXT_LENGTH),
  analysis: z.object({}).passthrough()
});

// LLM route schemas
export const matchResumeSchema = z.object({
  resumeId: z.string().uuid().optional(),
  missionId: z.string().uuid().optional()
});

export const adaptResumeSchema = z.object({
  resumeId: z.string().uuid().optional(),
  missionId: z.string().uuid().optional()
});

// LLM message schema
const llmMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().max(100000)
});

// OpenAI request schema
export const openaiRequestSchema = z.object({
  model: z.string().max(100).optional(),
  messages: z.array(llmMessageSchema).min(1).max(50),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().min(1).max(128000).optional(),
  stream: z.boolean().optional()
}).passthrough();

// Anthropic request schema
export const anthropicRequestSchema = z.object({
  model: z.string().max(100).optional(),
  messages: z.array(llmMessageSchema).min(1).max(50),
  max_tokens: z.number().min(1).max(200000).optional(),
  temperature: z.number().min(0).max(1).optional(),
  system: z.string().max(100000).optional()
}).passthrough();

// Chatbot request schema
export const chatbotRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).max(50).optional()
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
// VALIDATION MIDDLEWARE
// ============================================

/**
 * Middleware to validate request body against a Zod schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((err) => ({
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
        error: error.message,
        errorType: error.constructor.name
      });
      
      next(error);
    }
  };
}

// ============================================
// PARAMETER VALIDATION
// ============================================

/**
 * Validate record ID format (Airtable or PostgreSQL UUID)
 */
export function isValidAirtableId(id) {
  // Accept Airtable format: rec + 14 alphanumeric characters
  const airtableFormat = /^rec[a-zA-Z0-9]{14}$/;
  // Accept PostgreSQL UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  return airtableFormat.test(id) || uuidFormat.test(id);
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize text input
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, MAX_TEXT_LENGTH);
}

/**
 * Middleware to validate route parameters
 */
export function validateParams(...paramNames) {
  return (req, res, next) => {
    for (const paramName of paramNames) {
      const value = req.params[paramName];
      
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
export function validateQuery(schema) {
  return (req, res, next) => {
    const validation = {};
    
    for (const [key, validator] of Object.entries(schema)) {
      const rawValue = req.query[key];
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
  positiveInteger: (value) => {
    const num = parseInt(String(value), 10);
    if (isNaN(num) || num < 0) {
      return { valid: false, error: 'must be a positive integer' };
    }
    return { valid: true, value: num };
  },
  
  maxLength: (max) => (value) => {
    if (typeof value !== 'string' || value.length > max) {
      return { valid: false, error: `must be a string with max length ${max}` };
    }
    return { valid: true, value: sanitizeText(value) };
  },
  
  enum: (allowedValues) => (value) => {
    if (!allowedValues.includes(value)) {
      return { valid: false, error: `must be one of: ${allowedValues.join(', ')}` };
    }
    return { valid: true, value };
  }
};
