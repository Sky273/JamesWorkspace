import { applyResumeUpdate } from '../utils/resumeNormalization';
import type { Resume } from '../types/entities';
import type { ProcessingStep } from './ResumeContext';

export const SINGLE_UPLOAD_JOB_POLL_INTERVAL_MS = 2000;

export function getResumeIdentifier(resume: Resume | null | undefined): string | undefined {
  if (!resume) return undefined;

  const candidates = [resume.id, resume['ID']];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return undefined;
}

export function deriveUploadProcessingStep(jobData: {
  status?: string;
  items?: Array<{ progress?: number; status?: string }>;
}): ProcessingStep {
  const item = jobData.items?.[0];
  const progress = typeof item?.progress === 'number' ? item.progress : 0;

  if (item?.status === 'success' || jobData.status === 'completed') {
    return 'analyze';
  }
  if (progress >= 60 || item?.status === 'pending_name') {
    return 'analyze';
  }
  if (progress >= 50) {
    return 'preanalyze';
  }
  if (progress >= 30 || item?.status === 'processing') {
    return 'extract';
  }

  return 'upload';
}

export function applyImprovedContentUpdate(resume: Resume, content: string, currentVersion: number): Resume {
  return applyResumeUpdate(resume, { 'Improved Text': content, 'Current Version': currentVersion });
}

export function applyOriginalContentUpdate(resume: Resume, content: string): Resume {
  return applyResumeUpdate(resume, { 'Original Text': content });
}
