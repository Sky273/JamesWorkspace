import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDealsGroupedData } from './useDealsGroupedData';

const authGetMock = vi.fn();

vi.mock('../../hooks/useAuthFetch', () => ({
  useAuthFetch: () => ({
    authGet: (...args: unknown[]) => authGetMock(...args),
  }),
}));

vi.mock('../../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

describe('useDealsGroupedData refresh wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authGetMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        deals: [],
        unassigned: [],
        totalDeals: 0,
        totalAssigned: 0,
        totalUnassigned: 0,
      }),
    });
  });

  it('forces a grouped resumes refresh when refreshGroupedData is called', async () => {
    const { result } = renderHook(() => useDealsGroupedData({
      allTags: { Skills: [], Industries: [], Tools: [], 'Soft Skills': [] },
    }));

    await waitFor(() => {
      expect(authGetMock).toHaveBeenCalledWith('/api/resumes/grouped-by-deal');
    });

    authGetMock.mockClear();
    await result.current.fetchGroupedData();

    expect(authGetMock).toHaveBeenCalledWith('/api/resumes/grouped-by-deal?refresh=1');
  });
});
