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

export const forgotPasswordSchema = z.object({
  email: emailSchema
});

export const totpCodeSchema = z.object({
  code: z.string().min(6).max(8)
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  password: passwordSchema
});

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  jobTitle: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  role: z.preprocess(v => typeof v === 'string' ? v.toLowerCase() : v, z.enum(['user', 'admin'])).optional(),
  status: z.preprocess(v => typeof v === 'string' ? v.toLowerCase() : v, z.enum(['active', 'inactive', 'pending'])).optional(),
  customer: z.string().optional(),
  firm: z.string().optional()
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
  contact_id: z.string().uuid().optional().nullable(),
  'Firm ID': z.string().uuid().optional().nullable(),
  firm_id: z.string().uuid().optional().nullable(),
  'Deal ID': z.string().uuid().optional().nullable(),
  deal_id: z.string().uuid().optional().nullable()
});

export const updateMissionSchema = z.object({
  Title: z.string().min(1).max(500).optional(),
  Content: z.string().optional(),
  Status: z.enum(['Active', 'Closed', 'Draft']).optional(),
  'Client ID': z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  'Contact ID': z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  'Firm ID': z.string().uuid().optional().nullable(),
  firm_id: z.string().uuid().optional().nullable(),
  'Deal ID': z.string().uuid().optional().nullable(),
  deal_id: z.string().uuid().optional().nullable()
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

export const updateTemplateSchema = z.object({
  Name: z.string().min(1).max(255).optional(),
  Description: z.string().optional(),
  HeaderContent: z.string().optional(),
  TemplateContent: z.string().optional(),
  FooterContent: z.string().optional(),
  FooterHeight: z.number().min(10).max(250).optional(),
  Stylesheet: z.string().optional(),
  Status: z.enum(['Active', 'Inactive']).optional(),
  Tags: z.array(z.string()).optional(),
  Popular: z.boolean().optional(),
  PreviewImage: z.string().optional(),
  firm_id: z.string().uuid().optional().nullable(),
  FirmId: z.string().uuid().optional().nullable()
}).strip();

// Firm schemas
export const createFirmSchema = z.object({
  name: z.string().min(1).max(255),
  status: z.string().optional(),
  logo_url: z.string().optional()
}).strip();

export const updateFirmSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.string().optional(),
  logo_url: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable()
}).strip();

// Helper: preprocess to lowercase before enum validation
const lowercaseEnum = (values) => z.preprocess(
  (val) => (typeof val === 'string' ? val.toLowerCase() : val),
  z.enum(values)
);

// Admin user update schema (admin updating any user)
export const updateAdminUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).max(100).optional(),
  status: lowercaseEnum(['active', 'inactive', 'pending']).optional(),
  role: lowercaseEnum(['user', 'admin']).optional(),
  jobTitle: z.string().max(255).optional().nullable(),
  job_title: z.string().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  firm: z.string().max(255).optional(),
  customer: z.string().max(255).optional()
}).strip();

// User profile update schema (user updating own profile)
export const updateUserProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  jobTitle: z.string().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  role: lowercaseEnum(['user', 'admin']).optional(),
  status: lowercaseEnum(['active', 'inactive', 'pending']).optional(),
  firm_id: z.string().uuid().optional().nullable()
}).strip();

// Resume comment schemas
export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  isPrivate: z.boolean().optional()
}).strip();

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000)
}).strip();

// Tag rename schema
export const renameTagSchema = z.object({
  category: z.enum(['Skills', 'Industries', 'Tools', 'Soft Skills']),
  oldName: z.string().min(1).max(255),
  newName: z.string().min(1).max(255)
}).strip();

// Deal schemas
export const createDealSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  status: z.enum(['open', 'won', 'lost', 'on_hold']).optional(),
  expected_start_date: z.string().optional().nullable(),
  expected_end_date: z.string().optional().nullable(),
  budget_min: z.number().optional().nullable(),
  budget_max: z.number().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(5000).optional().nullable()
}).strip();

export const updateDealSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  status: z.enum(['open', 'won', 'lost', 'on_hold']).optional(),
  expected_start_date: z.string().optional().nullable(),
  expected_end_date: z.string().optional().nullable(),
  budget_min: z.number().optional().nullable(),
  budget_max: z.number().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(5000).optional().nullable()
}).strip();

export const addDealResumeSchema = z.object({
  resumeId: z.string().uuid(),
  notes: z.string().max(5000).optional().nullable(),
  status: z.string().max(50).optional()
}).strip();

export const updateDealResumeSchema = z.object({
  status: z.string().min(1).max(50),
  notes: z.string().max(5000).optional().nullable()
}).strip();

export const addResumeToMultipleDealsSchema = z.object({
  resumeId: z.string().uuid(),
  dealIds: z.array(z.string().uuid()).min(1).max(50)
}).strip();

// Resume Submission schemas
export const createSubmissionSchema = z.object({
  resume_id: z.string().uuid(),
  client_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  mission_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  sent_at: z.string().optional().nullable(),
  status: z.string().max(50).optional()
}).strip();

export const updateSubmissionSchema = z.object({
  status: z.string().max(50).optional(),
  notes: z.string().max(5000).optional().nullable()
}).strip();

// Pipeline Interview schemas
export const scheduleInterviewSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  interviewType: z.string().max(100).optional(),
  scheduledAt: z.string().min(1),
  durationMinutes: z.number().min(15).max(480).optional(),
  location: z.string().max(500).optional(),
  meetingLink: z.string().max(1000).optional(),
  attendees: z.array(z.string().email()).optional(),
  calendarEventId: z.string().max(500).optional().nullable(),
  calendarProvider: z.string().max(50).optional().nullable()
}).strip();

export const completeInterviewSchema = z.object({
  outcome: z.string().min(1).max(100),
  outcomeNotes: z.string().max(5000).optional().nullable()
}).strip();

// Email Template schemas (camelCase — matching route field names)
export const createEmailTemplateFrontSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  subjectTemplate: z.string().min(1).max(500),
  mjmlContent: z.string().min(1),
  isDefault: z.boolean().optional()
}).strip();

export const updateEmailTemplateFrontSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  subjectTemplate: z.string().min(1).max(500).optional(),
  mjmlContent: z.string().min(1).optional(),
  isDefault: z.boolean().optional()
}).strip();

export const compileEmailTemplateSchema = z.object({
  mjmlContent: z.string().min(1),
  subjectTemplate: z.string().max(500).optional(),
  context: z.record(z.string(), z.any()).optional()
}).strip();

// Consent schemas
export const initializeConsentSchema = z.object({
  resumeId: z.string().uuid(),
  profileType: z.string().min(1).max(100),
  candidateName: z.string().min(1).max(255),
  candidateEmail: z.string().email().optional()
}).strip();

export const respondConsentSchema = z.object({
  action: z.enum(['accept', 'refuse'])
}).strip();

// Mail draft schema
export const createMailDraftSchema = z.object({
  to: z.string().min(1).max(500),
  subject: z.string().max(1000).optional(),
  body: z.string().optional(),
  pdfBase64: z.string().optional(),
  pdfFilename: z.string().max(500).optional(),
  provider: z.enum(['gmail', 'outlook']).optional(),
  resumeId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  missionId: z.string().uuid().optional().nullable(),
  versionNumber: z.number().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  templateContext: z.record(z.string(), z.any()).optional()
}).strip();

// Batch Jobs schemas
export const batchImproveSchema = z.object({
  resumeIds: z.array(z.string().uuid()).min(1).max(500),
  options: z.record(z.string(), z.any()).optional(),
  firm_id: z.union([z.string(), z.number()]).optional()
}).strip();

export const batchDealExportSchema = z.object({
  dealId: z.string().uuid(),
  templateId: z.string().uuid(),
  exportFormats: z.array(z.enum(['pdf', 'docx'])).optional()
}).strip();

export const provideNameSchema = z.object({
  name: z.string().min(1).max(255)
}).strip();

// Batch Export schema
export const batchExportSchema = z.object({
  resumeIds: z.array(z.string().uuid()).min(1).max(500),
  templateId: z.string().uuid(),
  format: z.enum(['pdf', 'docx']).optional()
}).strip();

// Calendar Event schema
export const createCalendarEventSchema = z.object({
  summary: z.string().min(1).max(500).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  startDateTime: z.string().optional(),
  endDateTime: z.string().optional(),
  location: z.string().max(500).optional(),
  attendees: z.array(z.object({
    email: z.string().email()
  })).optional()
}).strip();

// Backup Restore schema
export const restoreBackupSchema = z.object({
  filename: z.string().min(1).max(500)
}).strip();

// Share PDF schema
export const sharePdfSchema = z.object({
  htmlContent: z.string().min(1),
  filename: z.string().max(500).optional(),
  stylesheet: z.string().optional(),
  headerContent: z.string().optional(),
  footerContent: z.string().optional(),
  footerHeight: z.union([z.string(), z.number()]).optional()
}).strip();

// GDPR Mail Test schema
export const gdprMailTestSchema = z.object({
  email: z.string().email()
}).strip();

// Mission Find Profiles schema
export const findProfilesSchema = z.object({
  limit: z.number().min(0).max(100).optional(),
  minScore: z.number().min(0).max(100).optional(),
  status: z.string().max(50).optional(),
  weights: z.record(z.string(), z.number()).optional(),
  dealId: z.string().uuid().optional().nullable()
}).strip();

// Tags Esco Recalculate schema
export const escoRecalculateSchema = z.object({
  language: z.string().max(10).optional()
}).strip();

// LLM Handler schemas
export const analyzeTextSchema = z.object({
  text: z.string().min(1).max(MAX_TEXT_LENGTH),
  fileName: z.string().max(500).optional().nullable()
}).strip();

export const improveTextSchema = z.object({
  text: z.string().min(1).max(MAX_TEXT_LENGTH),
  analysis: z.record(z.string(), z.any()).optional().nullable(),
  fileName: z.string().max(500).optional().nullable()
}).strip();

export const missionIdBodySchema = z.object({
  missionId: z.string().uuid()
}).strip();

export const aiModifySchema = z.object({
  content: z.string().min(1).max(MAX_TEXT_LENGTH),
  instructions: z.string().min(1).max(5000),
  selectedText: z.string().max(MAX_TEXT_LENGTH).optional().nullable()
}).strip();

// Email Template Preview schema
export const previewEmailTemplateSchema = z.object({
  context: z.record(z.string(), z.any()).optional()
}).strip();

// Google Auth Token schema
export const googleTokenSchema = z.object({
  idToken: z.string().min(1)
}).strip();

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
  'Soft Skills_esco': z.array(z.any()).optional(),
  // Improved tags (after LLM improvement)
  'Improved Skills': z.string().optional(),
  'Improved Industries': z.string().optional(),
  'Improved Tools': z.string().optional(),
  'Improved Soft Skills': z.string().optional(),
  'Improved Key Improvements': z.string().optional(),
  'FirmName': z.string().max(255).optional()
}).strip();

// (improveTextSchema moved above with LLM Handler schemas)

// (matchResumeSchema / adaptResumeSchema replaced by missionIdBodySchema above)

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
  'Adapted Text': z.string().optional(),
  'Adapted Title': z.string().max(500).optional().nullable(),
  adapted_title: z.string().max(500).optional().nullable()
}).strict();

// Client schemas
export const createClientSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['client', 'prospect']).optional(),
  industry: z.string().max(255).optional(),
  website: z.string().url().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(['active', 'inactive']).optional()
}).strip();

export const updateClientSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['client', 'prospect']).optional(),
  industry: z.string().max(255).optional(),
  website: z.string().url().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(['active', 'inactive']).optional()
}).strip();

// Client Contact schemas
export const createContactSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  job_title: z.string().max(255).optional(),
  is_primary: z.boolean().optional()
}).strip();

export const updateContactSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  job_title: z.string().max(255).optional(),
  is_primary: z.boolean().optional()
}).strip();

// Pipeline schemas
export const createPipelineEntrySchema = z.object({
  resume_id: z.string().uuid(),
  mission_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  stage: z.enum(['sourced', 'screening', 'interview', 'offer', 'hired', 'rejected']).optional(),
  notes: z.string().max(5000).optional()
}).strip();

export const updatePipelineEntrySchema = z.object({
  stage: z.enum(['sourced', 'screening', 'interview', 'offer', 'hired', 'rejected']).optional(),
  notes: z.string().max(5000).optional(),
  mission_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable()
}).strip();

// Email Template schemas
export const createEmailTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  subject_template: z.string().min(1).max(500),
  mjml_content: z.string().min(1),
  type: z.enum(['submission', 'consent', 'reminder', 'custom']).optional()
}).strip();

export const updateEmailTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  subject_template: z.string().min(1).max(500).optional(),
  mjml_content: z.string().min(1).optional(),
  type: z.enum(['submission', 'consent', 'reminder', 'custom']).optional()
}).strip();

// Calendar/Interview schemas
export const createInterviewSchema = z.object({
  pipeline_id: z.string().uuid(),
  scheduled_at: z.string().datetime().or(z.string()),
  duration_minutes: z.number().min(15).max(480).optional(),
  meeting_link: z.string().url().optional().or(z.literal('')),
  location: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  attendees: z.array(z.string().email()).optional()
}).strip();

export const updateInterviewSchema = z.object({
  scheduled_at: z.string().datetime().or(z.string()).optional(),
  duration_minutes: z.number().min(15).max(480).optional(),
  meeting_link: z.string().url().optional().or(z.literal('')),
  location: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
  outcome: z.string().max(5000).optional(),
  attendees: z.array(z.string().email()).optional()
}).strip();

// Settings schemas
export const updateSettingsSchema = z.object({
  llmModel: z.string().optional(),
  cvMode: z.enum(['nominative', 'anonymous']).optional(),
  chatbotEnabled: z.enum(['on', 'off']).optional(),
  webglEnabled: z.enum(['on', 'off']).optional(),
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
