/**
 * Email Template Service
 * Frontend service for email template CRUD operations
 */

import { fetchWithAuth, authPost, authPut, authDelete } from '../utils/apiInterceptor';
import { EmailTemplate, EmailTemplateFormData, EmailTemplateContext, EmailTemplateKeywords } from '../types/entities';

const API_BASE = '/api/email-templates';

/**
 * Get all templates for the current user's firm
 */
export async function getTemplates(): Promise<EmailTemplate[]> {
  const response = await fetchWithAuth(API_BASE);
  if (!response.ok) {
    throw new Error('Failed to fetch email templates');
  }
  const data = await response.json();
  return data.templates || [];
}

/**
 * Get a single template by ID
 */
export async function getTemplate(id: string): Promise<EmailTemplate> {
  const response = await fetchWithAuth(`${API_BASE}/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch email template');
  }
  const data = await response.json();
  return data.template;
}

/**
 * Get the default template for the current user's firm
 */
export async function getDefaultTemplate(): Promise<EmailTemplate | null> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/default`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch default template');
    }
    const data = await response.json();
    return data.template;
  } catch {
    return null;
  }
}

/**
 * Get available keywords for template substitution
 */
export async function getKeywords(): Promise<EmailTemplateKeywords> {
  const response = await fetchWithAuth(`${API_BASE}/keywords`);
  if (!response.ok) {
    throw new Error('Failed to fetch keywords');
  }
  const data = await response.json();
  return data.keywords;
}

/**
 * Create a new template
 */
export async function createTemplate(data: EmailTemplateFormData): Promise<EmailTemplate> {
  const response = await authPost(API_BASE, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create template');
  }
  const result = await response.json();
  return result.template;
}

/**
 * Update an existing template
 */
export async function updateTemplate(id: string, data: EmailTemplateFormData): Promise<EmailTemplate> {
  const response = await authPut(`${API_BASE}/${id}`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update template');
  }
  const result = await response.json();
  return result.template;
}

/**
 * Delete a template
 */
export async function deleteTemplate(id: string): Promise<void> {
  const response = await authDelete(`${API_BASE}/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete template');
  }
}

/**
 * Duplicate a template
 */
export async function duplicateTemplate(id: string): Promise<EmailTemplate> {
  const response = await authPost(`${API_BASE}/${id}/duplicate`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to duplicate template');
  }
  const result = await response.json();
  return result.template;
}

/**
 * Preview a template with context data
 */
export async function previewTemplate(id: string, context?: EmailTemplateContext): Promise<{ subject: string; html: string }> {
  const response = await authPost(`${API_BASE}/${id}/preview`, { context });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to preview template');
  }
  return response.json();
}

/**
 * Compile MJML content to HTML (for live preview in editor)
 */
export async function compileMjml(
  mjmlContent: string, 
  subjectTemplate?: string, 
  context?: EmailTemplateContext
): Promise<{ subject: string; html: string }> {
  const response = await authPost(`${API_BASE}/compile`, { mjmlContent, subjectTemplate, context });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to compile MJML');
  }
  return response.json();
}

export default {
  getTemplates,
  getTemplate,
  getDefaultTemplate,
  getKeywords,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  previewTemplate,
  compileMjml
};
