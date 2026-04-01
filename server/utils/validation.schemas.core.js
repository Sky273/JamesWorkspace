import { z } from 'zod';

// Common schemas
export const emailSchema = z.string().email().max(255);
export const passwordSchema = z.string().min(8).max(100);
export const nameSchema = z.string().min(1).max(255);

// Auth schemas
export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  totpCode: z.string().min(6).max(8).optional()
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
}).refine(
  (data) => Boolean(
    [data.firm, data.Firm, data.customer, data.Customer]
      .some((value) => typeof value === 'string' && value.trim())
  ),
  { message: 'Firm is required', path: ['firm'] }
);

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

export const lowercaseEnum = (values) => z.preprocess(
  (val) => (typeof val === 'string' ? val.toLowerCase() : val),
  z.enum(values)
);

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
  Firm: z.string().max(255).optional(),
  customer: z.string().max(255).optional(),
  Customer: z.string().max(255).optional()
}).strip().refine(
  (data) => Boolean(
    [data.firm, data.Firm, data.customer, data.Customer]
      .some((value) => typeof value === 'string' && value.trim())
  ),
  { message: 'Firm is required', path: ['firm'] }
);

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
