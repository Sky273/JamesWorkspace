import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserProfilePage from './UserProfilePage';

const authGetMock = vi.fn();
const authPutMock = vi.fn();
const forgotPasswordMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

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

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'jane@example.com' },
  }),
}));

vi.mock('../hooks/useAuthFetch', () => ({
  useAuthFetch: () => ({
    authGet: (...args: unknown[]) => authGetMock(...args),
    authPut: (...args: unknown[]) => authPutMock(...args),
  }),
}));

vi.mock('../services/authService', () => ({
  default: {
    forgotPassword: (...args: unknown[]) => forgotPasswordMock(...args),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../components/TwoFactorSettings', () => ({
  default: () => <div>two-factor-settings</div>,
}));

vi.mock('../components/page/PageHeader', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('../components/form/InputWithLeadingIcon', () => ({
  default: ({ value = '', onChange, disabled = false, type = 'text', placeholder = '' }: {
    value?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    type?: string;
    placeholder?: string;
  }) => (
    <input
      value={value}
      onChange={onChange}
      disabled={disabled}
      type={type}
      placeholder={placeholder}
    />
  ),
}));

describe('UserProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authGetMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: 'user-1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          jobTitle: 'Consultant',
          phone: '0102030405',
          firm: 'Acme',
        },
      }),
    });
    forgotPasswordMock.mockResolvedValue({
      success: true,
      message: 'Lien envoyé',
    });
  });

  it('requests a password reset email from the security tab', async () => {
    render(<UserProfilePage />);

    expect(await screen.findByText('userProfile.title')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'userProfile.tabs.security' }));
    fireEvent.click(await screen.findByRole('button', { name: 'userProfile.requestPasswordReset' }));

    await waitFor(() => {
      expect(forgotPasswordMock).toHaveBeenCalledWith('jane@example.com');
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Lien envoyé');
  });
});
