/**
 * Resume Adaptation Service
 * Handles API calls for adapting resumes to specific job missions/offers
 */

import { fetchWithAuth, createAuthOptions, createAuthOptionsWithCsrf } from './apiInterceptor';
import logger from './logger.frontend';

export const resumeAdaptationService = {
    /**
     * Analyze the match between a resume and a mission
     * @param {string} resumeId - Airtable record ID of the resume
     * @param {string} missionId - Airtable record ID of the mission
     * @returns {Promise<Object>} Match analysis with score, strengths, gaps, recommendations
     */
    async analyzeMatch(resumeId, missionId) {
        try {
            const authOptions = await createAuthOptionsWithCsrf({ 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ missionId })
            });
            const response = await fetchWithAuth(
                `/api/resumes/${resumeId}/match`,
                authOptions
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to analyze match');
            }

            return await response.json();
        } catch (error) {
            logger.error('Error analyzing resume-mission match:', error);
            throw error;
        }
    },

    /**
     * Create an adaptation of a resume for a specific mission
     * @param {string} resumeId - Airtable record ID of the resume
     * @param {string} missionId - Airtable record ID of the mission
     * @returns {Promise<Object>} Created adaptation with adapted text and analysis
     */
    async createAdaptation(resumeId, missionId) {
        try {
            const authOptions = await createAuthOptionsWithCsrf({ 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ missionId })
            });
            // Use 180 second timeout for adaptation (involves multiple LLM calls)
            const response = await fetchWithAuth(
                `/api/resumes/${resumeId}/adapt`,
                authOptions,
                180000
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create adaptation');
            }

            return await response.json();
        } catch (error) {
            logger.error('Error creating resume adaptation:', error);
            throw error;
        }
    },

    /**
     * Get all adaptations (with optional filters)
     * @param {Object} filters - Optional filters (resumeId, missionId, status)
     * @returns {Promise<Array>} List of adaptations
     */
    async getAllAdaptations(filters = {}) {
        try {
            const queryParams = new URLSearchParams();
            if (filters.resumeId) queryParams.append('resumeId', filters.resumeId);
            if (filters.missionId) queryParams.append('missionId', filters.missionId);
            if (filters.status) queryParams.append('status', filters.status);

            const url = `/api/adaptations${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
            const response = await fetchWithAuth(url, createAuthOptions({ method: 'GET' }));

            if (!response.ok) {
                let errorMessage = 'Failed to fetch adaptations';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    // Response body might be empty or not JSON
                    errorMessage = `HTTP ${response.status}: ${response.statusText || errorMessage}`;
                }
                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            logger.error('Error fetching adaptations:', error);
            throw error;
        }
    },

    /**
     * Get a specific adaptation by ID
     * @param {string} adaptationId - Airtable record ID of the adaptation
     * @returns {Promise<Object>} Adaptation details
     */
    async getAdaptation(adaptationId) {
        try {
            const response = await fetchWithAuth(
                `/api/adaptations/${adaptationId}`,
                createAuthOptions({ method: 'GET' })
            );

            if (!response.ok) {
                let errorMessage = 'Failed to fetch adaptation';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    errorMessage = `HTTP ${response.status}: ${response.statusText || errorMessage}`;
                }
                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            logger.error('Error fetching adaptation:', error);
            throw error;
        }
    },

    /**
     * Get all adaptations for a specific resume
     * @param {string} resumeId - Airtable record ID of the resume
     * @returns {Promise<Array>} List of adaptations for this resume
     */
    async getAdaptationsByResume(resumeId) {
        try {
            const response = await fetchWithAuth(
                `/api/resumes/${resumeId}/adaptations`,
                createAuthOptions({ method: 'GET' })
            );

            if (!response.ok) {
                let errorMessage = 'Failed to fetch adaptations';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    errorMessage = `HTTP ${response.status}: ${response.statusText || errorMessage}`;
                }
                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            logger.error('Error fetching resume adaptations:', error);
            throw error;
        }
    },

    /**
     * Get all adaptations for a specific mission
     * @param {string} missionId - Airtable record ID of the mission
     * @returns {Promise<Array>} List of adaptations for this mission
     */
    async getAdaptationsByMission(missionId) {
        try {
            const response = await fetchWithAuth(
                `/api/missions/${missionId}/adaptations`,
                createAuthOptions({ method: 'GET' })
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch mission adaptations');
            }

            return await response.json();
        } catch (error) {
            logger.error('Error fetching mission adaptations:', error);
            throw error;
        }
    },

    /**
     * Delete an adaptation
     * @param {string} adaptationId - Airtable record ID of the adaptation
     * @returns {Promise<Object>} Deletion confirmation
     */
    async deleteAdaptation(adaptationId) {
        try {
            const authOptions = await createAuthOptionsWithCsrf({ method: 'DELETE' });
            const response = await fetchWithAuth(
                `/api/adaptations/${adaptationId}`,
                authOptions
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete adaptation');
            }

            return await response.json();
        } catch (error) {
            logger.error('Error deleting adaptation:', error);
            throw error;
        }
    }
};

export default resumeAdaptationService;
