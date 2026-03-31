/**
 * Validation Utilities
 * JavaScript version for Node.js backend
 */

import { z } from 'zod';
import { MAX_TEXT_LENGTH } from '../config/constants.js';
import { safeLog } from './logger.backend.js';
import { sanitizeDocumentFilename, sanitizeDocumentHtmlContent, sanitizeDocumentStylesheet } from './sanitizer.backend.js';

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
  job_title: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  role: z.preprocess(v => typeof v === 'string' ? v.toLowerCase() : v, z.enum(['user', 'admin'])).optional(),
  status: z.preprocess(v => typeof v === 'string' ? v.toLowerCase() : v, z.enum(['active', 'inactive', 'pending'])).optional(),
  customer: z.string().optional(),
  Customer: z.string().optional(),
  firm: z.string().optional(),
  Firm: z.string().optional()
});

// Mission schemas
const missionStatusSchema = z.enum(['Active', 'Closed', 'Draft', 'active', 'closed', 'draft']).optional();
const missionTitleSchema = z.string().min(1).max(500);
const missionOptionalArraySchema = z.union([z.string(), z.array(z.string())]).optional().nullable();

export const createMissionSchema = z.object({
  Title: missionTitleSchema.optional(),
  title: missionTitleSchema.optional(),
  Content: z.string().optional(),
  content: z.string().optional(),
  Status: missionStatusSchema,
  status: missionStatusSchema,
  Customer: z.string().optional(),
  customer: z.string().optional(),
  Firm: z.string().optional().nullable(),
  firm: z.string().optional().nullable(),
  'Client ID': z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  'Contact ID': z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  'Firm ID': z.string().uuid().optional().nullable(),
  firmId: z.string().uuid().optional().nullable(),
  firm_id: z.string().uuid().optional().nullable(),
  'Deal ID': z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  deal_id: z.string().uuid().optional().nullable(),
  Keywords: missionOptionalArraySchema,
  keywords: missionOptionalArraySchema,
  'Required Skills': missionOptionalArraySchema,
  requiredSkills: missionOptionalArraySchema,
  required_skills: missionOptionalArraySchema,
  'Preferred Skills': missionOptionalArraySchema,
  preferredSkills: missionOptionalArraySchema,
  preferred_skills: missionOptionalArraySchema
}).refine((data) => Boolean(data.Title || data.title), {
  message: 'Title is required',
  path: ['title']
});

export const updateMissionSchema = z.object({
  Title: missionTitleSchema.optional(),
  title: missionTitleSchema.optional(),
  Content: z.string().optional(),
  content: z.string().optional(),
  Status: missionStatusSchema,
  status: missionStatusSchema,
  'Client ID': z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  'Contact ID': z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  'Firm ID': z.string().uuid().optional().nullable(),
  firmId: z.string().uuid().optional().nullable(),
  firm_id: z.string().uuid().optional().nullable(),
  'Deal ID': z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  deal_id: z.string().uuid().optional().nullable(),
  Keywords: missionOptionalArraySchema,
  keywords: missionOptionalArraySchema,
  'Required Skills': missionOptionalArraySchema,
  requiredSkills: missionOptionalArraySchema,
  required_skills: missionOptionalArraySchema,
  'Preferred Skills': missionOptionalArraySchema,
  preferredSkills: missionOptionalArraySchema,
  preferred_skills: missionOptionalArraySchema
}).strip();

// Template schemas
const templateStatusSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }
    const normalized = value.toLowerCase();
    if (normalized === 'active' || normalized === 'inactive') {
      return normalized;
    }
    return value;
  },
  z.enum(['active', 'inactive'])
);

export const createTemplateSchema = z.object({
  Name: z.string().min(1).max(255).optional(),
  name: z.string().min(1).max(255).optional(),
  Description: z.string().optional(),
  description: z.string().optional(),
  HeaderContent: z.string().optional(),
  headerContent: z.string().optional(),
  TemplateContent: z.string().min(1).optional(),
  templateContent: z.string().min(1).optional(),
  FooterContent: z.string().optional(),
  footerContent: z.string().optional(),
  FooterHeight: z.number().min(10).max(250).optional(),
  footerHeight: z.number().min(10).max(250).optional(),
  Stylesheet: z.string().optional(),
  stylesheet: z.string().optional(),
  Status: templateStatusSchema.optional(),
  status: templateStatusSchema.optional(),
  Tags: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  Popular: z.boolean().optional(),
  popular: z.boolean().optional(),
  PreviewImage: z.string().optional(),
  previewImage: z.string().optional(),
  firm_id: z.string().uuid().optional().nullable(),
  firmId: z.string().uuid().optional().nullable(),
  FirmId: z.string().uuid().optional().nullable(),
  'Firm ID': z.string().uuid().optional().nullable()
}).strip().refine(
  (data) => Boolean(data.Name || data.name),
  { message: 'Template name is required', path: ['Name'] }
).refine(
  (data) => Boolean(data.TemplateContent || data.templateContent),
  { message: 'Template content is required', path: ['TemplateContent'] }
);

export const updateTemplateSchema = z.object({
  Name: z.string().min(1).max(255).optional(),
  name: z.string().min(1).max(255).optional(),
  Description: z.string().optional(),
  description: z.string().optional(),
  HeaderContent: z.string().optional(),
  headerContent: z.string().optional(),
  TemplateContent: z.string().optional(),
  templateContent: z.string().optional(),
  FooterContent: z.string().optional(),
  footerContent: z.string().optional(),
  FooterHeight: z.number().min(10).max(250).optional(),
  footerHeight: z.number().min(10).max(250).optional(),
  Stylesheet: z.string().optional(),
  stylesheet: z.string().optional(),
  Status: templateStatusSchema.optional(),
  status: templateStatusSchema.optional(),
  Tags: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  Popular: z.boolean().optional(),
  popular: z.boolean().optional(),
  PreviewImage: z.string().optional(),
  previewImage: z.string().optional(),
  firm_id: z.string().uuid().optional().nullable(),
  firmId: z.string().uuid().optional().nullable(),
  FirmId: z.string().uuid().optional().nullable(),
  'Firm ID': z.string().uuid().optional().nullable()
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
  job_title: z.string().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  role: lowercaseEnum(['user', 'admin']).optional(),
  status: lowercaseEnum(['active', 'inactive', 'pending']).optional(),
  firm_id: z.string().uuid().optional().nullable(),
  firmId: z.string().uuid().optional().nullable()
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
  title: z.string().min(1).max(500).optional(),
  Title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  Description: z.string().max(5000).optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  status: z.enum(['open', 'won', 'lost', 'on_hold']).optional(),
  Status: z.enum(['open', 'won', 'lost', 'on_hold']).optional(),
  expected_start_date: z.string().optional().nullable(),
  expectedStartDate: z.string().optional().nullable(),
  expected_end_date: z.string().optional().nullable(),
  expectedEndDate: z.string().optional().nullable(),
  budget_min: z.number().optional().nullable(),
  budgetMin: z.number().optional().nullable(),
  budget_max: z.number().optional().nullable(),
  budgetMax: z.number().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  Priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  tags: z.array(z.string()).optional(),
  Tags: z.array(z.string()).optional(),
  notes: z.string().max(5000).optional().nullable(),
  Notes: z.string().max(5000).optional().nullable()
}).strip().refine(
  (data) => Boolean(data.title || data.Title),
  { message: 'Deal title is required', path: ['title'] }
);

export const updateDealSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  Title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  Description: z.string().max(5000).optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  status: z.enum(['open', 'won', 'lost', 'on_hold']).optional(),
  Status: z.enum(['open', 'won', 'lost', 'on_hold']).optional(),
  expected_start_date: z.string().optional().nullable(),
  expectedStartDate: z.string().optional().nullable(),
  expected_end_date: z.string().optional().nullable(),
  expectedEndDate: z.string().optional().nullable(),
  budget_min: z.number().optional().nullable(),
  budgetMin: z.number().optional().nullable(),
  budget_max: z.number().optional().nullable(),
  budgetMax: z.number().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  Priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  tags: z.array(z.string()).optional(),
  Tags: z.array(z.string()).optional(),
  notes: z.string().max(5000).optional().nullable(),
  Notes: z.string().max(5000).optional().nullable()
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
  resume_id: z.string().uuid().optional(),
  resumeId: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  mission_id: z.string().uuid().optional().nullable(),
  missionId: z.string().uuid().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  Notes: z.string().max(5000).optional().nullable(),
  sent_at: z.string().optional().nullable(),
  sentAt: z.string().optional().nullable(),
  status: z.string().max(50).optional(),
  Status: z.string().max(50).optional()
}).strip().refine(
  (data) => Boolean(data.resume_id || data.resumeId),
  { message: 'Resume ID is required', path: ['resume_id'] }
).refine(
  (data) => Boolean(data.client_id || data.clientId),
  { message: 'Client ID is required', path: ['client_id'] }
).refine(
  (data) => Boolean(data.contact_id || data.contactId),
  { message: 'Contact ID is required', path: ['contact_id'] }
);

export const updateSubmissionSchema = z.object({
  status: z.string().max(50).optional(),
  Status: z.string().max(50).optional(),
  notes: z.string().max(5000).optional().nullable(),
  Notes: z.string().max(5000).optional().nullable()
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
  resumeId: z.string().uuid().optional(),
  resume_id: z.string().uuid().optional(),
  profileType: z.string().min(1).max(100).optional(),
  profile_type: z.string().min(1).max(100).optional(),
  candidateName: z.string().min(1).max(255).optional(),
  candidate_name: z.string().min(1).max(255).optional(),
  candidateEmail: z.string().email().optional(),
  candidate_email: z.string().email().optional()
}).strip().refine(
  (data) => Boolean(data.resumeId || data.resume_id),
  { message: 'Resume ID is required', path: ['resumeId'] }
).refine(
  (data) => Boolean(data.profileType || data.profile_type),
  { message: 'Profile type is required', path: ['profileType'] }
).refine(
  (data) => Boolean(data.candidateName || data.candidate_name),
  { message: 'Candidate name is required', path: ['candidateName'] }
);

export const respondConsentSchema = z.object({
  action: z.enum(['accept', 'refuse'])
}).strip();

// Mail draft schema
export const createMailDraftSchema = z.object({
  to: z.string().min(1).max(500),
  subject: z.string().max(1000).optional(),
  body: z.string().optional(),
  pdfBase64: z.string().optional(),
  pdf_base64: z.string().optional(),
  pdfFilename: z.string().max(500).optional(),
  pdf_filename: z.string().max(500).optional(),
  provider: z.enum(['gmail', 'outlook']).optional(),
  resumeId: z.string().uuid().optional().nullable(),
  resume_id: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  missionId: z.string().uuid().optional().nullable(),
  mission_id: z.string().uuid().optional().nullable(),
  versionNumber: z.number().optional().nullable(),
  version_number: z.number().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  template_id: z.string().uuid().optional().nullable(),
  templateContext: z.record(z.string(), z.any()).optional(),
  template_context: z.record(z.string(), z.any()).optional()
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

const MAX_BATCH_EXPORT_RESUMES = 100;

// Batch Export schema
export const batchExportSchema = z.object({
  resumeIds: z.array(z.string().uuid()).min(1).max(MAX_BATCH_EXPORT_RESUMES).optional(),
  resume_ids: z.array(z.string().uuid()).min(1).max(MAX_BATCH_EXPORT_RESUMES).optional(),
  templateId: z.string().uuid().optional(),
  template_id: z.string().uuid().optional(),
  format: z.enum(['pdf', 'docx']).optional(),
  exportFormat: z.enum(['pdf', 'docx']).optional(),
  export_format: z.enum(['pdf', 'docx']).optional()
}).strip().refine(
  (data) => Boolean(data.resumeIds || data.resume_ids),
  { message: 'resumeIds is required', path: ['resumeIds'] }
).refine(
  (data) => Boolean(data.templateId || data.template_id),
  { message: 'templateId is required', path: ['templateId'] }
);

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

const BACKUP_FILENAME_PATTERN = /^backup-(daily|weekly|monthly|manual)-[A-Za-z0-9_-]+-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.sql\.gz$/;

// Backup Restore schema
export const restoreBackupSchema = z.object({
  filename: z.string().min(1).max(255).regex(
    BACKUP_FILENAME_PATTERN,
    'Invalid backup filename format'
  ),
  confirmText: z.literal('RESTORE')
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

const DOCUMENT_PROXY_MAX_HTML_SIZE = 5 * 1024 * 1024;
const DOCUMENT_PROXY_MAX_SECTION_SIZE = 256 * 1024;
const DOCUMENT_PROXY_MAX_STYLESHEET_SIZE = 200 * 1024;

const footerHeightSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? undefined : Number(trimmed);
    }
    return value;
  },
  z.number().min(10).max(250)
).optional();

const documentHtmlSchema = z.string()
  .min(1)
  .max(DOCUMENT_PROXY_MAX_HTML_SIZE)
  .transform((value) => sanitizeDocumentHtmlContent(value))
  .refine((value) => value.trim().length > 0, {
    message: 'htmlContent cannot be empty after sanitization'
  });

const optionalDocumentSectionSchema = z.string()
  .max(DOCUMENT_PROXY_MAX_SECTION_SIZE)
  .transform((value) => sanitizeDocumentHtmlContent(value))
  .optional();

const documentStylesheetSchema = z.string()
  .max(DOCUMENT_PROXY_MAX_STYLESHEET_SIZE)
  .transform((value) => sanitizeDocumentStylesheet(value))
  .optional();

export const generatePdfProxySchema = z.object({
  htmlContent: documentHtmlSchema,
  filename: z.string().min(1).max(255),
  stylesheet: documentStylesheetSchema,
  headerContent: optionalDocumentSectionSchema,
  footerContent: optionalDocumentSectionSchema,
  footerHeight: footerHeightSchema,
  format: z.preprocess(
    (value) => typeof value === 'string' ? value.toLowerCase() : value,
    z.enum(['pdf']).optional()
  )
}).strict().transform((data) => ({
  htmlContent: data.htmlContent,
  filename: sanitizeDocumentFilename(data.filename, 'pdf'),
  stylesheet: data.stylesheet,
  headerContent: data.headerContent,
  footerContent: data.footerContent,
  footerHeight: data.footerHeight
}));

export const generateDocxProxySchema = z.object({
  htmlContent: documentHtmlSchema,
  filename: z.string().min(1).max(255),
  stylesheet: documentStylesheetSchema,
  headerContent: optionalDocumentSectionSchema,
  footerContent: optionalDocumentSectionSchema,
  footerHeight: footerHeightSchema,
  format: z.preprocess(
    (value) => typeof value === 'string' ? value.toLowerCase() : value,
    z.enum(['doc', 'docx']).optional()
  )
}).strict().transform((data) => {
  const format = data.format === 'doc' ? 'doc' : 'docx';
  return {
    ...data,
    format,
    filename: sanitizeDocumentFilename(data.filename, format)
  };
});
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
  language: z.string().max(10).optional(),
  lang: z.string().max(10).optional()
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
const resumeStringArraySchema = z.union([z.string(), z.array(z.string())]).optional();
const resumeFlexibleObjectSchema = z.union([z.string(), z.record(z.string(), z.any()), z.array(z.any())]).optional();
const resumeScoreSchema = z.union([z.string(), z.number()]).optional();
const resumeStatusSchema = z.enum(['Pending', 'Processing', 'Analyzed', 'Improved', 'Error', 'Active', 'active', 'analyzed', 'improved']).optional();

export const updateResumeSchema = z.object({
  'Original Text': z.string().max(MAX_TEXT_LENGTH).optional(),
  originalText: z.string().max(MAX_TEXT_LENGTH).optional(),
  original_text: z.string().max(MAX_TEXT_LENGTH).optional(),
  'Improved Text': z.string().max(MAX_TEXT_LENGTH).optional(),
  improvedText: z.string().max(MAX_TEXT_LENGTH).optional(),
  improved_text: z.string().max(MAX_TEXT_LENGTH).optional(),
  'Analysis': z.string().optional(),
  analysis: z.string().optional(),
  'Skills': resumeStringArraySchema,
  skills: resumeStringArraySchema,
  skills_raw: resumeStringArraySchema,
  'Industries': resumeStringArraySchema,
  industries: resumeStringArraySchema,
  'Tools': resumeStringArraySchema,
  tools: resumeStringArraySchema,
  'Soft Skills': resumeStringArraySchema,
  softSkills: resumeStringArraySchema,
  soft_skills: resumeStringArraySchema,
  'Key Improvements': resumeFlexibleObjectSchema,
  keyImprovements: resumeFlexibleObjectSchema,
  key_improvements: resumeFlexibleObjectSchema,
  'Original Score': resumeScoreSchema,
  'Improved Score': resumeScoreSchema,
  'Candidate Name': z.string().max(255).optional(),
  'Professional Title': z.string().max(255).optional(),
  'Status': resumeStatusSchema,
  status: resumeStatusSchema,
  'Analysis Date': z.string().optional(),
  analysisDate: z.string().optional(),
  analyzedAt: z.string().optional(),
  analyzed_at: z.string().optional(),
  'Last Improved': z.string().optional(),
  lastImproved: z.string().optional(),
  'CustomerName': z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  'Created At': z.string().optional(),
  createdAt: z.string().optional(),
  'Name': z.string().max(255).optional(),
  name: z.string().max(255).optional(),
  'Title': z.string().max(255).optional(),
  title: z.string().max(255).optional(),
  'Original Name': z.string().max(255).optional(),
  originalName: z.string().max(255).optional(),
  original_name: z.string().max(255).optional(),
  'Global Rating': resumeScoreSchema,
  globalRating: resumeScoreSchema,
  global_rating: resumeScoreSchema,
  'Executive Summary Score': resumeScoreSchema,
  executiveSummaryScore: resumeScoreSchema,
  executive_summary_score: resumeScoreSchema,
  'Skills Score': resumeScoreSchema,
  skillsScore: resumeScoreSchema,
  skills_score: resumeScoreSchema,
  'Experience Score': resumeScoreSchema,
  experienceScore: resumeScoreSchema,
  experience_score: resumeScoreSchema,
  'Education Score': resumeScoreSchema,
  educationScore: resumeScoreSchema,
  education_score: resumeScoreSchema,
  'ATS Score': resumeScoreSchema,
  atsScore: resumeScoreSchema,
  ats_score: resumeScoreSchema,
  'Hobbies Languages Score': resumeScoreSchema,
  hobbiesLanguagesScore: resumeScoreSchema,
  hobbies_languages_score: resumeScoreSchema,
  'Improved Global Rating': resumeScoreSchema,
  improvedGlobalRating: resumeScoreSchema,
  improved_global_rating: resumeScoreSchema,
  'Improved Skills Score': resumeScoreSchema,
  improvedSkillsScore: resumeScoreSchema,
  improved_skills_score: resumeScoreSchema,
  'Improved Experience Score': resumeScoreSchema,
  improvedExperienceScore: resumeScoreSchema,
  improved_experience_score: resumeScoreSchema,
  'Improved Education Score': resumeScoreSchema,
  improvedEducationScore: resumeScoreSchema,
  improved_education_score: resumeScoreSchema,
  'Improved ATS Score': resumeScoreSchema,
  improvedAtsScore: resumeScoreSchema,
  improved_ats_score: resumeScoreSchema,
  'Improved Executive Summary Score': resumeScoreSchema,
  improvedExecutiveSummaryScore: resumeScoreSchema,
  improved_executive_summary_score: resumeScoreSchema,
  'Improved Hobbies Languages Score': resumeScoreSchema,
  improvedHobbiesLanguagesScore: resumeScoreSchema,
  improved_hobbies_languages_score: resumeScoreSchema,
  'Skills_cleaned': z.array(z.string()).optional(),
  skillsCleaned: z.array(z.string()).optional(),
  skills_cleaned: z.array(z.string()).optional(),
  'Industries_cleaned': z.array(z.string()).optional(),
  industriesCleaned: z.array(z.string()).optional(),
  industries_cleaned: z.array(z.string()).optional(),
  'Tools_cleaned': z.array(z.string()).optional(),
  toolsCleaned: z.array(z.string()).optional(),
  tools_cleaned: z.array(z.string()).optional(),
  'Soft Skills_cleaned': z.array(z.string()).optional(),
  softSkillsCleaned: z.array(z.string()).optional(),
  soft_skills_cleaned: z.array(z.string()).optional(),
  'Skills_esco': z.array(z.any()).optional(),
  skillsEsco: z.array(z.any()).optional(),
  skills_esco: z.array(z.any()).optional(),
  'Industries_esco': z.array(z.any()).optional(),
  industriesEsco: z.array(z.any()).optional(),
  industries_esco: z.array(z.any()).optional(),
  'Tools_esco': z.array(z.any()).optional(),
  toolsEsco: z.array(z.any()).optional(),
  tools_esco: z.array(z.any()).optional(),
  'Soft Skills_esco': z.array(z.any()).optional(),
  softSkillsEsco: z.array(z.any()).optional(),
  soft_skills_esco: z.array(z.any()).optional(),
  // Improved tags (after LLM improvement)
  'Improved Skills': resumeStringArraySchema,
  improvedSkills: resumeStringArraySchema,
  improved_skills: resumeStringArraySchema,
  'Improved Industries': resumeStringArraySchema,
  improvedIndustries: resumeStringArraySchema,
  improved_industries: resumeStringArraySchema,
  'Improved Tools': resumeStringArraySchema,
  improvedTools: resumeStringArraySchema,
  improved_tools: resumeStringArraySchema,
  'Improved Soft Skills': resumeStringArraySchema,
  improvedSoftSkills: resumeStringArraySchema,
  improved_soft_skills: resumeStringArraySchema,
  'Improved Key Improvements': resumeFlexibleObjectSchema,
  improvedKeyImprovements: resumeFlexibleObjectSchema,
  improved_key_improvements: resumeFlexibleObjectSchema,
  Summary: z.string().optional(),
  summary: z.string().optional(),
  'Experience Years': z.union([z.string(), z.number()]).optional(),
  experienceYears: z.union([z.string(), z.number()]).optional(),
  experience_years: z.union([z.string(), z.number()]).optional(),
  'Education Level': z.string().optional(),
  educationLevel: z.string().optional(),
  education_level: z.string().optional(),
  Certifications: z.string().optional(),
  certifications: z.string().optional(),
  Languages: z.string().optional(),
  languages: z.string().optional(),
  'FirmName': z.string().max(255).optional(),
  firmName: z.string().max(255).optional(),
  firm_name: z.string().max(255).optional()
}).strip();

// (improveTextSchema moved above with LLM Handler schemas)

// (matchResumeSchema / adaptResumeSchema replaced by missionIdBodySchema above)

const anthropicContentBlockSchema = z.union([
  z.object({
    type: z.literal('text'),
    text: z.string().max(100000)
  }),
  z.object({
    type: z.literal('thinking'),
    thinking: z.string().max(100000)
  }),
  z.object({
    type: z.string(),
    text: z.string().max(100000).optional(),
    thinking: z.string().max(100000).optional(),
    content: z.string().max(100000).optional()
  })
]);

// LLM message schema
const llmMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().max(100000)
});

const anthropicMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.union([
    z.string().max(100000),
    z.array(anthropicContentBlockSchema).min(1).max(1000)
  ])
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
  messages: z.array(anthropicMessageSchema).min(1).max(50),
  max_tokens: z.number().min(1).max(200000).optional(),
  temperature: z.number().min(0).max(1).optional(),
  system: z.union([
    z.string().max(100000),
    z.array(anthropicContentBlockSchema).min(1).max(1000)
  ]).optional()
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
  adaptedText: z.string().optional(),
  adapted_text: z.string().optional(),
  'Adapted Title': z.string().max(500).optional().nullable(),
  adaptedTitle: z.string().max(500).optional().nullable(),
  adapted_title: z.string().max(500).optional().nullable(),
  Status: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  'Match Score': z.union([z.string(), z.number()]).optional(),
  matchScore: z.union([z.string(), z.number()]).optional(),
  match_score: z.union([z.string(), z.number()]).optional(),
  'Match Analysis': z.string().optional(),
  matchAnalysis: z.string().optional(),
  match_analysis: z.string().optional()
}).strict();

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
  job_title: z.string().max(255).optional(),
  jobTitle: z.string().max(255).optional(),
  is_primary: z.boolean().optional(),
  isPrimary: z.boolean().optional()
}).strip();

export const updateContactSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  role: z.string().max(255).optional(),
  job_title: z.string().max(255).optional(),
  jobTitle: z.string().max(255).optional(),
  is_primary: z.boolean().optional(),
  isPrimary: z.boolean().optional()
}).strip();

// Pipeline schemas
const pipelineStageSchema = z.enum(['new', 'sourced', 'screening', 'interview', 'offer', 'hired', 'rejected']);

export const createPipelineEntrySchema = z.object({
  resume_id: z.string().uuid().optional(),
  resumeId: z.string().uuid().optional(),
  mission_id: z.string().uuid().optional().nullable(),
  missionId: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  stage: pipelineStageSchema.optional(),
  notes: z.string().max(5000).optional(),
  Notes: z.string().max(5000).optional()
}).strip().refine(
  (data) => Boolean(data.resume_id || data.resumeId),
  { message: 'Resume ID is required', path: ['resume_id'] }
);

export const updatePipelineEntrySchema = z.object({
  stage: pipelineStageSchema.optional(),
  notes: z.string().max(5000).optional(),
  Notes: z.string().max(5000).optional(),
  mission_id: z.string().uuid().optional().nullable(),
  missionId: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable()
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
  llmProvider: z.enum(['openai', 'anthropic', 'deepseek', 'glm', 'minimax', 'ollama']).optional(),
  llmModel: z.string().max(100).optional(),
  ollamaBaseUrl: z.string().url().max(500).optional(),
  ollamaVisionModel: z.string().max(100).optional(),
  ollamaKeepAlive: z.string().max(50).optional(),
  ollamaNumCtx: z.coerce.number().min(1024).max(262144).optional(),
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



