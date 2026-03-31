import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GdprTab from './GdprTab';

const {
  mockFetchWithAuth,
  mockCreateAuthOptionsWithCsrf,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockFetchWithAuth: vi.fn(),
  mockCreateAuthOptionsWithCsrf: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('../../utils/apiInterceptor', () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
  createAuthOptionsWithCsrf: (...args: unknown[]) => mockCreateAuthOptionsWithCsrf(...args),
}));

vi.mock('../../utils/logger.frontend', () => ({
  default: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('GdprTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAuthOptionsWithCsrf.mockResolvedValue({ method: 'GET' });
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ connected: false }),
    });
    vi.mocked(window.open).mockReturnValue({ closed: false } as Window);
  });

  it('ignores oauth popup messages from unexpected origins', async () => {
    mockFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ connected: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authUrl: 'https://accounts.google.com/oauth' }),
      });

    render(<GdprTab t={(key) => key} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'settings.gdpr.connectGmail' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'settings.gdpr.connectGmail' }));

    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://evil.example',
      data: { type: 'gdpr-oauth-success' }
    }));

    await waitFor(() => {
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  it('accepts oauth popup messages from the current origin', async () => {
    mockFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ connected: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authUrl: 'https://accounts.google.com/oauth' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ connected: true, email: 'gdpr@example.com' }),
      });

    render(<GdprTab t={(key) => key} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'settings.gdpr.connectGmail' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'settings.gdpr.connectGmail' }));

    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { type: 'gdpr-oauth-success' }
    }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('settings.gdpr.connected');
    });
  });
});
