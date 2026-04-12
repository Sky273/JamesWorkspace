import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markViewScopesDirty } from '../utils/viewRefresh';
import { useResumesDashboard } from './ResumesPage.hooks';

const authGetMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ key: 'loc-1', state: null }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin' } }),
}));

vi.mock('../context/ResumeContext', () => ({
  useResume: () => ({
    deleteResume: vi.fn(),
    deleting: false,
  }),
}));

vi.mock('../hooks/useAuthFetch', () => ({
  useAuthFetch: () => ({
    authGet: (...args: unknown[]) => authGetMock(...args),
  }),
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

describe('useResumesDashboard refresh wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

    authGetMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/resumes/stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ resumes: { total: 1, improved: 0 }, scores: { averageImproved: 70 } }),
        });
      }
      if (url.startsWith('/api/tags/cleaned')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ Skills: [], Industries: [], Tools: [], 'Soft Skills': [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{ id: 'resume-1', Name: 'Ada' }],
          pagination: { totalCount: 1, hasMore: false, page: 1, pageSize: 20 },
        }),
      });
    });
  });

  it('forces resumes and stats refresh on mount when resumes scope is dirty', async () => {
    markViewScopesDirty(['resumes']);

    renderHook(() => useResumesDashboard());

    await waitFor(() => {
      expect(authGetMock).toHaveBeenCalledWith(expect.stringContaining('/api/resumes?page=1&limit=20&refresh=1'));
      expect(authGetMock).toHaveBeenCalledWith('/api/resumes/stats?refresh=1');
    });
  });

  it('forces resumes and stats refresh on runtime resumes dirty events', async () => {
    renderHook(() => useResumesDashboard());

    await waitFor(() => {
      expect(authGetMock).toHaveBeenCalled();
    });

    authGetMock.mockClear();
    markViewScopesDirty(['resumes']);

    await waitFor(() => {
      expect(authGetMock).toHaveBeenCalledWith(expect.stringContaining('/api/resumes?page=1&limit=20&refresh=1'));
      expect(authGetMock).toHaveBeenCalledWith('/api/resumes/stats?refresh=1');
    });
  });
});
