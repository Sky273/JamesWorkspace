/**
 * Resume Adaptation Service
 * Handles API calls for adapting resumes to specific job missions/offers
 */

import { fetchWithAuth, createAuthOptions, createAuthOptionsWithCsrf, getResponseErrorMessage } from './apiInterceptor';
import { createAndTrackJob } from './longRunningOperation';
import { createResumeAdaptationJob, waitForResumeAdaptationJobCompletion } from './resumeAdaptationJob';
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
    adaptedTitle?: string | null;
    matchScore?: string | number;
    analysis?: MatchAnalysis;
    matchAnalysis?: MatchAnalysis;
    adaptationId?: string;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    'Adapted Text'?: string;
    'Adapted Title'?: string | null;
    'Match Score'?: string | number;
    'Match Analysis'?: MatchAnalysis;
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
                authOptions,
                180000 // 3 minutes for LLM match analysis
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
            const { hydrated } = await createAndTrackJob({
                create: () => createResumeAdaptationJob({ resumeId, missionId }),
                getJobId: created => created.id,
                track: (jobId) => waitForResumeAdaptationJobCompletion({ jobId, resumeId }),
                hydrate: async (adaptationId) => {
                    const response = await fetchWithAuth(
                        `/api/adaptations/${adaptationId}`,
                        createAuthOptions({ method: 'GET' })
                    );

                    if (!response.ok) {
                        const errorMessage = await getResponseErrorMessage(response, 'Failed to fetch completed adaptation');
                        throw new Error(errorMessage);
                    }

                    const data = await response.json();
                    return {
                        id: data.id,
                        resumeId: data['Resume ID'],
                        missionId: data['Mission ID'],
                        adaptedText: data['Adapted Text'],
                        analysis: data['Match Analysis'],
                        matchAnalysis: data['Match Analysis'],
                        adaptationId: data.id,
                        adaptedTitle: data['Adapted Title'],
                        matchScore: data['Match Score'],
                        status: data.Status,
                        createdAt: data['Created At'],
                        updatedAt: data['Updated At']
                    } satisfies Adaptation & Record<string, unknown>;
                }
            });

            if (!hydrated) {
                throw new Error('Adaptation job completed without a hydrated result');
            }

            return hydrated as Adaptation;
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
