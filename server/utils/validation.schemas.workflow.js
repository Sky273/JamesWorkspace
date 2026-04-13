import { z } from 'zod';

export const createDealSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  status: z.enum(['open', 'won', 'lost', 'on_hold']).optional(),
  expectedStartDate: z.string().optional().nullable(),
  expected_start_date: z.string().optional().nullable(),
  expectedEndDate: z.string().optional().nullable(),
  expected_end_date: z.string().optional().nullable(),
  budgetMin: z.number().optional().nullable(),
  budget_min: z.number().optional().nullable(),
  budgetMax: z.number().optional().nullable(),
  budget_max: z.number().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(5000).optional().nullable()
}).strip().refine(
  (data) => Boolean(data.title),
  { message: 'Deal title is required', path: ['title'] }
);

export const updateDealSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  status: z.enum(['open', 'won', 'lost', 'on_hold']).optional(),
  expectedStartDate: z.string().optional().nullable(),
  expected_start_date: z.string().optional().nullable(),
  expectedEndDate: z.string().optional().nullable(),
  expected_end_date: z.string().optional().nullable(),
  budgetMin: z.number().optional().nullable(),
  budget_min: z.number().optional().nullable(),
  budgetMax: z.number().optional().nullable(),
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

export const createSubmissionSchema = z.object({
  resumeId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  missionId: z.string().uuid().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  sentAt: z.string().optional().nullable(),
  status: z.string().max(50).optional()
}).strip().refine(
  (data) => Boolean(data.resumeId),
  { message: 'Resume ID is required', path: ['resumeId'] }
).refine(
  (data) => Boolean(data.clientId),
  { message: 'Client ID is required', path: ['clientId'] }
).refine(
  (data) => Boolean(data.contactId),
  { message: 'Contact ID is required', path: ['contactId'] }
);

export const updateSubmissionSchema = z.object({
  status: z.string().max(50).optional(),
  notes: z.string().max(5000).optional().nullable()
}).strip();

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

export const initializeConsentSchema = z.object({
  resumeId: z.string().uuid().optional(),
  profileType: z.string().min(1).max(100).optional(),
  candidateName: z.string().min(1).max(255).optional(),
  candidateEmail: z.string().email().optional()
}).strip().refine(
  (data) => Boolean(data.resumeId),
  { message: 'Resume ID is required', path: ['resumeId'] }
).refine(
  (data) => Boolean(data.profileType),
  { message: 'Profile type is required', path: ['profileType'] }
).refine(
  (data) => Boolean(data.candidateName),
  { message: 'Candidate name is required', path: ['candidateName'] }
);

export const respondConsentSchema = z.object({
  action: z.enum(['accept', 'refuse'])
}).strip();

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

export const updateAdaptationSchema = z.object({
  adaptedText: z.string().optional(),
  adaptedTitle: z.string().max(500).optional().nullable(),
  status: z.string().max(50).optional(),
  matchScore: z.union([z.string(), z.number()]).optional(),
  matchAnalysis: z.string().optional()
}).strict();

const pipelineStageSchema = z.enum(['new', 'sourced', 'screening', 'interview', 'offer', 'hired', 'rejected']);

export const createPipelineEntrySchema = z.object({
  resumeId: z.string().uuid().optional(),
  adaptationId: z.string().uuid().optional().nullable(),
  missionId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  stage: pipelineStageSchema.optional(),
  notes: z.string().max(5000).optional()
}).strip().refine(
  (data) => Boolean(data.resumeId),
  { message: 'Resume ID is required', path: ['resumeId'] }
);

export const updatePipelineEntrySchema = z.object({
  stage: pipelineStageSchema.optional(),
  notes: z.string().max(5000).optional(),
  missionId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable()
}).strip();

export const createEmailTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  subjectTemplate: z.string().min(1).max(500),
  mjmlContent: z.string().min(1),
  type: z.enum(['submission', 'consent', 'reminder', 'custom']).optional()
}).strip();

export const updateEmailTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  subjectTemplate: z.string().min(1).max(500).optional(),
  mjmlContent: z.string().min(1).optional(),
  type: z.enum(['submission', 'consent', 'reminder', 'custom']).optional()
}).strip();

export const createInterviewSchema = z.object({
  pipelineId: z.string().uuid(),
  scheduledAt: z.string().datetime().or(z.string()),
  durationMinutes: z.number().min(15).max(480).optional(),
  meetingLink: z.string().url().optional().or(z.literal('')),
  location: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  attendees: z.array(z.string().email()).optional()
}).strip();

export const updateInterviewSchema = z.object({
  scheduledAt: z.string().datetime().or(z.string()).optional(),
  durationMinutes: z.number().min(15).max(480).optional(),
  meetingLink: z.string().url().optional().or(z.literal('')),
  location: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
  outcome: z.string().max(5000).optional(),
  attendees: z.array(z.string().email()).optional()
}).strip();
