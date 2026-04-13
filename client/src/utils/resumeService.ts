/**
 * Resume Service - PostgreSQL Compatible
 * Provides API methods for resume operations via the backend proxy
 */

import { authGet, authPut } from './apiInterceptor';

export const resumeService = {
    /**
     * Update a resume field
     * @param resumeId - The resume ID
     * @param fields - Object with fields to update
     */
    async updateResume(resumeId: string, fields: Record<string, unknown>): Promise<unknown> {
        const response = await authPut(`/api/resumes/${resumeId}`, fields);
        if (!response.ok) {
            throw new Error('Failed to update resume');
        }
        return response.json();
    },

    /**
     * Get a resume by ID
     * @param resumeId - The resume ID
     */
    async getResume(resumeId: string, options: { forceRefresh?: boolean } = {}): Promise<unknown> {
        const searchParams = new URLSearchParams();
        if (options.forceRefresh) {
            searchParams.set('refresh', '1');
        }
        const query = searchParams.toString();
        const response = await authGet(`/api/resumes/${resumeId}${query ? `?${query}` : ''}`);
        if (!response.ok) {
            throw new Error('Failed to fetch resume');
        }
        return response.json();
    },

    /**
     * Get all resumes
     */
    async getResumes(): Promise<unknown[]> {
        const response = await authGet('/api/resumes');
        if (!response.ok) {
            throw new Error('Failed to fetch resumes');
        }
        const data = await response.json();
        return data.data || data;
    }
};

export default resumeService;
