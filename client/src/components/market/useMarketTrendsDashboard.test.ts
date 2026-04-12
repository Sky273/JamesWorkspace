import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markViewScopesDirty } from '../../utils/viewRefresh';
import { useMarketTrendsDashboard } from './useMarketTrendsDashboard';

const getTrendsMock = vi.fn();
const getTrendsSummaryMock = vi.fn();
const getTrendFiltersMock = vi.fn();
const getStoredMetiersMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../services/marketRadarService', () => ({
  getTrends: (...args: unknown[]) => getTrendsMock(...args),
  getTrendsSummary: (...args: unknown[]) => getTrendsSummaryMock(...args),
  getTrendFilters: (...args: unknown[]) => getTrendFiltersMock(...args),
  triggerTrendsCollection: vi.fn(),
  triggerDynamicsCollection: vi.fn(),
}));

vi.mock('../../services/romeService', () => ({
  getStoredMetiers: (...args: unknown[]) => getStoredMetiersMock(...args),
}));

describe('useMarketTrendsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

    getTrendFiltersMock.mockResolvedValue({
      filters: { types: [], regions: [], romeCodes: [] },
    });
    getTrendsSummaryMock.mockResolvedValue({
      summary: { totalRecords: 1, types: [], regions: [], romeCodes: [] },
    });
    getStoredMetiersMock.mockResolvedValue([]);
    getTrendsMock.mockResolvedValue({
      grouped: false,
      trends: [{ id: 'trend-1', Type: 'offre' }],
      pagination: { totalPages: 1 },
      totalCount: 1,
    });
  });

  it('forces cached market trends data to reload on runtime dirty scope events', async () => {
    renderHook(() => useMarketTrendsDashboard());

    await waitFor(() => {
      expect(getTrendsMock).toHaveBeenCalled();
    });

    getTrendsMock.mockClear();
    getTrendsSummaryMock.mockClear();
    getTrendFiltersMock.mockClear();

    markViewScopesDirty(['marketTrends']);

    await waitFor(() => {
      expect(getTrendsMock).toHaveBeenCalledWith(expect.objectContaining({ forceRefresh: true }));
      expect(getTrendsSummaryMock).toHaveBeenCalledWith(true);
      expect(getTrendFiltersMock).toHaveBeenCalledWith(true);
    });
  });

  it('also refreshes market trends when ROME data changes', async () => {
    renderHook(() => useMarketTrendsDashboard());

    await waitFor(() => {
      expect(getTrendsMock).toHaveBeenCalled();
    });

    getTrendsMock.mockClear();

    markViewScopesDirty(['rome']);

    await waitFor(() => {
      expect(getTrendsMock).toHaveBeenCalledWith(expect.objectContaining({ forceRefresh: true }));
    });
  });
});
