import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markViewScopesDirty } from '../utils/viewRefresh';
import GdprAuditPage from './GdprAuditPage';

const authGetMock = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../hooks/useAuthFetch', () => ({
  useAuthFetch: () => ({
    authGet: (...args: unknown[]) => authGetMock(...args),
  }),
}));

vi.mock('../components/page/PageHeader', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('../components/GdprAudit/GdprAuditStatsGrid', () => ({
  default: () => <div>stats-grid</div>,
}));

vi.mock('../components/GdprAudit/GdprAuditFiltersPanel', () => ({
  default: () => <div>filters-panel</div>,
}));

vi.mock('../components/GdprAudit/GdprAuditLogsTable', () => ({
  default: ({ logs }: { logs: Array<{ id: string }> }) => <div>logs:{logs.length}</div>,
}));

vi.mock('../components/GdprAudit/GdprAuditPagination', () => ({
  default: () => <div>pagination</div>,
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

function okJson(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  };
}

describe('GdprAuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

    authGetMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/gdpr-audit/actions')) {
        return Promise.resolve(okJson({ actions: [], categories: [] }));
      }
      if (url.startsWith('/api/gdpr-audit/firms')) {
        return Promise.resolve(okJson([]));
      }
      if (url.startsWith('/api/gdpr-audit/stats')) {
        return Promise.resolve(okJson({ total: 1 }));
      }
      if (url.startsWith('/api/gdpr-audit/logs')) {
        return Promise.resolve(okJson({ logs: [], pagination: { page: 1, totalPages: 1 } }));
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
  });

  it('forces a real refresh when the gdprAudit scope is marked dirty before mount', async () => {
    markViewScopesDirty(['gdprAudit']);

    render(<GdprAuditPage />);

    expect(await screen.findByText('gdprAudit.title')).toBeInTheDocument();

    await waitFor(() => {
      expect(authGetMock).toHaveBeenCalledWith(expect.stringContaining('/api/gdpr-audit/logs?page=1&limit=25&refresh=1'));
      expect(authGetMock).toHaveBeenCalledWith(expect.stringContaining('/api/gdpr-audit/stats?days=30&refresh=1'));
      expect(authGetMock).toHaveBeenCalledWith('/api/gdpr-audit/firms?refresh=1');
    });
  });

  it('reacts to runtime refresh events for gdpr audit data', async () => {
    render(<GdprAuditPage />);

    expect(await screen.findByText('gdprAudit.title')).toBeInTheDocument();

    markViewScopesDirty(['gdprAudit']);

    await waitFor(() => {
      expect(authGetMock).toHaveBeenCalledWith(expect.stringContaining('/api/gdpr-audit/logs?page=1&limit=25&refresh=1'));
      expect(authGetMock).toHaveBeenCalledWith(expect.stringContaining('/api/gdpr-audit/stats?days=30&refresh=1'));
    });
  });
});
