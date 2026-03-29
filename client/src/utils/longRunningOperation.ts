export interface PollUntilOptions<T, R = T> {
  poll: () => Promise<T>;
  isDone: (result: T) => boolean;
  mapResult?: (result: T) => R;
  onTick?: (result: T) => void | Promise<void>;
  signal?: AbortSignal;
  intervalMs?: number;
  timeoutMs?: number;
  timeoutMessage?: string;
}

export const sleepWithAbort = (delayMs: number, signal?: AbortSignal): Promise<void> => {
  if (!signal) {
    return new Promise(resolve => window.setTimeout(resolve, delayMs));
  }

  if (signal.aborted) {
    return Promise.reject(new Error('Operation aborted'));
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, delayMs);

    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      signal.removeEventListener('abort', handleAbort);
      reject(new Error('Operation aborted'));
    };

    signal.addEventListener('abort', handleAbort, { once: true });
  });
};

export const pollUntil = async <T, R = T>({
  poll,
  isDone,
  mapResult,
  onTick,
  signal,
  intervalMs = 2000,
  timeoutMs = 120000,
  timeoutMessage = 'Operation timed out.'
}: PollUntilOptions<T, R>): Promise<R> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    const result = await poll();

    if (onTick) {
      await onTick(result);
    }

    if (isDone(result)) {
      return mapResult ? mapResult(result) : (result as unknown as R);
    }

    await sleepWithAbort(intervalMs, signal);
  }

  throw new Error(timeoutMessage);
};

export interface CreateAndTrackJobOptions<TCreated, TTracked = undefined, THydrated = TTracked> {
  create: () => Promise<TCreated>;
  getJobId: (created: TCreated) => string | null | undefined;
  track?: (jobId: string, created: TCreated) => Promise<TTracked>;
  hydrate?: (tracked: TTracked, jobId: string, created: TCreated) => Promise<THydrated>;
}

export interface CreateAndTrackJobResult<TCreated, TTracked = undefined, THydrated = TTracked> {
  jobId: string;
  created: TCreated;
  tracked?: TTracked;
  hydrated?: THydrated;
}

export const createAndTrackJob = async <TCreated, TTracked = undefined, THydrated = TTracked>({
  create,
  getJobId,
  track,
  hydrate
}: CreateAndTrackJobOptions<TCreated, TTracked, THydrated>): Promise<CreateAndTrackJobResult<TCreated, TTracked, THydrated>> => {
  const created = await create();
  const jobId = getJobId(created);

  if (!jobId) {
    throw new Error('Job was created without an identifier');
  }

  const result: CreateAndTrackJobResult<TCreated, TTracked, THydrated> = {
    jobId,
    created
  };

  if (!track) {
    return result;
  }

  const tracked = await track(jobId, created);
  result.tracked = tracked;

  if (!hydrate) {
    return result;
  }

  result.hydrated = await hydrate(tracked, jobId, created);
  return result;
};
