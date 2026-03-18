/**
 * Profile Matching Service
 * Frontend service for finding best matching CVs for a mission
 */

import { fetchWithAuth, createAuthOptions, createAuthOptionsWithCsrf } from './apiInterceptor';
import logger from './logger.frontend';
import { showCaughtError } from '../components/ErrorToast';
import type { 
  ProfileMatchingResponse, 
  ProfileMatchWeights,
  Mission,
  Deal,
  DetailedProfileAnalysisResponse
} from '../types/entities';

export interface FindProfilesOptions {
  limit?: number;
  minScore?: number;
  status?: 'Analyzed' | 'Improved';
  weights?: ProfileMatchWeights;
  dealId?: string;
}

/**
 * Find best matching profiles for a mission
 */
export async function findMatchingProfiles(
  missionId: string,
  options: FindProfilesOptions = {}
): Promise<ProfileMatchingResponse> {
  try {
    const authOptions = await createAuthOptionsWithCsrf({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        limit: options.limit || 10,
        minScore: options.minScore || 0,
        status: options.status,
        weights: options.weights,
        dealId: options.dealId || undefined
      })
    });

    const response = await fetchWithAuth(
      `/api/missions/${missionId}/find-profiles`,
      authOptions,
      600000 // 10 minute timeout for LLM keyword extraction + scoring
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to find matching profiles`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Error finding matching profiles:', error);
    showCaughtError(error);
    throw error;
  }
}

/**
 * Clear cached keywords for a mission
 */
export async function clearMissionKeywordsCache(missionId: string): Promise<void> {
  try {
    const authOptions = await createAuthOptionsWithCsrf({
      method: 'DELETE'
    });

    const response = await fetchWithAuth(
      `/api/missions/${missionId}/keywords-cache`,
      authOptions
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to clear keywords cache');
    }
  } catch (error) {
    logger.error('Error clearing keywords cache:', error);
    showCaughtError(error);
    throw error;
  }
}

/**
 * Get all missions for the dropdown
 */
export async function getMissions(): Promise<Mission[]> {
  try {
    const response = await fetchWithAuth('/api/missions?limit=100', createAuthOptions({
      method: 'GET'
    }));

    if (!response.ok) {
      throw new Error('Failed to fetch missions');
    }

    const data = await response.json();
    
    // Handle paginated response
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }
    
    // Fallback for non-paginated response
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error('Error fetching missions:', error);
    showCaughtError(error);
    throw error;
  }
}

/**
 * Perform detailed LLM analysis of a profile against a mission
 */
export async function analyzeProfileForMission(
  missionId: string,
  resumeId: string
): Promise<DetailedProfileAnalysisResponse> {
  try {
    const authOptions = await createAuthOptionsWithCsrf({
      method: 'POST'
    });

    const response = await fetchWithAuth(
      `/api/missions/${missionId}/analyze-profile/${resumeId}`,
      authOptions,
      600000 // 10 minute timeout for LLM analysis
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to analyze profile`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Error analyzing profile:', error);
    showCaughtError(error);
    throw error;
  }
}

/**
 * Get all deals for the dropdown
 */
export async function getDeals(): Promise<Deal[]> {
  try {
    const response = await fetchWithAuth('/api/deals?limit=100', createAuthOptions({
      method: 'GET'
    }));

    if (!response.ok) {
      throw new Error('Failed to fetch deals');
    }

    const data = await response.json();
    
    // Handle paginated response
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }
    
    // Fallback for non-paginated response
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error('Error fetching deals:', error);
    showCaughtError(error);
    throw error;
  }
}

export default {
  findMatchingProfiles,
  clearMissionKeywordsCache,
  getMissions,
  getDeals,
  analyzeProfileForMission
};
