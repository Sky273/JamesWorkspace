import { createAuthOptionsWithCsrf, fetchWithAuth, getResponseErrorMessage } from './apiInterceptor';
import { pollUntil } from './longRunningOperation';
import { FRONTEND_LLM_IMPROVEMENT_TIMEOUT_MS } from '../constants/llmTimeouts';

const RESUME_IMPROVEMENT_JOB_POLL_INTERVAL_MS = 2000;

export interface ResumeImprovementJobItem {
  status?: string;
  progress?: number;
  resume_id?: string;
  error_message?: string;
}

export interface ResumeImprovementJobStatus {
  status?: string;
  error_message?: string;
  items?: ResumeImprovementJobItem[];
}

const getTrackedItem = (jobData: ResumeImprovementJobStatus, resumeId: string): ResumeImprovementJobItem | undefined => {
  return jobData.items?.find(item => item.resume_id === resumeId) || jobData.items?.[0];
};

export const deriveResumeImprovementProcessingStep = (jobData: ResumeImprovementJobStatus): 'improving' | 'analyzing' => {
  const item = jobData.items?.[0];
  const progress = typeof item?.progress === 'number' ? item.progress : 0;
  return progress >= 80 || jobData.status === 'completed' ? 'analyzing' : 'improving';
};

export async function fetchResumeImprovementJob(jobId: string, signal?: AbortSignal): Promise<ResumeImprovementJobStatus> {
  const fetchOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
  const response = await fetchWithAuth(`/api/batch-jobs/${jobId}`, {
    ...fetchOptions,
    signal
  }, 30000);

  if (!response.ok) {
    const errorMessage = await getResponseErrorMessage(response, 'Failed to fetch improvement job');
    throw new Error(errorMessage);
  }

  return response.json() as Promise<ResumeImprovementJobStatus>;
}

export async function waitForResumeImprovementJobCompletion({
  jobId,
  resumeId,
  signal,
  timeoutMs = FRONTEND_LLM_IMPROVEMENT_TIMEOUT_MS,
  onJobUpdate
}: {
  jobId: string;
  resumeId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onJobUpdate?: (jobData: ResumeImprovementJobStatus) => void | Promise<void>;
}): Promise<string> {
  return pollUntil<ResumeImprovementJobStatus, string>({
    poll: () => fetchResumeImprovementJob(jobId, signal),
    signal,
    intervalMs: RESUME_IMPROVEMENT_JOB_POLL_INTERVAL_MS,
    timeoutMs,
    timeoutMessage: 'Resume improvement job timed out.',
    onTick: async (jobData) => {
      const item = getTrackedItem(jobData, resumeId);

      if (item?.status === 'error') {
        throw new Error(item.error_message || 'Resume improvement failed');
      }

      if (jobData.status === 'failed' || jobData.status === 'cancelled') {
        throw new Error(jobData.error_message || 'Resume improvement failed');
      }

      if (onJobUpdate) {
        await onJobUpdate(jobData);
      }
    },
    isDone: (jobData) => {
      const item = getTrackedItem(jobData, resumeId);
      return Boolean(item?.resume_id === resumeId && (item.status === 'success' || jobData.status === 'completed'));
    },
    mapResult: () => resumeId
  });
}