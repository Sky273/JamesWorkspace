
const validateTemplateData = (data) => {
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

  if (data.popular && typeof data.popular !== 'boolean') {
    throw new Error('Popular must be a boolean.');
  }

  if (data.stylesheet && typeof data.stylesheet !== 'string') {
    throw new Error('Stylesheet must be a string.');
  }
};

const sanitizeTemplateData = (data) => {
  // Remove undefined values and ensure correct types
  const sanitized = {
    Name: data.name?.trim(),
    Description: data.description?.trim(),
    HeaderContent: data.headerContent?.trim() || '',
    TemplateContent: data.templateContent?.trim(),
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
    Object.entries(sanitized).filter(([_, value]) => value != null)
  );
};

import { fetchWithAuth, createAuthOptions, createAuthOptionsWithCsrf } from './apiInterceptor';
import logger from './logger.frontend';

export const templateService = {
  // Get only active templates (for export/selection purposes)
  async getAllTemplates() {
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

  async getTemplatesPaginated({ page = 1, pageSize = 12, search = '', status = '' } = {}) {
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

  async getTemplateById(id) {
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

  async createTemplate(templateData) {
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

  async updateTemplate(id, templateData) {
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

  async deleteTemplate(id) {
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
  }
};
