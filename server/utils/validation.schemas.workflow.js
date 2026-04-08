import { z } from 'zod';

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

const pipelineStageSchema = z.enum(['new', 'sourced', 'screening', 'interview', 'offer', 'hired', 'rejected']);

export const createPipelineEntrySchema = z.object({
  resume_id: z.string().uuid().optional(),
  resumeId: z.string().uuid().optional(),
  adaptation_id: z.string().uuid().optional().nullable(),
  adaptationId: z.string().uuid().optional().nullable(),
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
