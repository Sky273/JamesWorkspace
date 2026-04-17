import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import SignIn from './SignIn';

const {
  mockSignIn,
  mockNavigate,
  mockFetchWithCsrfRetry,
  mockResetSessionState,
  mockToastError,
  mockToastSuccess,
} = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockNavigate: vi.fn(),
  mockFetchWithCsrfRetry: vi.fn(),
  mockResetSessionState: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

let mockSearchParams = new URLSearchParams();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

vi.mock('../utils/apiInterceptor', () => ({
  resetSessionState: mockResetSessionState,
  fetchWithCsrfRetry: mockFetchWithCsrfRetry,
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('./Footer', () => ({
  default: () => <div data-testid="footer" />,
}));

vi.mock('./TwoFactorVerify', () => ({
  default: ({ email, userId }: { email: string; userId: string }) => (
    <div data-testid="two-factor-verify">2FA:{email}:{userId}</div>
  ),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  };
});

const renderSignIn = () =>
  render(
    <MemoryRouter>
      <SignIn />
    </MemoryRouter>
  );

describe('SignIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockFetchWithCsrfRetry.mockResolvedValue({
      json: async () => ({ authUrl: 'https://accounts.google.com/oauth' }),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('resets session state on mount', () => {
    renderSignIn();
    expect(mockResetSessionState).toHaveBeenCalled();
  });

  it('localizes the password visibility toggle', () => {
    renderSignIn();

    expect(screen.getByRole('button', { name: 'auth.togglePassword.show' })).toBeInTheDocument();
  });

  it('exposes programmatic labels for sign-in fields', () => {
    renderSignIn();

    expect(screen.getByLabelText('auth.signIn.emailLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.signIn.passwordLabel')).toBeInTheDocument();
  });

  it('submits credentials in lowercase and navigates home on success', async () => {
    mockSignIn.mockResolvedValue({ id: '1', email: 'john@example.com' });
    renderSignIn();

    fireEvent.change(screen.getByPlaceholderText('auth.signIn.emailPlaceholder'), { target: { value: 'John@Example.COM' } });
    fireEvent.change(screen.getByPlaceholderText('auth.signIn.passwordPlaceholder'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'auth.signIn.signInButton' }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('john@example.com', 'secret');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows unauthorized error when sign in fails', async () => {
    mockSignIn.mockRejectedValue(new Error('bad creds'));
    renderSignIn();

    fireEvent.change(screen.getByPlaceholderText('auth.signIn.emailPlaceholder'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.signIn.passwordPlaceholder'), { target: { value: 'secret' } });
    fireEvent.submit(screen.getByRole('button', { name: 'auth.signIn.signInButton' }).closest('form') as HTMLFormElement);

    expect(await screen.findByText('errors.unauthorized')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('errors.unauthorized');
    expect(screen.getByLabelText('auth.signIn.emailLabel')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('auth.signIn.passwordLabel')).toHaveAttribute('aria-invalid', 'true');
  });

  it('has no critical accessibility violations on the default sign-in form', async () => {
    const { container } = renderSignIn();
    const results = await axe(container);

    expect(results.violations).toHaveLength(0);
  });

  it('shows password replacement message when sign in is blocked for password renewal', async () => {
    mockSignIn.mockRejectedValue(new Error('Password replacement required. Check your email to define a new password.'));
    renderSignIn();

    fireEvent.change(screen.getByPlaceholderText('auth.signIn.emailPlaceholder'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.signIn.passwordPlaceholder'), { target: { value: 'secret' } });
    fireEvent.submit(screen.getByRole('button', { name: 'auth.signIn.signInButton' }).closest('form') as HTMLFormElement);

    expect(await screen.findByText('Password replacement required. Check your email to define a new password.')).toBeInTheDocument();
  });

  it('switches to 2FA verification when required', async () => {
    mockSignIn.mockResolvedValue({ requires2FA: true, userId: 'user-42' });
    renderSignIn();

    fireEvent.change(screen.getByPlaceholderText('auth.signIn.emailPlaceholder'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.signIn.passwordPlaceholder'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'auth.signIn.signInButton' }));

    expect(await screen.findByTestId('two-factor-verify')).toHaveTextContent('2FA:john@example.com:user-42');
  });

  it('shows expired session toast from query params', async () => {
    mockSearchParams = new URLSearchParams('expired=true');
    renderSignIn();

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('auth.signIn.sessionExpired', expect.objectContaining({ icon: '!' }));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/signin', { replace: true });
  });

  it('shows registration success toast from query params', async () => {
    mockSearchParams = new URLSearchParams('success=registered_pending');
    renderSignIn();

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('auth.signIn.registeredPending', expect.objectContaining({ icon: 'OK' }));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/signin', { replace: true });
  });

  it('shows email verified toast from query params', async () => {
    mockSearchParams = new URLSearchParams('success=email_verified');
    renderSignIn();

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/signin', { replace: true });
  });

  it('shows active test registration success toast from query params', async () => {
    mockSearchParams = new URLSearchParams('success=registered_active_test');
    renderSignIn();

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/signin', { replace: true });
  });

  it('shows Google auth error from query params', async () => {
    mockSearchParams = new URLSearchParams('error=no_account&email=test@example.com');
    renderSignIn();

    expect(await screen.findByText('auth.signIn.googleNoAccount')).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('/signin', { replace: true });
  });

  it('shows email verification error from query params', async () => {
    mockSearchParams = new URLSearchParams('error=token_expired');
    renderSignIn();

    expect(await screen.findByText("Le lien de verification d'email est invalide ou expire.")).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('/signin', { replace: true });
  });

  it('shows pending approval message instead of navigating when user is pending', async () => {
    mockSignIn.mockResolvedValue({ id: '1', email: 'john@example.com', status: 'pending' });
    renderSignIn();

    fireEvent.change(screen.getByPlaceholderText('auth.signIn.emailPlaceholder'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.signIn.passwordPlaceholder'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'auth.signIn.signInButton' }));

    expect(await screen.findByText('auth.signIn.accountPending')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith('/');
  });

  it('shows Google auth failure when popup bootstrap fails', async () => {
    mockFetchWithCsrfRetry.mockRejectedValue(new Error('oauth down'));
    renderSignIn();

    fireEvent.click(screen.getByRole('button', { name: 'auth.signIn.signInWithGoogle' }));

    expect(await screen.findByText('auth.signIn.googleAuthFailed')).toBeInTheDocument();
  });

  it('shows email verification required message when backend blocks sign in', async () => {
    mockSignIn.mockRejectedValue(new Error('Email verification required. Check your inbox before signing in.'));
    renderSignIn();

    fireEvent.change(screen.getByPlaceholderText('auth.signIn.emailPlaceholder'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.signIn.passwordPlaceholder'), { target: { value: 'secret' } });
    fireEvent.submit(screen.getByRole('button', { name: 'auth.signIn.signInButton' }).closest('form') as HTMLFormElement);

    expect(await screen.findByText('Email verification required. Check your inbox before signing in.')).toBeInTheDocument();
  });

  it('shows firm assignment error when backend provides the code', async () => {
    const error = new Error("Ce compte n'est associe a aucun cabinet. Contactez un administrateur.") as Error & { code?: string };
    error.code = 'firm_assignment_required';
    mockSignIn.mockRejectedValue(error);
    renderSignIn();

    fireEvent.change(screen.getByPlaceholderText('auth.signIn.emailPlaceholder'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('auth.signIn.passwordPlaceholder'), { target: { value: 'secret' } });
    fireEvent.submit(screen.getByRole('button', { name: 'auth.signIn.signInButton' }).closest('form') as HTMLFormElement);

    expect(await screen.findByText("Ce compte n'est associe a aucun cabinet. Contactez un administrateur.")).toBeInTheDocument();
  });

  it('shows Google service unavailable error from query params', async () => {
    mockSearchParams = new URLSearchParams('error=service_unavailable');
    renderSignIn();

    expect(await screen.findByText("Le service d'authentification est temporairement indisponible. Reessayez dans quelques instants.")).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('/signin', { replace: true });
  });
});
