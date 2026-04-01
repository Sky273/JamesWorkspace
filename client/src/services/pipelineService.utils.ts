import { createAuthOptionsWithCsrf, fetchWithAuth } from '../utils/apiInterceptor';

export const PIPELINE_API_BASE = '/api/pipeline';

export function buildPipelineQuery(filters?: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.append(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function fetchPipelineJson<T>(
  url: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
    fallbackMessage: string;
  }
): Promise<T> {
  const requestOptions = await createAuthOptionsWithCsrf({
    method: options?.method || 'GET',
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const response = await fetchWithAuth(url, requestOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: options?.fallbackMessage || 'Pipeline request failed' })) as { error?: string };
    throw new Error(errorData.error || options?.fallbackMessage || 'Pipeline request failed');
  }

  return response.json() as Promise<T>;
}

export async function fetchPipelineApiJson<T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
    fallbackMessage: string;
  }
): Promise<T> {
  return fetchPipelineJson<T>(`${PIPELINE_API_BASE}${path}`, options);
}

export async function fetchPipelineVoid(
  url: string,
  method: 'DELETE',
  fallbackMessage: string
): Promise<void> {
  const requestOptions = await createAuthOptionsWithCsrf({ method });
  const response = await fetchWithAuth(url, requestOptions);

  if (!response.ok) {
    throw new Error(fallbackMessage);
  }
}

export async function fetchPipelineApiVoid(
  path: string,
  method: 'DELETE',
  fallbackMessage: string
): Promise<void> {
  return fetchPipelineVoid(`${PIPELINE_API_BASE}${path}`, method, fallbackMessage);
}
