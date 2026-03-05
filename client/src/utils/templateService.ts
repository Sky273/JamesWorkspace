/**
 * Template Service for CV templates
 */

import { fetchWithAuth, createAuthOptions, createAuthOptionsWithCsrf } from './apiInterceptor';
import logger from './logger.frontend';

export interface Template {
    id: string;
    Name: string;
    Description?: string;
    HeaderContent?: string;
    TemplateContent: string;
    FooterContent?: string;
    FooterHeight?: number;
    Status: string;
    Tags?: string[];
    Popular?: boolean;
    Stylesheet?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface TemplateData {
    name: string;
    description?: string;
    headerContent?: string;
    templateContent: string;
    footerContent?: string;
    footerHeight?: number;
    status?: string;
    tags?: string[];
    popular?: boolean;
    stylesheet?: string;
}

export interface Pagination {
    page: number;
    pageSize: number;
    totalCount: number;
    hasMore: boolean;
}

export interface GetTemplatesPaginatedParams {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
}

interface SanitizedTemplateData {
    Name: string;
    Description?: string;
    HeaderContent: string;
    TemplateContent: string;
    FooterContent: string;
    FooterHeight: number;
    Status: string;
    Tags: string[];
    Popular?: boolean;
    Stylesheet?: string;
}

const validateTemplateData = (data: TemplateData): void => {
    if (!data.name || typeof data.name !== 'string') {
        throw new Error('Name is a required field and must be a string.');
    }

    if (!data.templateContent || typeof data.templateContent !== 'string') {
        throw new Error('TemplateContent is a required field and must be a string.');
    }

    if (data.status && typeof data.status !== 'string') {
        throw new Error('Status must be a string.');
    }

    if (data.tags && !Array.isArray(data.tags)) {
        throw new Error('Tags must be an array.');
    }

    if (data.popular !== undefined && typeof data.popular !== 'boolean') {
        throw new Error('Popular must be a boolean.');
    }

    if (data.stylesheet && typeof data.stylesheet !== 'string') {
        throw new Error('Stylesheet must be a string.');
    }
};

const sanitizeTemplateData = (data: TemplateData): SanitizedTemplateData => {
    // Remove undefined values and ensure correct types
    const sanitized: SanitizedTemplateData = {
        Name: data.name?.trim() || '',
        Description: data.description?.trim(),
        HeaderContent: data.headerContent?.trim() || '',
        TemplateContent: data.templateContent?.trim() || '',
        FooterContent: data.footerContent?.trim() || '',
        FooterHeight: typeof data.footerHeight === 'number' ? data.footerHeight : 25,
        Status: data.status || 'Active',
        Tags: Array.isArray(data.tags) ? data.tags : [],
    };

    // Only include Popular if it's a boolean
    if (typeof data.popular === 'boolean') {
        sanitized.Popular = data.popular;
    }

    // Only include Stylesheet if it's a string
    if (typeof data.stylesheet === 'string') {
        sanitized.Stylesheet = data.stylesheet.trim();
    }

    // Remove any remaining undefined or null values
    return Object.fromEntries(
        Object.entries(sanitized).filter(([, value]) => value != null)
    ) as SanitizedTemplateData;
};

export interface ExtractedTemplate {
    name: string;
    description: string;
    headerContent: string;
    templateContent: string;
    footerContent: string;
    stylesheet: string;
    footerHeight: number;
    tags: string[];
    extractedColors?: string[];
    extractedFonts?: string[];
    layoutDescription?: string;
}

export interface ExtractTemplateResponse {
    success: boolean;
    template: ExtractedTemplate;
    model: string;
    extractionMethod?: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export const templateService = {
    // Get only active templates (for export/selection purposes)
    async getAllTemplates(): Promise<Template[]> {
        try {
            const response = await fetchWithAuth('/api/templates?limit=100&status=Active', createAuthOptions());
            if (!response.ok) {
                throw new Error('Failed to fetch templates');
            }
            const data = await response.json();
            // Handle paginated response
            return data.data || data;
        } catch (error) {
            logger.error('Error fetching templates:', error);
            throw error;
        }
    },

    async getTemplatesPaginated({ page = 1, pageSize = 12, search = '', status = '' }: GetTemplatesPaginatedParams = {}): Promise<{ templates: Template[]; pagination: Pagination }> {
        try {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('limit', pageSize.toString());
            if (search) params.append('search', search);
            if (status) params.append('status', status);

            const response = await fetchWithAuth(`/api/templates?${params.toString()}`, createAuthOptions());
            if (!response.ok) {
                throw new Error('Failed to fetch templates');
            }
            const data = await response.json();
            
            // Handle paginated response
            if (data.data && data.pagination) {
                return {
                    templates: data.data,
                    pagination: data.pagination
                };
            }
            
            // Fallback for non-paginated response
            return {
                templates: Array.isArray(data) ? data : [],
                pagination: {
                    page: 1,
                    pageSize: Array.isArray(data) ? data.length : 0,
                    totalCount: Array.isArray(data) ? data.length : 0,
                    hasMore: false
                }
            };
        } catch (error) {
            logger.error('Error fetching paginated templates:', error);
            throw error;
        }
    },

    async getTemplateById(id: string): Promise<Template> {
        try {
            const response = await fetchWithAuth(`/api/templates/${id}`, createAuthOptions());
            if (!response.ok) {
                throw new Error('Failed to fetch template');
            }
            return await response.json();
        } catch (error) {
            logger.error('Error fetching template:', error);
            throw error;
        }
    },

    async createTemplate(templateData: TemplateData): Promise<Template> {
        try {
            validateTemplateData(templateData);
            const sanitizedFields = sanitizeTemplateData(templateData);
            const authOptions = await createAuthOptionsWithCsrf({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sanitizedFields)
            });
            const response = await fetchWithAuth('/api/templates', authOptions);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Invalid template data. Please check all required fields are filled correctly.');
            }
            return await response.json();
        } catch (error) {
            logger.error('Error creating template:', error);
            throw error;
        }
    },

    async updateTemplate(id: string, templateData: TemplateData): Promise<Template> {
        try {
            validateTemplateData(templateData);
            const sanitizedFields = sanitizeTemplateData(templateData);
            const authOptions = await createAuthOptionsWithCsrf({
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sanitizedFields)
            });
            const response = await fetchWithAuth(`/api/templates/${id}`, authOptions);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Invalid template data. Please check all required fields are filled correctly.');
            }
            return await response.json();
        } catch (error) {
            logger.error('Error updating template:', error);
            throw error;
        }
    },

    async deleteTemplate(id: string): Promise<{ success: boolean }> {
        try {
            const authOptions = await createAuthOptionsWithCsrf({
                method: 'DELETE'
            });
            const response = await fetchWithAuth(`/api/templates/${id}`, authOptions);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete template');
            }
            return await response.json();
        } catch (error) {
            logger.error('Error deleting template:', error);
            throw error;
        }
    },

    async extractFromCV(file: File): Promise<ExtractTemplateResponse> {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const authOptions = await createAuthOptionsWithCsrf({
                method: 'POST',
                body: formData
            });
            
            // Remove Content-Type header to let browser set it with boundary for multipart
            if (authOptions.headers && 'Content-Type' in authOptions.headers) {
                delete (authOptions.headers as Record<string, string>)['Content-Type'];
            }

            // Use extended timeout for template extraction (5 minutes)
            // This operation involves LLM processing which can take several minutes
            const EXTRACTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
            
            const response = await fetchWithAuth('/api/templates/extract-from-cv', authOptions, EXTRACTION_TIMEOUT);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || 'Failed to extract template from CV');
            }
            
            return await response.json();
        } catch (error) {
            logger.error('Error extracting template from CV:', error);
            throw error;
        }
    }
};
