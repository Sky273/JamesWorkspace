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

const defaultStatusResponse = {
  connected: false,
  effectiveProvider: 'gmail',
  allowConnect: true,
};

const defaultConfigResponse = {
  provider: 'gmail',
  effectiveProvider: 'gmail',
  source: 'environment',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPassword: '',
  smtpFromName: 'ResumeConverter',
  smtpFromEmail: '',
  googleGdprRedirectUri: 'https://resumeconverter.net/api/gdpr/mail/callback',
  hasSmtpPassword: false,
  smtpConfigured: false,
  googleClientConfigured: true,
};

function mockInitialRequests() {
  mockFetchWithAuth.mockImplementation(async (url: string) => {
    if (url === '/api/gdpr/mail/status') {
      return {
        ok: true,
        json: async () => defaultStatusResponse,
      };
    }

    if (url === '/api/gdpr/mail/config') {
      return {
        ok: true,
        json: async () => defaultConfigResponse,
      };
    }

    return {
      ok: true,
      json: async () => ({ authUrl: 'https://accounts.google.com/oauth' }),
    };
  });
}

describe('GdprTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAuthOptionsWithCsrf.mockImplementation(async (options?: RequestInit) => ({
      ...(options || {}),
    }));
    mockInitialRequests();
    vi.mocked(window.open).mockReturnValue({ closed: false, close: vi.fn() } as unknown as Window);
  });

  it('ignores oauth popup messages from unexpected origins', async () => {
    mockFetchWithAuth.mockImplementation(async (url: string, _options?: RequestInit) => {
      if (url === '/api/gdpr/mail/status') {
        return {
          ok: true,
          json: async () => defaultStatusResponse,
        };
      }

      if (url === '/api/gdpr/mail/config') {
        return {
          ok: true,
          json: async () => defaultConfigResponse,
        };
      }

      if (url === '/api/gdpr/mail/auth-url') {
        return {
          ok: true,
          json: async () => ({ authUrl: 'https://accounts.google.com/oauth' }),
        };
      }

      return {
        ok: true,
        json: async () => defaultStatusResponse,
      };
    });

    render(<GdprTab t={(key) => key} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'settings.gdpr.connectGmail' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'settings.gdpr.connectGmail' }));
    await waitFor(() => {
      expect(window.open).toHaveBeenCalled();
    });

    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://evil.example',
      data: { type: 'gdpr-oauth-success' }
    }));

    await waitFor(() => {
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  it('accepts oauth popup messages from the current origin', async () => {
    let statusCallCount = 0;
    mockFetchWithAuth.mockImplementation(async (url: string, _options?: RequestInit) => {
      if (url === '/api/gdpr/mail/status') {
        statusCallCount += 1;
        return {
          ok: true,
          json: async () => (statusCallCount > 1
            ? { connected: true, effectiveProvider: 'gmail', email: 'gdpr@example.com', allowConnect: false }
            : defaultStatusResponse),
        };
      }

      if (url === '/api/gdpr/mail/config') {
        return {
          ok: true,
          json: async () => defaultConfigResponse,
        };
      }

      if (url === '/api/gdpr/mail/auth-url') {
        return {
          ok: true,
          json: async () => ({ authUrl: 'https://accounts.google.com/oauth' }),
        };
      }

      return {
        ok: true,
        json: async () => defaultStatusResponse,
      };
    });

    render(<GdprTab t={(key) => key} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'settings.gdpr.connectGmail' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'settings.gdpr.connectGmail' }));
    await waitFor(() => {
      expect(window.open).toHaveBeenCalled();
    });

    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { type: 'gdpr-oauth-success' }
    }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('settings.gdpr.connected');
    });
  });

  it('saves the mail configuration from the GDPR tab', async () => {
    mockFetchWithAuth.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url === '/api/gdpr/mail/status') {
        return {
          ok: true,
          json: async () => defaultStatusResponse,
        };
      }

      if (url === '/api/gdpr/mail/config' && (!options || options.method === 'GET')) {
        return {
          ok: true,
          json: async () => defaultConfigResponse,
        };
      }

      if (url === '/api/gdpr/mail/config' && options?.method === 'PUT') {
        return {
          ok: true,
          json: async () => ({ ...defaultConfigResponse, provider: 'smtp', smtpHost: 'smtp.example.com' }),
        };
      }

      return {
        ok: true,
        json: async () => ({ authUrl: 'https://accounts.google.com/oauth' }),
      };
    });

    render(<GdprTab t={(key) => key} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'settings.gdpr.saveConfig' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('settings.gdpr.providerLabel'), { target: { value: 'smtp' } });
    fireEvent.change(screen.getByLabelText('settings.gdpr.smtp.host'), { target: { value: 'smtp.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'settings.gdpr.saveConfig' }));

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/api/gdpr/mail/config',
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  it('sends the test email with the current form configuration', async () => {
    vi.stubGlobal('prompt', vi.fn(() => 'test@example.com'));

    mockFetchWithAuth.mockImplementation(async (url: string, _options?: RequestInit) => {
      if (url === '/api/gdpr/mail/status') {
        return {
          ok: true,
          json: async () => defaultStatusResponse,
        };
      }

      if (url === '/api/gdpr/mail/config') {
        return {
          ok: true,
          json: async () => defaultConfigResponse,
        };
      }

      if (url === '/api/gdpr/mail/test') {
        return {
          ok: true,
          json: async () => ({ success: true, sentTo: 'test@example.com' }),
        };
      }

      return {
        ok: true,
        json: async () => ({ authUrl: 'https://accounts.google.com/oauth' }),
      };
    });

    render(<GdprTab t={(key) => key} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'settings.gdpr.testSend' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('settings.gdpr.providerLabel'), { target: { value: 'smtp' } });
    fireEvent.change(screen.getByLabelText('settings.gdpr.smtp.host'), { target: { value: 'smtp.form.example.com' } });
    fireEvent.change(screen.getByLabelText('settings.gdpr.smtp.port'), { target: { value: '2525' } });
    fireEvent.change(screen.getByLabelText('settings.gdpr.smtp.user'), { target: { value: 'form-user@example.com' } });
    fireEvent.change(screen.getByLabelText('settings.gdpr.smtp.password'), { target: { value: 'form-password' } });
    fireEvent.change(screen.getByLabelText('settings.gdpr.smtp.fromEmail'), { target: { value: 'form-sender@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'settings.gdpr.testSend' }));

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/api/gdpr/mail/test',
        expect.objectContaining({ method: 'POST' })
      );
    });

    const testCall = mockFetchWithAuth.mock.calls.find(([url]) => url === '/api/gdpr/mail/test');
    expect(testCall).toBeTruthy();
    expect(JSON.parse((testCall?.[1] as RequestInit).body as string)).toEqual(expect.objectContaining({
      email: 'test@example.com',
      provider: 'smtp',
      smtpHost: 'smtp.form.example.com',
      smtpPort: 2525,
      smtpUser: 'form-user@example.com',
      smtpPassword: 'form-password',
      smtpFromEmail: 'form-sender@example.com'
    }));

    vi.unstubAllGlobals();
  });
});
