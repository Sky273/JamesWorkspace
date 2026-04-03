import type { FetchOptions } from './auth.types';
import type logger from './logger.frontend';

interface CsrfDeps {
  getCsrfToken: (forceRefresh?: boolean) => Promise<string | null>;
  isCsrfError: (response: Response) => Promise<boolean>;
  logger: typeof logger;
  refreshCsrfToken: () => Promise<string | null>;
}

export function createAuthOptions(options: FetchOptions = {}): FetchOptions {
  return {
    ...options,
    headers: {
      ...options.headers,
    },
    credentials: 'include',
  };
}

export async function createAuthOptionsWithCsrf(
  deps: Pick<CsrfDeps, 'getCsrfToken' | 'logger'>,
  options: FetchOptions = {},
  forceRefreshCsrf = false
): Promise<FetchOptions> {
  const csrfToken = await deps.getCsrfToken(forceRefreshCsrf);

  deps.logger.log('[CSRF] Building options with token:', csrfToken ? 'present' : 'missing');

  return {
    ...options,
    headers: {
      ...options.headers,
      'x-csrf-token': csrfToken || '',
    },
    credentials: 'include',
  };
}

export async function fetchWithCsrfRetry(
  deps: Pick<CsrfDeps, 'isCsrfError' | 'logger' | 'refreshCsrfToken'> & {
    fetchWithAuth: (url: string, options?: FetchOptions, timeout?: number) => Promise<Response>;
  },
  url: string,
  options: FetchOptions = {},
  timeout = 120000
): Promise<Response> {
  let response = await deps.fetchWithAuth(url, options, timeout);

  if (response.status !== 403) {
    return response;
  }

  const isCsrf = await deps.isCsrfError(response);
  if (!isCsrf) {
    return response;
  }

  deps.logger.warn('[CSRF] Token invalid, refreshing and retrying...');
  const newToken = await deps.refreshCsrfToken();

  if (!newToken) {
    deps.logger.error('[CSRF] Failed to get new token for retry');
    return response;
  }

  deps.logger.log('[CSRF] Got new token, retrying request...');
  response = await deps.fetchWithAuth(
    url,
    {
      ...options,
      headers: {
        ...options.headers,
        'x-csrf-token': newToken,
      },
    },
    timeout
  );

  if (response.ok) {
    deps.logger.log('[CSRF] Retry successful');
  } else {
    deps.logger.warn('[CSRF] Retry failed with status:', response.status);
  }

  return response;
}
