import { createAuthOptionsWithCsrf, fetchWithAuth, getResponseErrorMessage } from './apiInterceptor';
import { pollUntil } from './longRunningOperation';
import type { DetailedProfileAnalysisResponse, ProfileMatchingResponse, ProfileMatchWeights } from '../types/entities';

export interface ProfileMatchingJobItem {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'skipped';
  progress?: number;
  resume_id?: string;
  pending_data?: {
    profileMatchingResults?: ProfileMatchingResponse;
    detailedProfileAnalysis?: DetailedProfileAnalysisResponse;
  } | null;
  error_message?: string;
}

export interface ProfileMatchingJobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error_message?: string;
  items?: ProfileMatchingJobItem[];
}

export async function createProfileSearchJob({
  missionId,
  limit,
  minScore,
  status,
  weights,
  dealId,
  signal
}: {
  missionId: string;
  limit?: number;
  minScore?: number;
  status?: 'Analyzed' | 'Improved';
  weights?: ProfileMatchWeights;
  dealId?: string;
  signal?: AbortSignal;
}): Promise<{ id?: string }> {
  const authOptions = await createAuthOptionsWithCsrf({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      missionId,
      limit: limit ?? 0,
      minScore: minScore ?? 0,
      status,
      weights,
      dealId: dealId || undefined
    })
  });

  const response = await fetchWithAuth('/api/batch-jobs/profile-search', {
    ...authOptions,
    signal
  });

  if (!response.ok) {
    const errorMessage = await getResponseErrorMessage(response, 'Failed to create profile matching job');
    throw new Error(errorMessage);
  }

  return response.json() as Promise<{ id?: string }>;
}

export async function createProfileAnalysisJob({
  missionId,
  resumeId,
  signal
}: {
  missionId: string;
  resumeId: string;
  signal?: AbortSignal;
}): Promise<{ id?: string }> {
  const authOptions = await createAuthOptionsWithCsrf({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      missionId,
      resumeId
    })
  });

  const response = await fetchWithAuth('/api/batch-jobs/profile-analysis', {
    ...authOptions,
    signal
  });

  if (!response.ok) {
    const errorMessage = await getResponseErrorMessage(response, 'Failed to create detailed profile analysis job');
    throw new Error(errorMessage);
  }

  return response.json() as Promise<{ id?: string }>;
}

export async function fetchProfileMatchingJob(jobId: string, signal?: AbortSignal): Promise<ProfileMatchingJobStatus> {
  const response = await fetchWithAuth(`/api/batch-jobs/${jobId}`, {
    method: 'GET',
    signal
  });

  if (!response.ok) {
    const errorMessage = await getResponseErrorMessage(response, 'Failed to fetch profile matching job');
    throw new Error(errorMessage);
  }

  return response.json() as Promise<ProfileMatchingJobStatus>;
}

export async function waitForProfileSearchJobCompletion({
  jobId,
  signal,
  timeoutMs = 300000,
  onJobUpdate
}: {
  jobId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onJobUpdate?: (jobData: ProfileMatchingJobStatus) => void | Promise<void>;
}): Promise<ProfileMatchingResponse> {
  return pollUntil<ProfileMatchingJobStatus, ProfileMatchingResponse>({
    poll: () => fetchProfileMatchingJob(jobId, signal),
    signal,
    timeoutMs,
    timeoutMessage: 'Profile matching search timed out.',
    onTick: onJobUpdate,
    isDone: (jobData) => {
      if (jobData.status === 'failed' || jobData.status === 'cancelled') {
        throw new Error(jobData.error_message || 'Profile matching job failed');
      }

      const item = jobData.items?.[0];
      if (!item) {
        return false;
      }

      if (item.status === 'error') {
        throw new Error(item.error_message || 'Profile matching search failed');
      }

      return item.status === 'success' && Boolean(item.pending_data?.profileMatchingResults);
    },
    mapResult: (jobData) => {
      const results = jobData.items?.[0]?.pending_data?.profileMatchingResults;
      if (!results) {
        throw new Error('Profile matching job completed without results');
      }
      return results;
    }
  });
}

export async function waitForProfileAnalysisJobCompletion({
  jobId,
  resumeId,
  signal,
  timeoutMs = 300000,
  onJobUpdate
}: {
  jobId: string;
  resumeId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onJobUpdate?: (jobData: ProfileMatchingJobStatus) => void | Promise<void>;
}): Promise<DetailedProfileAnalysisResponse> {
  return pollUntil<ProfileMatchingJobStatus, DetailedProfileAnalysisResponse>({
    poll: () => fetchProfileMatchingJob(jobId, signal),
    signal,
    timeoutMs,
    timeoutMessage: 'Detailed profile analysis timed out.',
    onTick: onJobUpdate,
    isDone: (jobData) => {
      if (jobData.status === 'failed' || jobData.status === 'cancelled') {
        throw new Error(jobData.error_message || 'Detailed profile analysis job failed');
      }

      const item = jobData.items?.find(currentItem => currentItem.resume_id === resumeId) || jobData.items?.[0];
      if (!item) {
        return false;
      }

      if (item.status === 'error') {
        throw new Error(item.error_message || 'Detailed profile analysis failed');
      }

      return item.status === 'success' && Boolean(item.pending_data?.detailedProfileAnalysis);
    },
    mapResult: (jobData) => {
      const item = jobData.items?.find(currentItem => currentItem.resume_id === resumeId) || jobData.items?.[0];
      const analysis = item?.pending_data?.detailedProfileAnalysis;
      if (!analysis) {
        throw new Error('Detailed profile analysis job completed without analysis');
      }
      return analysis;
    }
  });
}
