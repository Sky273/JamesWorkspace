import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markViewScopesDirty } from '../../utils/viewRefresh';
import { useFranceMapData } from './useFranceMapData';

const getAllTrendsMock = vi.fn();
const getStoredMetiersMock = vi.fn();

vi.mock('../../services/marketRadarService', () => ({
  getAllTrends: (...args: unknown[]) => getAllTrendsMock(...args),
  getTrendMetadata: vi.fn(),
}));

vi.mock('../../services/romeService', () => ({
  getStoredMetiers: (...args: unknown[]) => getStoredMetiersMock(...args),
}));

vi.mock('../../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

describe('useFranceMapData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

    getAllTrendsMock.mockResolvedValue({
      trends: [{ id: 'trend-1', CodeRome: 'M1805', RegionCode: '11', Type: 'offre' }],
    });
    getStoredMetiersMock.mockResolvedValue([{ CodeRome: 'M1805', Libelle: 'Développeur' }]);
  });

  it('reloads the map dataset with forceRefresh when market data changes', async () => {
    renderHook(() => useFranceMapData('offres'));

    await waitFor(() => {
      expect(getAllTrendsMock).toHaveBeenCalledWith('offre', undefined);
      expect(getStoredMetiersMock).toHaveBeenCalledWith({ forceRefresh: undefined });
    });

    getAllTrendsMock.mockClear();
    getStoredMetiersMock.mockClear();

    markViewScopesDirty(['marketTrends']);

    await waitFor(() => {
      expect(getAllTrendsMock).toHaveBeenCalledWith('offre', true);
      expect(getStoredMetiersMock).toHaveBeenCalledWith({ forceRefresh: true });
    });
  });

  it('also reloads when rome data changes', async () => {
    renderHook(() => useFranceMapData('all'));

    await waitFor(() => {
      expect(getAllTrendsMock).toHaveBeenCalled();
    });

    getAllTrendsMock.mockClear();

    markViewScopesDirty(['rome']);

    await waitFor(() => {
      expect(getAllTrendsMock).toHaveBeenCalledWith(undefined, true);
    });
  });
});
