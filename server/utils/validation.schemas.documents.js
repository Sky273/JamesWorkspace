import { z } from 'zod';
import { MAX_TEXT_LENGTH } from '../config/constants.js';
import {
  sanitizeDocumentFilename,
  sanitizeDocumentHtmlContent,
  sanitizeDocumentStylesheet
} from './sanitizer.backend.js';

const MAX_BATCH_EXPORT_RESUMES = 100;
const BACKUP_FILENAME_PATTERN = /^backup-(daily|weekly|monthly|manual)-[A-Za-z0-9_-]+-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.sql\.gz$/;
const DOCUMENT_PROXY_MAX_HTML_SIZE = 5 * 1024 * 1024;
const DOCUMENT_PROXY_MAX_SECTION_SIZE = 256 * 1024;
const DOCUMENT_PROXY_MAX_STYLESHEET_SIZE = 200 * 1024;
const REMOTE_IMAGE_SOURCE_PATTERN = /<img\b[^>]*\bsrc\s*=\s*(["']?)(?:https?:|file:|ftp:|blob:|javascript:|vbscript:|\/\/)/i;

function hasRemoteImageSource(value) {
  return typeof value === 'string' && REMOTE_IMAGE_SOURCE_PATTERN.test(value);
}

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
  })
  .refine((value) => !hasRemoteImageSource(value), {
    message: 'htmlContent contains remote image sources'
  });

const optionalDocumentSectionSchema = z.string()
  .max(DOCUMENT_PROXY_MAX_SECTION_SIZE)
  .transform((value) => sanitizeDocumentHtmlContent(value))
  .refine((value) => !hasRemoteImageSource(value), {
    message: 'document section contains remote image sources'
  })
  .optional();

const documentStylesheetSchema = z.string()
  .max(DOCUMENT_PROXY_MAX_STYLESHEET_SIZE)
  .transform((value) => sanitizeDocumentStylesheet(value))
  .optional();

export const batchExportSchema = z.object({
  resumeIds: z.array(z.string().uuid()).min(1).max(MAX_BATCH_EXPORT_RESUMES).optional(),
  templateId: z.string().uuid().optional(),
  format: z.enum(['pdf', 'docx']).optional(),
  exportFormat: z.enum(['pdf', 'docx']).optional()
}).strip().refine(
  (data) => Boolean(data.resumeIds),
  { message: 'resumeIds is required', path: ['resumeIds'] }
).refine(
  (data) => Boolean(data.templateId),
  { message: 'templateId is required', path: ['templateId'] }
);

export const restoreBackupSchema = z.object({
  filename: z.string().min(1).max(255).regex(
    BACKUP_FILENAME_PATTERN,
    'Invalid backup filename format'
  ),
  confirmText: z.literal('RESTORE')
}).strip();

export const sharePdfSchema = z.object({
  htmlContent: documentHtmlSchema,
  filename: z.string().min(1).max(255).optional(),
  stylesheet: documentStylesheetSchema,
  headerContent: optionalDocumentSectionSchema,
  footerContent: optionalDocumentSectionSchema,
  footerHeight: footerHeightSchema,
  format: z.preprocess(
    (value) => typeof value === 'string' ? value.toLowerCase() : value,
    z.enum(['pdf', 'doc', 'docx']).optional()
  )
}).strict().transform((data) => ({
  htmlContent: data.htmlContent,
  filename: data.filename ? sanitizeDocumentFilename(data.filename, data.format || '') : undefined,
  stylesheet: data.stylesheet,
  headerContent: data.headerContent,
  footerContent: data.footerContent,
  footerHeight: data.footerHeight,
  format: data.format || 'pdf'
}));

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

export const gdprMailTestSchema = z.object({
  email: z.string().email()
}).strip();

export const gdprMailConfigSchema = z.object({
  provider: z.enum(['gmail', 'smtp', 'auto']),
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().max(255).optional(),
  smtpPassword: z.string().max(1000).optional(),
  clearSmtpPassword: z.boolean().optional(),
  smtpFromName: z.string().max(255).optional(),
  smtpFromEmail: z.string().max(255).optional(),
  googleGdprRedirectUri: z.union([z.string().url().max(500), z.literal('')]).optional()
}).strict();

export const gdprMailTestWithConfigSchema = gdprMailConfigSchema.extend({
  email: z.string().email()
}).strict();

export const findProfilesSchema = z.object({
  limit: z.number().min(0).max(100).optional(),
  minScore: z.number().min(0).max(100).optional(),
  status: z.string().max(50).optional(),
  weights: z.record(z.string(), z.number()).optional(),
  dealId: z.string().uuid().optional().nullable()
}).strip();

export const escoRecalculateSchema = z.object({
  language: z.string().max(10).optional(),
  lang: z.string().max(10).optional()
}).strip();

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

export const previewEmailTemplateSchema = z.object({
  context: z.record(z.string(), z.any()).optional()
}).strip();

export const googleTokenSchema = z.object({
  idToken: z.string().min(1)
}).strip();

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

export const openaiRequestSchema = z.object({
  model: z.string().max(100).optional(),
  messages: z.array(llmMessageSchema).min(1).max(50),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().min(1).max(128000).optional(),
  stream: z.boolean().optional()
}).passthrough();

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

export const chatbotRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).max(50).optional()
});
