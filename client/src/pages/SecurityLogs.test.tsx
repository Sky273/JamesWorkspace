import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SecurityLogs from './SecurityLogs';

const fetchWithAuthMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: ComponentProps<'div'> & { children?: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('../components/page/PageHeader', () => ({
  default: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  ),
}));

vi.mock('../utils/apiInterceptor', () => ({
  createAuthOptions: vi.fn(() => ({})),
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

describe('SecurityLogs', () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
    toastErrorMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows an explicit error state when logs can't be loaded", async () => {
    fetchWithAuthMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/admin/security-logs')) {
        return Promise.resolve({
          ok: false,
          status: 500,
        });
      }

      if (url === '/api/admin/security-stats') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            total: 12,
            recent: { lastHour: 1, last24h: 5 },
            byLevel: { ERROR: 2 },
          }),
        });
      }

      if (url === '/api/admin/security-filters') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            levels: [],
            events: [],
            sources: [],
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    render(<SecurityLogs />);

    await waitFor(() => {
      expect(screen.getAllByText('Unable to load security logs.').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('security.noLogs')).not.toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalled();
  });

  it('applies and clears filters without falling back to a false empty state', async () => {
    fetchWithAuthMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/admin/security-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            logs: [],
            total: 0,
          }),
        });
      }

      if (url === '/api/admin/security-stats') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            total: 12,
            recent: { lastHour: 1, last24h: 5 },
            byLevel: { ERROR: 2 },
          }),
        });
      }

      if (url === '/api/admin/security-filters') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            levels: ['ERROR'],
            events: ['auth_failed'],
            sources: ['security'],
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    render(<SecurityLogs />);

    await waitFor(() => {
      expect(screen.getAllByText('security.noLogs').length).toBeGreaterThan(0);
    });

    const [levelSelect] = screen.getAllByRole('combobox');
    fireEvent.change(levelSelect, { target: { value: 'ERROR' } });

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        expect.stringContaining('level=ERROR'),
        expect.anything(),
      );
    });

    fireEvent.click(screen.getByTitle('common.resetFilters'));

    await waitFor(() => {
      const logCalls = fetchWithAuthMock.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.startsWith('/api/admin/security-logs'));
      expect(logCalls.at(-1)).not.toContain('level=ERROR');
    });

    expect(screen.getAllByText('security.noLogs').length).toBeGreaterThan(0);
    expect(screen.queryByText('Unable to load security logs.')).not.toBeInTheDocument();
  });
});
