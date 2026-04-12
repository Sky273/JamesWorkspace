import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markViewScopesDirty } from '../utils/viewRefresh';
import { useScopedViewRefresh } from './useScopedViewRefresh';

describe('useScopedViewRefresh', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('runs the refresh callback on mount when a matching scope is already dirty', async () => {
    const onRefresh = vi.fn();
    markViewScopesDirty(['missions']);

    renderHook(() => useScopedViewRefresh({
      consumerId: 'test-consumer',
      scopes: ['missions'],
      onRefresh,
    }));

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledWith(['missions']);
    });
  });

  it('runs the refresh callback on runtime dirty events', async () => {
    const onRefresh = vi.fn();

    renderHook(() => useScopedViewRefresh({
      consumerId: 'test-consumer',
      scopes: ['missions'],
      onRefresh,
    }));

    markViewScopesDirty(['missions']);

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledWith(['missions']);
    });
  });

  it('does nothing while disabled', async () => {
    const onRefresh = vi.fn();
    markViewScopesDirty(['missions']);

    renderHook(() => useScopedViewRefresh({
      consumerId: 'test-consumer',
      scopes: ['missions'],
      onRefresh,
      enabled: false,
    }));

    await new Promise((resolve) => window.setTimeout(resolve, 10));
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
