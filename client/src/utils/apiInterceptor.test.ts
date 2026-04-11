import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCsrfToken: vi.fn(),
  refreshCsrfToken: vi.fn(),
  clearCsrfToken: vi.fn(),
  resetCsrfState: vi.fn(),
  isCsrfError: vi.fn(),
  isSessionRedirectInProgress: vi.fn(),
  resetSessionRedirect: vi.fn(),
  setSessionExpiredHandler: vi.fn(),
  triggerSessionExpiry: vi.fn(),
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('./logger.frontend', () => ({ default: mocks.logger }));
vi.mock('./csrfManager', () => ({
  getCsrfToken: mocks.getCsrfToken,
  refreshCsrfToken: mocks.refreshCsrfToken,
  fetchCsrfToken: vi.fn(),
  clearCsrfToken: mocks.clearCsrfToken,
  resetCsrfState: mocks.resetCsrfState,
  isCsrfError: mocks.isCsrfError,
}));
vi.mock('./sessionRedirect', () => ({
  isSessionRedirectInProgress: mocks.isSessionRedirectInProgress,
  resetSessionRedirect: mocks.resetSessionRedirect,
  setSessionExpiredHandler: mocks.setSessionExpiredHandler,
  triggerSessionExpiry: mocks.triggerSessionExpiry,
}));

import {
  SessionRedirectError,
  isSessionRedirectError,
  setSessionExpiredHandler,
  resetSessionState,
  attemptTokenRefresh,
  fetchWithAuth,
  createAuthOptions,
  createAuthOptionsWithCsrf,
  authGet,
  authPost,
  authPut,
  authDelete,
} from './apiInterceptor';

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });

describe('apiInterceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    mocks.getCsrfToken.mockResolvedValue('csrf-token');
    mocks.refreshCsrfToken.mockResolvedValue('fresh-csrf-token');
    mocks.isCsrfError.mockResolvedValue(false);
    mocks.isSessionRedirectInProgress.mockReturnValue(false);
  });

  it('keeps SessionRedirectError helpers working', () => {
    const error = new SessionRedirectError();
    expect(error.name).toBe('SessionRedirectError');
    expect(isSessionRedirectError(error)).toBe(true);
  });

  it('registers session expired handler and resets session state', () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    resetSessionState();

    expect(mocks.setSessionExpiredHandler).toHaveBeenCalledWith(handler);
    expect(mocks.resetSessionRedirect).toHaveBeenCalled();
    expect(mocks.resetCsrfState).toHaveBeenCalled();
  });

  it('creates auth options with credentials included', () => {
    const options = createAuthOptions({ method: 'GET', headers: { A: '1' } });
    expect(options).toEqual({ method: 'GET', headers: { A: '1' }, credentials: 'include' });
  });

  it('creates auth options with csrf token', async () => {
    const options = await createAuthOptionsWithCsrf({ method: 'POST', headers: { A: '1' } }, true);

    expect(mocks.getCsrfToken).toHaveBeenCalledWith(true);
    expect(options).toEqual({
      method: 'POST',
      headers: { A: '1', 'x-csrf-token': 'csrf-token' },
      credentials: 'include',
    });
  });

  it('does not fetch csrf token for safe requests', async () => {
    const options = await createAuthOptionsWithCsrf({ method: 'GET', headers: { A: '1' } }, true);

    expect(mocks.getCsrfToken).not.toHaveBeenCalled();
    expect(options).toEqual({
      method: 'GET',
      headers: { A: '1' },
      credentials: 'include',
    });
  });

  it('attempts token refresh successfully', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, { status: 200 }));

    await expect(attemptTokenRefresh()).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/auth/refresh', expect.objectContaining({ method: 'POST' }));
  });

  it('blocks requests when session redirect is already in progress', async () => {
    mocks.isSessionRedirectInProgress.mockReturnValue(true);
    await expect(fetchWithAuth('/api/test')).rejects.toBeInstanceOf(SessionRedirectError);
  });

  it('retries GET once on transient 400 response', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ error: 'bad gateway' }, { status: 400 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 200 }));

    const promise = fetchWithAuth('/api/test');
    await vi.advanceTimersByTimeAsync(500);
    const response = await promise;

    expect(response.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('refreshes token and retries the original request on 401', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ error: 'unauthorized' }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({}, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 200 }));

    const response = await fetchWithAuth('/api/protected');

    expect(response.ok).toBe(true);
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/auth/refresh', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('refreshes token and retries when the access token cookie is missing', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ error: 'missing', code: 'TOKEN_MISSING' }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({}, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 200 }));

    const response = await fetchWithAuth('/api/protected');

    expect(response.ok).toBe(true);
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/auth/refresh', expect.objectContaining({ method: 'POST' }));
    expect(mocks.triggerSessionExpiry).not.toHaveBeenCalled();
  });

  it('redirects on missing access token when refresh fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ error: 'missing', code: 'TOKEN_MISSING' }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ error: 'refresh expired' }, { status: 401 }));

    await expect(fetchWithAuth('/api/protected')).rejects.toBeInstanceOf(SessionRedirectError);
    expect(mocks.triggerSessionExpiry).toHaveBeenCalled();
  });

  it('redirects immediately on JWT auth errors', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: 'jwt expired' }, { status: 401 })
    );

    await expect(fetchWithAuth('/api/protected')).rejects.toBeInstanceOf(SessionRedirectError);
    expect(mocks.triggerSessionExpiry).toHaveBeenCalled();
  });

  it('throws refresh token expired when refresh endpoint itself returns 401', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: 'expired' }, { status: 401 })
    );

    await expect(fetchWithAuth('/api/auth/refresh')).rejects.toThrow('Refresh token expired');
  });

  it('throws a regular forbidden error for non-session 403 responses', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: 'Accès refusé métier' }, { status: 403 })
    );

    await expect(fetchWithAuth('/api/protected')).rejects.toThrow('Accès refusé métier');
  });

  it('redirects on session-related 403 responses', async () => {
    mocks.isCsrfError.mockResolvedValue(false);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: 'invalid csrf token', code: 'CSRF_INVALID' }, { status: 403 })
    );

    await expect(fetchWithAuth('/api/protected')).rejects.toBeInstanceOf(SessionRedirectError);
    expect(mocks.triggerSessionExpiry).toHaveBeenCalled();
  });

  it('returns csrf 403 responses so fetchWithCsrfRetry can retry them', async () => {
    mocks.isCsrfError.mockResolvedValue(true);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: 'Invalid CSRF token', code: 'CSRF_INVALID' }, { status: 403 })
    );

    const response = await fetchWithAuth('/api/protected');

    expect(response.status).toBe(403);
    expect(mocks.triggerSessionExpiry).not.toHaveBeenCalled();
  });

  it('triggers proactive refresh when the response warns about token expiry', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'X-Token-Expiring-Soon': 'true' } }))
      .mockResolvedValueOnce(jsonResponse({}, { status: 200 }));

    const response = await fetchWithAuth('/api/test');

    expect(response.ok).toBe(true);
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledWith('/api/auth/refresh', expect.objectContaining({ method: 'POST' }));
  });

  it('sends JSON payloads with csrf for authPost and authPut', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 200 }));

    await authPost('/api/items', { a: 1 });
    await authPut('/api/items/1', { b: 2 });

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/items', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ a: 1 }),
      headers: expect.objectContaining({ 'Content-Type': 'application/json', 'x-csrf-token': 'csrf-token' }),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/items/1', expect.objectContaining({
      method: 'PUT',
      credentials: 'include',
      body: JSON.stringify({ b: 2 }),
      headers: expect.objectContaining({ 'Content-Type': 'application/json', 'x-csrf-token': 'csrf-token' }),
    }));
  });

  it('sends authGet and authDelete with credentials included', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, { status: 200 }));

    await authGet('/api/items');
    await authDelete('/api/items/1');

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/items', expect.objectContaining({ method: 'GET', credentials: 'include' }));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/items/1', expect.objectContaining({ method: 'DELETE', credentials: 'include' }));
  });
});
