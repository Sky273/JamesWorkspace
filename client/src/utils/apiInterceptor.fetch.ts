import type logger from './logger.frontend';
import type { FetchOptions } from './auth.types';

interface MergedAbortSignalResult {
  signal?: AbortSignal;
  cleanup: () => void;
}

const isAbortError = (error: unknown): error is Error =>
  error instanceof Error && error.name === 'AbortError';

function mergeAbortSignals(...signals: Array<AbortSignal | null | undefined>): MergedAbortSignalResult {
  const activeSignals = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (activeSignals.length === 0) {
    return { signal: undefined, cleanup: () => {} };
  }

  const controller = new AbortController();
  const cleanupCallbacks: Array<() => void> = [];

  const cleanup = () => {
    while (cleanupCallbacks.length > 0) {
      const callback = cleanupCallbacks.pop();
      callback?.();
    }
  };

  const abort = () => {
    cleanup();
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };

  for (const signal of activeSignals) {
    if (signal.aborted) {
      abort();
      return { signal: controller.signal, cleanup };
    }
    signal.addEventListener('abort', abort, { once: true });
    cleanupCallbacks.push(() => signal.removeEventListener('abort', abort));
  }

  return { signal: controller.signal, cleanup };
}

export async function fetchWithTimeout(
  deps: {
    apiBaseUrl: string;
    logger: typeof logger;
    toTimeoutError: () => Error;
  },
  url: string,
  options: FetchOptions = {},
  timeout = 120000,
  retryCount = 0
): Promise<Response> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeout);
  const mergedSignal = mergeAbortSignals(options.signal, timeoutController.signal);

  const fullUrl = url.startsWith('/') ? `${deps.apiBaseUrl}${url}` : url;
  const headersWithCacheBust = {
    ...options.headers,
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers: headersWithCacheBust,
      signal: mergedSignal.signal,
      credentials: 'include',
    } as RequestInit);
    clearTimeout(timeoutId);
    mergedSignal.cleanup();

    if (response.status === 400 && retryCount < 1 && (!options.method || options.method === 'GET')) {
      deps.logger.warn(`[API Interceptor] Got 400 on GET request, retrying once: ${url}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return fetchWithTimeout(deps, url, options, timeout, retryCount + 1);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    mergedSignal.cleanup();
    if (isAbortError(error) && timeoutController.signal.aborted && !options.signal?.aborted) {
      deps.logger.error(`[API Interceptor] Request timeout after ${timeout}ms:`, url);
      throw deps.toTimeoutError();
    }
    if (isAbortError(error)) {
      throw error;
    }
    deps.logger.error('[API Interceptor] Fetch error', { message: (error as Error).message, url });
    throw error;
  }
}
