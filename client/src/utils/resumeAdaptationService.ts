/**
 * Resume Adaptation Service
 * Handles API calls for adapting resumes to specific job missions/offers
 */

import { fetchWithAuth, createAuthOptions, createAuthOptionsWithCsrf } from './apiInterceptor';
import logger from './logger.frontend';

export interface Recommendations {
    executiveSummary?: string[];
    skills?: string[];
    experience?: string[];
    education?: string[];
    atsOptimization?: string[];
    [key: string]: string[] | undefined;
}

export interface MatchAnalysis {
    score?: number;
    matchScore?: string | number;
    strengths: string[];
    gaps: string[];
    keywordMatches?: string[];
    missingKeywords?: string[];
    recommendations?: Recommendations | string[];
}

export interface Adaptation {
    id: string;
    resumeId: string;
    missionId: string;
    adaptedText?: string;
    analysis?: MatchAnalysis;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface AdaptationFilters {
    resumeId?: string;
    missionId?: string;
    status?: string;
}

export const resumeAdaptationService = {
    /**
     * Analyze the match between a resume and a mission
     */
    async analyzeMatch(resumeId: string, missionId: string): Promise<MatchAnalysis> {
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
     */
    async createAdaptation(resumeId: string, missionId: string): Promise<Adaptation> {
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
     */
    async getAllAdaptations(filters: AdaptationFilters = {}): Promise<Adaptation[]> {
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
                } catch {
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
     */
    async getAdaptation(adaptationId: string): Promise<Adaptation> {
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
                } catch {
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
     */
    async getAdaptationsByResume(resumeId: string): Promise<Adaptation[]> {
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
                } catch {
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
     */
    async getAdaptationsByMission(missionId: string): Promise<Adaptation[]> {
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
     */
    async deleteAdaptation(adaptationId: string): Promise<{ success: boolean }> {
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
