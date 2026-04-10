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
  name: nameSchema,
  jobTitle: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  role: z.preprocess(v => typeof v === 'string' ? v.toLowerCase() : v, z.enum(['user', 'admin'])).optional(),
  status: z.preprocess(v => typeof v === 'string' ? v.toLowerCase() : v, z.enum(['active', 'inactive', 'pending'])).optional(),
  firmId: z.string().uuid().optional().nullable()
}).refine(
  (data) => typeof data.firmId === 'string' && data.firmId.trim().length > 0,
  { message: 'Firm is required', path: ['firmId'] }
);

// Mission schemas
const missionStatusSchema = z.enum(['Active', 'Closed', 'Draft', 'active', 'closed', 'draft']).optional();
const missionTitleSchema = z.string().min(1).max(500);
const missionOptionalArraySchema = z.union([z.string(), z.array(z.string())]).optional().nullable();

export const createMissionSchema = z.object({
  title: missionTitleSchema.optional(),
  content: z.string().optional(),
  status: missionStatusSchema,
  customer: z.string().optional(),
  firm: z.string().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  firmId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  keywords: missionOptionalArraySchema,
  requiredSkills: missionOptionalArraySchema,
  preferredSkills: missionOptionalArraySchema
}).refine((data) => Boolean(data.title), {
  message: 'Title is required',
  path: ['title']
});

export const updateMissionSchema = z.object({
  title: missionTitleSchema.optional(),
  content: z.string().optional(),
  status: missionStatusSchema,
  clientId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  firmId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  keywords: missionOptionalArraySchema,
  requiredSkills: missionOptionalArraySchema,
  preferredSkills: missionOptionalArraySchema
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
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  headerContent: z.string().optional(),
  templateContent: z.string().min(1).optional(),
  footerContent: z.string().optional(),
  footerHeight: z.number().min(10).max(250).optional(),
  stylesheet: z.string().optional(),
  status: templateStatusSchema.optional(),
  tags: z.array(z.string()).optional(),
  popular: z.boolean().optional(),
  previewImage: z.string().optional(),
  firmId: z.string().uuid().optional().nullable()
}).strip().refine(
  (data) => Boolean(data.name),
  { message: 'Template name is required', path: ['name'] }
).refine(
  (data) => Boolean(data.templateContent),
  { message: 'Template content is required', path: ['templateContent'] }
);

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  headerContent: z.string().optional(),
  templateContent: z.string().optional(),
  footerContent: z.string().optional(),
  footerHeight: z.number().min(10).max(250).optional(),
  stylesheet: z.string().optional(),
  status: templateStatusSchema.optional(),
  tags: z.array(z.string()).optional(),
  popular: z.boolean().optional(),
  previewImage: z.string().optional(),
  firmId: z.string().uuid().optional().nullable()
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
  status: lowercaseEnum(['active', 'inactive', 'pending']).optional(),
  role: lowercaseEnum(['user', 'admin']).optional(),
  jobTitle: z.string().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  firmId: z.string().uuid().optional().nullable()
}).strip().refine(
  (data) => typeof data.firmId === 'string' && data.firmId.trim().length > 0,
  { message: 'Firm is required', path: ['firmId'] }
);

export const updateUserProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  jobTitle: z.string().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable()
}).strip();
