import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAndTrackJob, pollUntil, sleepWithAbort } from './longRunningOperation';

describe('longRunningOperation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when polling condition is met', async () => {
    const poll = vi.fn()
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'done', value: 'ok' });

    const promise = pollUntil<{ status: string; value?: string }, string>({
      poll,
      isDone: (result) => result.status === 'done',
      mapResult: (result) => result.value || '',
      intervalMs: 1000,
      timeoutMs: 5000
    });

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toBe('ok');
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('runs onTick for each polling result', async () => {
    const onTick = vi.fn();
    const poll = vi.fn()
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'done' });

    const promise = pollUntil<{ status: string }>({
      poll,
      isDone: (result) => result.status === 'done',
      onTick,
      intervalMs: 1000,
      timeoutMs: 5000
    });

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('aborts sleep when the signal is cancelled', async () => {
    const controller = new AbortController();
    const promise = sleepWithAbort(1000, controller.signal);

    controller.abort();

    await expect(promise).rejects.toThrow('Operation aborted');
  });

  it('creates, tracks and hydrates a job result', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'job-1', status: 'pending' });
    const track = vi.fn().mockResolvedValue('resume-1');
    const hydrate = vi.fn().mockResolvedValue({ id: 'resume-1', name: 'Resume' });

    const result = await createAndTrackJob({
      create,
      getJobId: created => created.id,
      track,
      hydrate
    });

    expect(result.jobId).toBe('job-1');
    expect(result.tracked).toBe('resume-1');
    expect(result.hydrated).toEqual({ id: 'resume-1', name: 'Resume' });
  });

  it('throws when created job has no identifier', async () => {
    await expect(createAndTrackJob({
      create: async () => ({ status: 'pending' }),
      getJobId: () => null
    })).rejects.toThrow('Job was created without an identifier');
  });
  it('throws the provided timeout message when polling never completes', async () => {
    const poll = vi.fn().mockResolvedValue({ status: 'pending' });

    const result = pollUntil<{ status: string }>({
      poll,
      isDone: () => false,
      intervalMs: 1000,
      timeoutMs: 2500,
      timeoutMessage: 'Timed out'
    }).then(
      () => ({ ok: true as const, error: null }),
      (error) => ({ ok: false as const, error })
    );

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(3000);

    await expect(result).resolves.toMatchObject({
      ok: false,
      error: expect.objectContaining({ message: 'Timed out' })
    });
  });
});
