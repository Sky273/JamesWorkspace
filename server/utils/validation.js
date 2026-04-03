/**
 * Validation Utilities
 * JavaScript version for Node.js backend
 */

import { z } from 'zod';
import { MAX_TEXT_LENGTH } from '../config/constants.js';
import { safeLog } from './logger.backend.js';
export {
  emailSchema,
  passwordSchema,
  nameSchema,
  signInSchema,
  registerSchema,
  forgotPasswordSchema,
  totpCodeSchema,
  resetPasswordSchema,
  createUserSchema,
  createMissionSchema,
  updateMissionSchema,
  createTemplateSchema,
  updateTemplateSchema,
  createFirmSchema,
  updateFirmSchema,
  updateAdminUserSchema,
  updateUserProfileSchema,
  lowercaseEnum
} from './validation.schemas.core.js';
export {
  batchExportSchema,
  restoreBackupSchema,
  sharePdfSchema,
  generatePdfProxySchema,
  generateDocxProxySchema,
  gdprMailTestSchema,
  findProfilesSchema,
  escoRecalculateSchema,
  analyzeTextSchema,
  improveTextSchema,
  missionIdBodySchema,
  aiModifySchema,
  previewEmailTemplateSchema,
  googleTokenSchema,
  updateResumeSchema,
  openaiRequestSchema,
  anthropicRequestSchema,
  chatbotRequestSchema
} from './validation.schemas.documents.js';
export {
  addDealResumeSchema,
  addResumeToMultipleDealsSchema,
  completeInterviewSchema,
  compileEmailTemplateSchema,
  createCalendarEventSchema,
  createDealSchema,
  createEmailTemplateFrontSchema,
  createEmailTemplateSchema,
  createInterviewSchema,
  createMailDraftSchema,
  createPipelineEntrySchema,
  createSubmissionSchema,
  initializeConsentSchema,
  respondConsentSchema,
  scheduleInterviewSchema,
  updateAdaptationSchema,
  updateDealResumeSchema,
  updateDealSchema,
  updateEmailTemplateFrontSchema,
  updateEmailTemplateSchema,
  updateInterviewSchema,
  updatePipelineEntrySchema,
  updateSubmissionSchema
} from './validation.schemas.workflow.js';

// Resume comment schemas
export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  isPrivate: z.boolean().optional()
}).strip();

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000)
}).strip();

const jsonPrimitiveSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const jsonValueSchema = z.lazy(() => z.union([
  jsonPrimitiveSchema,
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema)
]));

// Tag rename schema
export const renameTagSchema = z.object({
  category: z.enum(['Skills', 'Industries', 'Tools', 'Soft Skills']),
  oldName: z.string().min(1).max(255),
  newName: z.string().min(1).max(255)
}).strip();

// Batch Jobs schemas
export const batchImproveSchema = z.object({
  resumeIds: z.array(z.string().uuid()).min(1).max(500).optional(),
  resume_ids: z.array(z.string().uuid()).min(1).max(500).optional(),
  options: z.record(z.string(), z.any()).optional(),
  firm_id: z.union([z.string(), z.number()]).optional(),
  firmId: z.union([z.string(), z.number()]).optional()
}).strip().refine(
  (data) => Boolean(data.resumeIds || data.resume_ids),
  { message: 'resumeIds is required', path: ['resumeIds'] }
);

export const batchAdaptSchema = z.object({
    resumeIds: z.array(z.string().uuid()).min(1).max(500).optional(),
    resume_ids: z.array(z.string().uuid()).min(1).max(500).optional(),
    missionId: z.string().uuid().optional(),
  mission_id: z.string().uuid().optional(),
  options: z.record(z.string(), z.any()).optional(),
  firm_id: z.union([z.string(), z.number()]).optional(),
  firmId: z.union([z.string(), z.number()]).optional()
}).strip().refine(
  (data) => Boolean(data.resumeIds || data.resume_ids),
  { message: 'resumeIds is required', path: ['resumeIds'] }
  ).refine(
    (data) => Boolean(data.missionId || data.mission_id),
    { message: 'missionId is required', path: ['missionId'] }
  );

export const batchMatchSchema = z.object({
      resumeIds: z.array(z.string().uuid()).min(1).max(500).optional(),
      resume_ids: z.array(z.string().uuid()).min(1).max(500).optional(),
    missionId: z.string().uuid().optional(),
    mission_id: z.string().uuid().optional(),
    options: z.record(z.string(), z.any()).optional(),
    firm_id: z.union([z.string(), z.number()]).optional(),
    firmId: z.union([z.string(), z.number()]).optional()
  }).strip().refine(
    (data) => Boolean(data.resumeIds || data.resume_ids),
    { message: 'resumeIds is required', path: ['resumeIds'] }
    ).refine(
      (data) => Boolean(data.missionId || data.mission_id),
      { message: 'missionId is required', path: ['missionId'] }
    );

export const batchProfileSearchSchema = z.object({
    missionId: z.string().uuid().optional(),
    mission_id: z.string().uuid().optional(),
    limit: z.number().min(0).max(100).optional(),
    minScore: z.number().min(0).max(100).optional(),
    status: z.string().max(50).optional(),
    weights: z.record(z.string(), z.number()).optional(),
    dealId: z.string().uuid().optional().nullable(),
    deal_id: z.string().uuid().optional().nullable(),
    firm_id: z.union([z.string(), z.number()]).optional(),
    firmId: z.union([z.string(), z.number()]).optional()
}).strip().refine(
    (data) => Boolean(data.missionId || data.mission_id),
    { message: 'missionId is required', path: ['missionId'] }
);

export const batchProfileAnalysisSchema = z.object({
    resumeId: z.string().uuid().optional(),
    resume_id: z.string().uuid().optional(),
    missionId: z.string().uuid().optional(),
    mission_id: z.string().uuid().optional(),
    firm_id: z.union([z.string(), z.number()]).optional(),
    firmId: z.union([z.string(), z.number()]).optional()
}).strip().refine(
    (data) => Boolean(data.resumeId || data.resume_id),
    { message: 'resumeId is required', path: ['resumeId'] }
).refine(
    (data) => Boolean(data.missionId || data.mission_id),
    { message: 'missionId is required', path: ['missionId'] }
);

export const batchDealExportSchema = z.object({
  dealId: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  template_id: z.string().uuid().optional(),
  exportFormats: z.array(z.enum(['pdf', 'docx'])).optional(),
  export_formats: z.array(z.enum(['pdf', 'docx'])).optional()
}).strip().refine(
  (data) => Boolean(data.dealId || data.deal_id),
  { message: 'dealId is required', path: ['dealId'] }
).refine(
  (data) => Boolean(data.templateId || data.template_id),
  { message: 'templateId is required', path: ['templateId'] }
);

export const provideNameSchema = z.object({
  name: z.string().min(1).max(255)
}).strip();

// Client schemas
export const createClientSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['client', 'prospect']).optional(),
  industry: z.string().max(255).optional(),
  website: z.string().url().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  firm_id: z.string().uuid().optional().nullable(),
  firmId: z.string().uuid().optional().nullable()
}).strip();

export const updateClientSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['client', 'prospect']).optional(),
  industry: z.string().max(255).optional(),
  website: z.string().url().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  firm_id: z.string().uuid().optional().nullable(),
  firmId: z.string().uuid().optional().nullable()
}).strip();

// Client Contact schemas
export const createContactSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  role: z.string().max(255).optional(),
  is_primary: z.boolean().optional(),
  isPrimary: z.boolean().optional()
}).strip();

export const updateContactSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  role: z.string().max(255).optional(),
  is_primary: z.boolean().optional(),
  isPrimary: z.boolean().optional()
}).strip();

// Settings schemas
export const updateSettingsSchema = z.object({
  llmProvider: z.enum(['openai', 'anthropic', 'deepseek', 'glm', 'minimax', 'ollama']).optional(),
  llmModel: z.string().max(100).optional(),
  ollamaBaseUrl: z.string().url().max(500).optional(),
  ollamaVisionModel: z.string().max(100).optional(),
  ollamaKeepAlive: z.string().max(50).optional(),
  ollamaNumCtx: z.coerce.number().min(1024).max(262144).optional(),
  llmModelParameters: z.record(
    z.string(),
    z.record(
      z.string(),
      z.record(
        z.string(),
        jsonValueSchema
      )
    )
  ).optional(),
  cvMode: z.enum(['nominative', 'anonymous']).optional(),
  chatbotEnabled: z.enum(['on', 'off']).optional(),
  webglEnabled: z.enum(['on', 'off']).optional(),
  preAnalysisEnabled: z.boolean().optional(),
  'Pre Analysis Prompt': z.string().optional(),
  'Analysis Prompt': z.string().optional(),
  'Improvement Prompt': z.string().optional(),
  'Match Analysis Prompt': z.string().optional(),
  'Adaptation Prompt': z.string().optional(),
  'Executive Summary Weight': z.coerce.number().min(0).max(100).optional(),
  'Skills Weight': z.coerce.number().min(0).max(100).optional(),
  'Experience Weight': z.coerce.number().min(0).max(100).optional(),
  'Education Weight': z.coerce.number().min(0).max(100).optional(),
  'Hobbies Languages Weight': z.coerce.number().min(0).max(100).optional(),
  'ATS Weight': z.coerce.number().min(0).max(100).optional(),
  'Profile Matching Local Skill Weight': z.coerce.number().min(0).max(100).optional(),
  'Profile Matching Local Tool Weight': z.coerce.number().min(0).max(100).optional(),
  'Profile Matching Local Industry Weight': z.coerce.number().min(0).max(100).optional(),
  'Profile Matching Local Soft Skill Weight': z.coerce.number().min(0).max(100).optional(),
  'Profile Matching Local Title Exact Weight': z.coerce.number().min(0).max(100).optional(),
  'Profile Matching Local Title Token Weight': z.coerce.number().min(0).max(100).optional(),
  'Profile Matching Local Coverage Multiplier': z.coerce.number().min(0).max(100).optional(),
  'DPO Name': z.string().optional(),
  'DPO Email': z.string().optional(),
  'DPO Phone': z.string().optional()
}).strict();

// Backup settings schemas
export const updateBackupSettingsSchema = z.object({
  backup_target: z.enum(['local', 'remote']).optional(),
  protocol: z.enum(['ftp', 'ftps', 'sftp']).optional(),
  tls_mode: z.enum(['none', 'explicit', 'implicit']).optional(),
  host: z.string().max(255).optional(),
  port: z.number().min(1).max(65535).optional(),
  username: z.string().max(255).optional(),
  password: z.string().optional(),
  remote_path: z.string().max(500).optional(),
  daily_enabled: z.boolean().optional(),
  daily_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  daily_retention: z.number().min(1).max(365).optional(),
  weekly_enabled: z.boolean().optional(),
  weekly_day: z.number().min(0).max(6).optional(),
  weekly_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  weekly_retention: z.number().min(1).max(52).optional(),
  monthly_enabled: z.boolean().optional(),
  monthly_day: z.number().min(1).max(28).optional(),
  monthly_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  monthly_retention: z.number().min(1).max(120).optional()
}).strip();

export const testBackupConnectionSchema = z.object({
  protocol: z.enum(['ftp', 'ftps', 'sftp']).optional(),
  tls_mode: z.enum(['none', 'explicit', 'implicit']).optional(),
  host: z.string().min(1).max(255),
  port: z.number().min(1).max(65535).optional(),
  username: z.string().min(1).max(255),
  password: z.string().optional(),
  remote_path: z.string().max(500).optional()
}).strip();

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

        const redactSensitiveValues = (value, seen = new WeakSet()) => {
          if (value === null || value === undefined) {
            return value;
          }

          if (typeof value !== 'object') {
            return value;
          }

          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);

          if (Array.isArray(value)) {
            return value.map((entry) => redactSensitiveValues(entry, seen));
          }

          const redacted = {};
          const sensitiveKeyPattern = /(pass(word)?|token|secret|auth|cookie|session|code|key)$/i;

          for (const [key, nestedValue] of Object.entries(value)) {
            redacted[key] = sensitiveKeyPattern.test(key)
              ? '[REDACTED]'
              : redactSensitiveValues(nestedValue, seen);
          }

          return redacted;
        };
        
        safeLog('error', 'Request validation failed', {
          path: req.path,
          errors: JSON.stringify(errors),
          receivedFields: Object.keys(req.body || {}),
          bodyPreview: JSON.stringify(redactSensitiveValues(req.body)).substring(0, 500)
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
 * Validate record ID format (PostgreSQL UUID)
 */
export function isValidId(id) {
  const uuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidFormat.test(id);
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
      
      // Validate ID format for 'id' and all '*Id' params (resumeId, missionId, etc.)
      if ((paramName === 'id' || paramName.endsWith('Id')) && !isValidId(value)) {
        res.status(400).json({
          error: 'Validation failed',
          details: [{ field: paramName, message: 'Invalid record ID format' }]
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



