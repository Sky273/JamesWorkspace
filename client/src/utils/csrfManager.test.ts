import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCsrfToken,
  refreshCsrfToken,
  fetchCsrfToken,
  clearCsrfToken,
  resetCsrfState,
  isCsrfError,
} from './csrfManager';

vi.mock('./logger.frontend', () => ({
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('csrfManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCsrfToken();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches and caches a csrf token', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ csrfToken: 'token-1' }),
    } as Response);

    const first = await getCsrfToken();
    const second = await getCsrfToken();

    expect(first).toBe('token-1');
    expect(second).toBe('token-1');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent token requests', async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    vi.mocked(fetch).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve as (value: Response) => void;
      }) as Promise<Response>
    );

    const p1 = getCsrfToken();
    const p2 = getCsrfToken();

    resolveFetch?.({ ok: true, json: async () => ({ csrfToken: 'token-2' }) } as Response);

    await expect(Promise.all([p1, p2])).resolves.toEqual(['token-2', 'token-2']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('forces a refresh when requested', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'token-1' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'token-2' }) } as Response);

    expect(await getCsrfToken()).toBe('token-1');
    expect(await refreshCsrfToken()).toBe('token-2');
    expect(await fetchCsrfToken()).toBe('token-2');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('clears and resets cached state', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'token-1' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'token-3' }) } as Response);

    await getCsrfToken();
    clearCsrfToken();
    resetCsrfState();
    expect(await getCsrfToken()).toBe('token-3');
  });

  it('detects csrf errors from text and json payloads', async () => {
    const textResponse = new Response('Invalid CSRF token', { status: 403 });
    const jsonResponse = new Response(JSON.stringify({ error: 'invalid token' }), { status: 403 });
    const okResponse = new Response('fine', { status: 200 });

    await expect(isCsrfError(textResponse)).resolves.toBe(true);
    await expect(isCsrfError(jsonResponse)).resolves.toBe(true);
    await expect(isCsrfError(okResponse)).resolves.toBe(false);
  });
});
