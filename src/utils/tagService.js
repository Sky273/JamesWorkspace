// Tag service for managing tags
import { fetchWithAuth, createAuthOptions, createAuthOptionsWithCsrf } from './apiInterceptor';
import logger from './logger.frontend';

const tagService = {
  async getAllTags() {
    try {
      const response = await fetchWithAuth('/api/tags', createAuthOptions({ method: 'GET' }));
      if (!response.ok) {
        // Silently fail if not authenticated yet
        if (response.status === 401 || response.status === 403) {
          logger.warn('Tags fetch skipped - not authenticated');
          return { Skills: [], Industries: [], Tools: [], 'Soft Skills': [] };
        }
        throw new Error('Failed to fetch tags');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error fetching tags:', error);
      throw error;
    }
  },

  async renameTag(category, oldName, newName) {
    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category, oldName, newName })
      });
      const response = await fetchWithAuth('/api/tags/rename', authOptions);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rename tag');
      }
      const result = await response.json();
      logger.log(result.message);
      return result;
    } catch (error) {
      logger.error('Error renaming tag:', error);
      throw error;
    }
  },

  async recalculateCleanedTags() {
    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const response = await fetchWithAuth('/api/tags/cleaned/recalculate', authOptions);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to recalculate cleaned tags');
      }
      const result = await response.json();
      logger.log(result.message);
      return result;
    } catch (error) {
      logger.error('Error recalculating cleaned tags:', error);
      throw error;
    }
  },

  async getCleanedTags() {
    try {
      const response = await fetchWithAuth('/api/tags/cleaned', createAuthOptions({ method: 'GET' }));
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          logger.warn('Cleaned tags fetch skipped - not authenticated');
          return { Skills: [], Industries: [], Tools: [], 'Soft Skills': [] };
        }
        throw new Error('Failed to fetch cleaned tags');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error fetching cleaned tags:', error);
      throw error;
    }
  },

  async getEscoTags() {
    try {
      const response = await fetchWithAuth('/api/tags/esco', createAuthOptions({ method: 'GET' }));
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          logger.warn('ESCO tags fetch skipped - not authenticated');
          return { skills: [], industries: [], tools: [], softSkills: [] };
        }
        throw new Error('Failed to fetch ESCO tags');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error fetching ESCO tags:', error);
      throw error;
    }
  },

  async saveEscoTags(escoTags) {
    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ escoTags })
      });
      const response = await fetchWithAuth('/api/tags/esco', authOptions);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save ESCO tags');
      }
      const result = await response.json();
      logger.log(result.message);
      return result;
    } catch (error) {
      logger.error('Error saving ESCO tags:', error);
      throw error;
    }
  },

  async recalculateEscoTags(language = 'fr') {
    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ language })
      });
      const response = await fetchWithAuth('/api/tags/esco/recalculate', authOptions);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to recalculate ESCO tags');
      }
      return await response.json();
    } catch (error) {
      logger.error('Error recalculating ESCO tags:', error);
      throw error;
    }
  },
};

export { tagService };
