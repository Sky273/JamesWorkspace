import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SecurityLogs from './SecurityLogs';

const fetchWithAuthMock = vi.fn();
const toastErrorMock = vi.fn();
const tMock = (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key;

function createMotionElement(tag: string) {
  const MotionElement = ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) =>
    createElement(tag, props, children);
  MotionElement.displayName = `MockMotion(${tag})`;
  return MotionElement;
}

vi.mock('framer-motion', () => ({
  motion: {
    div: createMotionElement('div'),
    tr: createMotionElement('tr'),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
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
    vi.useRealTimers();
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

  it('stops auto-refresh after a 401 response from the logs endpoint', async () => {
    let logsCallCount = 0;
    const intervalCallbacks: Array<() => Promise<void> | void> = [];
    const setIntervalSpy = vi
      .spyOn(globalThis, 'setInterval')
      .mockImplementation((((callback: TimerHandler, delay?: number) => {
        if (delay === 60000 && typeof callback === 'function') {
          intervalCallbacks.push(callback as () => Promise<void> | void);
        }
        return 1 as unknown as ReturnType<typeof setInterval>;
      }) as unknown) as typeof setInterval);

    fetchWithAuthMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/admin/security-logs')) {
        logsCallCount += 1;
        if (logsCallCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              logs: [
                {
                  timestamp: new Date().toISOString(),
                  source: 'security',
                  level: 'INFO',
                  event: 'login',
                  email: 'admin@example.com',
                  customer: 'Acme',
                  ip: '127.0.0.1',
                  action: 'signin',
                  statusCode: 200,
                  message: 'ok',
                },
              ],
              total: 1,
            }),
          });
        }

        return Promise.resolve({
          ok: false,
          status: 401,
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
      expect(screen.getByText('login')).toBeInTheDocument();
    });

    const autoRefreshCheckbox = screen.getByRole('checkbox');
    expect(autoRefreshCheckbox).toBeChecked();
    expect(intervalCallbacks.length).toBeGreaterThan(0);

    await act(async () => {
      await intervalCallbacks.at(-1)?.();
    });

    await waitFor(() => {
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    const logCallsAfter401 = fetchWithAuthMock.mock.calls.filter(([url]) =>
      String(url).startsWith('/api/admin/security-logs'),
    ).length;

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);

    const finalLogCalls = fetchWithAuthMock.mock.calls.filter(([url]) =>
      String(url).startsWith('/api/admin/security-logs'),
    ).length;

    expect(finalLogCalls).toBe(logCallsAfter401);
    setIntervalSpy.mockRestore();
  });

  it('surfaces an auth error when stats loading returns 403', async () => {
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
          ok: false,
          status: 403,
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
      expect(screen.getAllByText('security.accessDenied').length).toBeGreaterThan(0);
    });

    expect(toastErrorMock).toHaveBeenCalledWith('security.accessDenied');
  });
});
