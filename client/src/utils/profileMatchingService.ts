/**
 * Profile Matching Service
 * Frontend service for mission-driven profile search and detailed analysis
 */

import { fetchWithAuth, createAuthOptions, createAuthOptionsWithCsrf } from './apiInterceptor';
import logger from './logger.frontend';
import { showCaughtError } from '../components/errorToast.helpers';
import {
  createProfileAnalysisJob,
  createProfileSearchJob,
  waitForProfileAnalysisJobCompletion,
  waitForProfileSearchJobCompletion
} from './profileMatchingJob';
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
    const job = await createProfileSearchJob({
      missionId,
      limit: options.limit,
      minScore: options.minScore,
      status: options.status,
      weights: options.weights,
      dealId: options.dealId
    });

    if (!job.id) {
      throw new Error('Failed to create profile matching job');
    }

    return await waitForProfileSearchJobCompletion({
      jobId: job.id
    });
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

    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }

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
    const job = await createProfileAnalysisJob({
      missionId,
      resumeId
    });

    if (!job.id) {
      throw new Error('Failed to create detailed profile analysis job');
    }

    return await waitForProfileAnalysisJobCompletion({
      jobId: job.id,
      resumeId
    });
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

    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }

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
