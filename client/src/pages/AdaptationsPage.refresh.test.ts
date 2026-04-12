import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markViewScopesDirty } from '../utils/viewRefresh';
import { useAdaptationsDashboard } from './AdaptationsPage.hooks';

const authGetMock = vi.fn();
const getAllTemplatesMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../hooks/useAuthFetch', () => ({
  useAuthFetch: () => ({
    authGet: (...args: unknown[]) => authGetMock(...args),
  }),
}));

vi.mock('../utils/templateService', () => ({
  templateService: {
    getAllTemplates: (...args: unknown[]) => getAllTemplatesMock(...args),
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../utils/resumeAdaptationService', () => ({
  default: {
    deleteAdaptation: vi.fn(),
  },
}));

describe('useAdaptationsDashboard refresh wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

    getAllTemplatesMock.mockResolvedValue([]);
    authGetMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/adaptations')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [{ id: 'adapt-1', 'Resume Name': 'Ada' }],
            pagination: { totalCount: 1, hasMore: false, page: 1, pageSize: 12 },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });
  });

  it('forces adaptations refresh on mount when the adaptations scope is dirty', async () => {
    markViewScopesDirty(['adaptations']);

    renderHook(() => useAdaptationsDashboard());

    await waitFor(() => {
      expect(authGetMock).toHaveBeenCalledWith(expect.stringContaining('/api/adaptations?page=1&limit=12&refresh=1'));
    });
  });

  it('forces adaptations refresh on runtime adaptations dirty events', async () => {
    renderHook(() => useAdaptationsDashboard());

    await waitFor(() => {
      expect(authGetMock).toHaveBeenCalled();
    });

    authGetMock.mockClear();
    markViewScopesDirty(['adaptations']);

    await waitFor(() => {
      expect(authGetMock).toHaveBeenCalledWith(expect.stringContaining('/api/adaptations?page=1&limit=12&refresh=1'));
    });
  });
});
