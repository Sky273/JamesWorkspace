import { createAuthOptionsWithCsrf, fetchWithAuth, fetchWithCsrfRetry } from '../utils/apiInterceptor';

export const MARKET_RADAR_API_BASE = '/api/market-radar';
export const TEN_MINUTES = 600000;

export function buildQueryString(params: Record<string, string | number | undefined>): string {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.append(key, String(value));
    }
  });

  const query = queryParams.toString();
  return query ? `?${query}` : '';
}

export async function readJsonOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: fallbackMessage })) as { message?: string };
    throw new Error(error.message || fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export async function getMarketRadarJson<T>(path: string, timeout: number = TEN_MINUTES): Promise<T> {
  const response = await fetchWithAuth(path, {}, timeout);
  return readJsonOrThrow<T>(response, 'Market radar request failed');
}

export async function getMarketRadarApiJson<T>(
  path: string,
  timeout: number = TEN_MINUTES,
): Promise<T> {
  return getMarketRadarJson<T>(`${MARKET_RADAR_API_BASE}${path}`, timeout);
}

export async function postMarketRadarJson<TResponse>(
  path: string,
  body: Record<string, unknown> = {},
  timeout: number = TEN_MINUTES
): Promise<TResponse> {
  const options = await createAuthOptionsWithCsrf({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const response = await fetchWithCsrfRetry(path, options, timeout);
  return readJsonOrThrow<TResponse>(response, 'Market radar request failed');
}

export async function postMarketRadarApiJson<TResponse>(
  path: string,
  body: Record<string, unknown> = {},
  timeout: number = TEN_MINUTES,
): Promise<TResponse> {
  return postMarketRadarJson<TResponse>(`${MARKET_RADAR_API_BASE}${path}`, body, timeout);
}
