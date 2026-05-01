import { describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from './apiInterceptor.fetch';

const deps = {
  apiBaseUrl: '',
  logger: {
    group: vi.fn(),
    groupEnd: vi.fn(),
    table: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  toTimeoutError: () => new Error('timeout'),
} as const;

describe('fetchWithTimeout', () => {
  it('does not log user-initiated aborts as request timeouts or fetch errors', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError')));

    await expect(fetchWithTimeout(deps, '/api/test', { signal: controller.signal }, 1000)).rejects.toMatchObject({
      name: 'AbortError',
    });

    expect(deps.logger.error).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
