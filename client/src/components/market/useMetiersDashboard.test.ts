import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markViewScopesDirty } from '../../utils/viewRefresh';
import { useMetiersDashboard } from './useMetiersDashboard';

const getStoredMetiersPaginatedMock = vi.fn();
const getMetiersStatsMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../services/romeService', () => ({
  getStoredMetiersPaginated: (...args: unknown[]) => getStoredMetiersPaginatedMock(...args),
  getMetiersStats: (...args: unknown[]) => getMetiersStatsMock(...args),
  collectITMetiers: vi.fn(),
}));

vi.mock('../../utils/logger.frontend', () => ({
  createLogger: () => ({
    warn: vi.fn(),
  }),
}));

describe('useMetiersDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

    getStoredMetiersPaginatedMock.mockResolvedValue({
      metiers: [{ CodeRome: 'M1805', Libelle: 'Développeur' }],
      totalCount: 1,
      pagination: { totalPages: 1 },
    });
    getMetiersStatsMock.mockResolvedValue({
      totalMetiers: 1,
      totalCompetences: 1,
      totalCompetencesDetaillees: 1,
      totalMacroSavoirFaire: 1,
      totalSavoirs: 1,
      lastUpdated: '2026-04-12T00:00:00.000Z',
    });
  });

  it('forces a metiers reload when the rome scope is marked dirty', async () => {
    renderHook(() => useMetiersDashboard(true));

    await waitFor(() => {
      expect(getStoredMetiersPaginatedMock).toHaveBeenCalled();
      expect(getMetiersStatsMock).toHaveBeenCalled();
    });

    getStoredMetiersPaginatedMock.mockClear();
    getMetiersStatsMock.mockClear();

    markViewScopesDirty(['rome']);

    await waitFor(() => {
      expect(getStoredMetiersPaginatedMock).toHaveBeenCalledWith(expect.objectContaining({ forceRefresh: true }));
      expect(getMetiersStatsMock).toHaveBeenCalledTimes(1);
    });
  });
});
