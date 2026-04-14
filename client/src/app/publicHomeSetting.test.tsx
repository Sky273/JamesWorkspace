import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDefaultPublicHomeEnabled,
  resetPublicHomeEnabledRuntimeCache,
  setPublicHomeEnabledRuntimeValue,
  usePublicHomeEnabled,
} from './publicHomeSetting';

describe('publicHomeSetting', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetPublicHomeEnabledRuntimeCache();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the vite default until a runtime value is known', () => {
    const { result } = renderHook(() => usePublicHomeEnabled());

    expect(result.current).toBe(getDefaultPublicHomeEnabled());
  });

  it('updates from the public settings endpoint when available', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ publicHomeEnabled: false }),
    });

    const { result } = renderHook(() => usePublicHomeEnabled());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('reuses a runtime value pushed after settings save', () => {
    setPublicHomeEnabledRuntimeValue(true);

    const { result } = renderHook(() => usePublicHomeEnabled());

    expect(result.current).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
