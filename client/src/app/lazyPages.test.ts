import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canAttemptChunkRecovery,
  isRecoverableDynamicImportError,
  loadLazyPageModule,
} from './lazyPages';

describe('lazyPages chunk recovery', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('detects recoverable dynamic import errors', () => {
    expect(isRecoverableDynamicImportError(new Error('Failed to fetch dynamically imported module: /assets/page.js'))).toBe(true);
    expect(isRecoverableDynamicImportError(new Error('ChunkLoadError: loading chunk 42 failed'))).toBe(true);
    expect(isRecoverableDynamicImportError(new Error('Regular application error'))).toBe(false);
  });

  it('allows only one chunk recovery attempt per current path', () => {
    const path = '/admin/templates/new';

    expect(canAttemptChunkRecovery(window.sessionStorage, path)).toBe(true);
    window.sessionStorage.setItem('lazy-page-reload-once', path);
    expect(canAttemptChunkRecovery(window.sessionStorage, path)).toBe(false);
    expect(canAttemptChunkRecovery(window.sessionStorage, '/admin')).toBe(true);
  });

  it('forces a one-time reload on recoverable lazy import errors', async () => {
    const promise = loadLazyPageModule(
      () => Promise.reject(new Error('Failed to fetch dynamically imported module: /assets/js/NewTemplatePage.js')),
      [],
      { reload: vi.fn() },
    );

    await Promise.race([
      promise.then(() => 'resolved'),
      new Promise((resolve) => setTimeout(() => resolve('pending'), 20)),
    ]).then((status) => {
      expect(status).toBe('pending');
    });
  });
});
