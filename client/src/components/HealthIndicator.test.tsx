import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HealthIndicator from './HealthIndicator';

const mockFetchWithAuth = vi.fn();
let mockUser: { role: string } | null = { role: 'admin' };

const healthyDegradedPayload = {
  status: 'degraded',
  responseTime: '120ms',
  timestamp: '2026-03-25T10:00:00.000Z',
  checks: {
    server: { status: 'ok', uptime: '1d' },
    database: { status: 'error', error: 'Connexion échouée' },
    memory: { status: 'warning', percentage: 92, heapUsed: '200MB', heapTotal: '256MB' },
    cache: { status: 'ok' },
    apiKeys: { status: 'warning', openai: false, anthropic: true },
  },
};

const memoryPayload = {
  process: { heapUsed: '200MB', heapTotal: '256MB', rss: '0', external: '0', arrayBuffers: '0' },
  caches: {
    simpleCache: { estimated: '1MB', details: { settings: 1, templates: 2, firms: 3 } },
    trends: { estimated: '1MB', details: { size: 1, maxSize: 10 } },
    facts: { estimated: '1MB', details: { size: 2, maxSize: 10 } },
    metiers: { estimated: '1MB', details: { size: 3, maxSize: 10 } },
    esco: { estimated: '1MB', details: { size: 4, maxSize: 10 } },
    tags: { estimated: '1MB', details: { cleanedTags: { hasData: true, ageMs: 0 }, escoTags: { hasData: false, ageMs: null }, ttlMinutes: 15 } },
    security: { estimated: '1MB', details: { blacklistedTokens: 2, blacklistedUsers: 1 } },
  },
  summary: { totalCacheEntries: 11, gcAvailable: true },
  timestamp: '2026-03-25T10:00:00.000Z',
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

vi.mock('../utils/apiInterceptor', () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
  createAuthOptions: vi.fn(() => ({ method: 'GET' })),
}));

vi.mock('../utils/dateFormatter', () => ({
  formatDateTime: (value: string) => `formatted:${value}`,
}));

describe('HealthIndicator', () => {
  beforeEach(() => {
    mockUser = { role: 'admin' };
    mockFetchWithAuth.mockReset();
    mockFetchWithAuth
      .mockResolvedValueOnce({ ok: true, json: async () => healthyDegradedPayload })
      .mockResolvedValueOnce({ ok: true, json: async () => memoryPayload })
      .mockResolvedValueOnce({ ok: true, json: async () => healthyDegradedPayload })
      .mockResolvedValueOnce({ ok: true, json: async () => memoryPayload });
  });

  it('renders nothing for non-admin users by default', () => {
    mockUser = { role: 'user' };
    const { container } = render(<HealthIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the header health indicator and details for admins', async () => {
    render(<HealthIndicator variant="header" />);

    expect(await screen.findByText('health.degraded')).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByText('health.degraded').closest('div') as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('health.systemHealth')).toBeInTheDocument();
    });

    expect(screen.getByText('health.database')).toBeInTheDocument();
    expect(screen.getByText(/Mémoire critique/)).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('formatted:2026-03-25T10:00:00.000Z'))).toBeInTheDocument();
    expect(mockFetchWithAuth).toHaveBeenCalledTimes(4);
  });

  it('shows an unhealthy state when the server cannot be reached', async () => {
    mockFetchWithAuth.mockReset();
    mockFetchWithAuth
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true, json: async () => memoryPayload })
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true, json: async () => memoryPayload });

    render(<HealthIndicator variant="header" showAlways />);

    expect(await screen.findByText('health.unhealthy')).toBeInTheDocument();
    fireEvent.click(screen.getByText('health.unhealthy').closest('div') as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText(/Impossible de contacter le serveur/)).toBeInTheDocument();
    });
  });
});

