import { createAuthOptionsWithCsrf, fetchWithAuth, getResponseErrorMessage } from './apiInterceptor';
import { pollUntil } from './longRunningOperation';
import { FRONTEND_LLM_OPERATION_TIMEOUT_MS } from '../constants/llmTimeouts';

export interface ResumeAdaptationJobItem {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'skipped';
  progress?: number;
  resume_id?: string;
  adaptation_id?: string;
  pending_data?: {
    missionId?: string;
    matchAnalysis?: Record<string, unknown>;
  } | null;
  error_message?: string;
}

export interface ResumeAdaptationJobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error_message?: string;
  items?: ResumeAdaptationJobItem[];
}

export const deriveResumeAdaptationProcessingStep = (jobData: ResumeAdaptationJobStatus): 'analyzing' | 'adapting' => {
  const activeItem = jobData.items?.find(item => item.status === 'processing' || item.status === 'success');
  const progress = activeItem?.progress ?? 0;
  return progress >= 60 ? 'adapting' : 'analyzing';
};

export const createResumeAdaptationJob = async ({
  resumeId,
  missionId,
  signal
}: {
  resumeId: string;
  missionId: string;
  signal?: AbortSignal;
}): Promise<{ id?: string }> => {
  const authOptions = await createAuthOptionsWithCsrf({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeIds: [resumeId], missionId })
  });

  const response = await fetchWithAuth('/api/batch-jobs/adapt', {
    ...authOptions,
    signal
  });

  if (!response.ok) {
    const errorMessage = await getResponseErrorMessage(response, 'Failed to create resume adaptation job');
    throw new Error(errorMessage);
  }

  return response.json() as Promise<{ id?: string }>;
};

export const fetchResumeAdaptationJob = async (jobId: string, signal?: AbortSignal): Promise<ResumeAdaptationJobStatus> => {
  const response = await fetchWithAuth(`/api/batch-jobs/${jobId}`, {
    method: 'GET',
    signal
  });

  if (!response.ok) {
    const errorMessage = await getResponseErrorMessage(response, 'Failed to fetch resume adaptation job');
    throw new Error(errorMessage);
  }

  return response.json() as Promise<ResumeAdaptationJobStatus>;
};

export const createResumeMatchJob = async ({
  resumeId,
  missionId,
  signal
}: {
  resumeId: string;
  missionId: string;
  signal?: AbortSignal;
}): Promise<{ id?: string }> => {
  const authOptions = await createAuthOptionsWithCsrf({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeIds: [resumeId], missionId })
  });

  const response = await fetchWithAuth('/api/batch-jobs/match', {
    ...authOptions,
    signal
  });

  if (!response.ok) {
    const errorMessage = await getResponseErrorMessage(response, 'Failed to create resume match job');
    throw new Error(errorMessage);
  }

  return response.json() as Promise<{ id?: string }>;
};

export const waitForResumeMatchJobCompletion = async ({
  jobId,
  resumeId,
  signal,
  timeoutMs = FRONTEND_LLM_OPERATION_TIMEOUT_MS,
  onJobUpdate
}: {
  jobId: string;
  resumeId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onJobUpdate?: (jobData: ResumeAdaptationJobStatus) => void | Promise<void>;
}): Promise<Record<string, unknown>> => {
  return pollUntil<ResumeAdaptationJobStatus, Record<string, unknown>>({
    poll: () => fetchResumeAdaptationJob(jobId, signal),
    signal,
    timeoutMs,
    timeoutMessage: 'Resume match analysis timed out.',
    onTick: onJobUpdate,
    isDone: (jobData) => {
      if (jobData.status === 'failed' || jobData.status === 'cancelled') {
        throw new Error(jobData.error_message || 'Resume match job failed');
      }

      const item = jobData.items?.find(currentItem => currentItem.resume_id === resumeId);
      if (!item) {
        return false;
      }

      if (item.status === 'error') {
        throw new Error(item.error_message || 'Resume match analysis failed');
      }

      return item.status === 'success' && Boolean(item.pending_data?.matchAnalysis);
    },
    mapResult: (jobData) => {
      const item = jobData.items?.find(currentItem => currentItem.resume_id === resumeId);
      const matchAnalysis = item?.pending_data?.matchAnalysis;
      if (!matchAnalysis) {
        throw new Error('Resume match job completed without match analysis');
      }
      return matchAnalysis;
    }
  });
};

export const waitForResumeAdaptationJobCompletion = async ({
  jobId,
  resumeId,
  signal,
  timeoutMs = FRONTEND_LLM_OPERATION_TIMEOUT_MS,
  onJobUpdate
}: {
  jobId: string;
  resumeId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onJobUpdate?: (jobData: ResumeAdaptationJobStatus) => void | Promise<void>;
}): Promise<string> => {
  return pollUntil<ResumeAdaptationJobStatus, string>({
    poll: () => fetchResumeAdaptationJob(jobId, signal),
    signal,
    timeoutMs,
    timeoutMessage: 'Resume adaptation timed out.',
    onTick: onJobUpdate,
    isDone: (jobData) => {
      if (jobData.status === 'failed' || jobData.status === 'cancelled') {
        throw new Error(jobData.error_message || 'Resume adaptation job failed');
      }

      const item = jobData.items?.find(currentItem => currentItem.resume_id === resumeId);
      if (!item) {
        return false;
      }

      if (item.status === 'error') {
        throw new Error(item.error_message || 'Resume adaptation failed');
      }

      return item.status === 'success' && Boolean(item.adaptation_id);
    },
    mapResult: (jobData) => {
      const item = jobData.items?.find(currentItem => currentItem.resume_id === resumeId);
      if (!item?.adaptation_id) {
        throw new Error('Resume adaptation job completed without an adaptation identifier');
      }
      return item.adaptation_id;
    }
  });
};
