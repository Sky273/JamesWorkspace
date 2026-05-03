import { describe, expect, it, vi } from 'vitest';

import {
  getCompletedJobRefreshScopes,
  getDisplayProgress,
  getSkippedCount,
  getSummaryText,
  syncJobProgressSnapshots,
} from './helpers';
import type { Job, JobProgressSnapshot } from './types';

const baseJob: Job = {
  id: 'job-1',
  status: 'processing',
  job_type: 'collect-trends',
  options: {},
  total_items: 100,
  processed_items: 10,
  success_count: 10,
  error_count: 0,
  created_at: '2026-04-11T10:00:00.000Z',
  started_at: '2026-04-11T10:00:00.000Z',
};

describe('batch job progress helpers', () => {
  it('keeps the last processing snapshot when the server counters did not move', () => {
    const observedAt = Date.parse('2026-04-11T10:10:00.000Z');
    const currentSnapshots: Record<string, JobProgressSnapshot> = {
      'job-1': {
        jobId: 'job-1',
        processedItems: 10,
        totalItems: 100,
        startedAt: '2026-04-11T10:00:00.000Z',
        observedAt,
        status: 'processing',
      },
    };

    const nextSnapshots = syncJobProgressSnapshots(currentSnapshots, [baseJob], observedAt + 30_000);

    expect(nextSnapshots['job-1']).toEqual(currentSnapshots['job-1']);
  });

  it('resumes a projected progress count from the stored snapshot', () => {
    vi.setSystemTime(new Date('2026-04-11T10:12:00.000Z'));

    const snapshot: JobProgressSnapshot = {
      jobId: 'job-1',
      processedItems: 10,
      totalItems: 100,
      startedAt: '2026-04-11T10:00:00.000Z',
      observedAt: Date.parse('2026-04-11T10:10:00.000Z'),
      status: 'processing',
    };

    const progress = getDisplayProgress(baseJob, snapshot, Date.now());

    expect(progress.processedItems).toBe(12);
    expect(progress.progressPercentage).toBe(12);
    expect(progress.estimatedTimeRemaining).toBe('~88min');
  });

  it('maps completed collection jobs to the matching cached view scopes', () => {
    expect(getCompletedJobRefreshScopes(baseJob)).toEqual(['marketTrends']);
    expect(getCompletedJobRefreshScopes({ ...baseJob, job_type: 'collect-metiers' })).toEqual(['rome', 'marketTrends']);
    expect(getCompletedJobRefreshScopes({ ...baseJob, job_type: 'adapt' })).toEqual(['adaptations', 'resumes', 'missions']);
  });

  it('derives skipped jobs from processed items without counting them as errors', () => {
    const job = {
      ...baseJob,
      processed_items: 26,
      success_count: 4,
      error_count: 2,
    };

    expect(getSkippedCount(job)).toBe(20);
  });

  it('shows success, skipped, and errors as separate summary fragments', () => {
    const t = (key: string, options?: unknown): string => {
      const count = (options as { count?: number } | undefined)?.count;
      return `${key}:${count}`;
    };

    expect(getSummaryText({
      ...baseJob,
      processed_items: 26,
      success_count: 4,
      error_count: 2,
    }, t)).toBe('batchJobs.summary.success:4 • batchJobs.summary.skipped:20 • batchJobs.summary.errors:2');
  });
});
