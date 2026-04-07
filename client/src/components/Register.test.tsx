import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';

const {
  mockRegister,
  mockNavigate,
  mockFetchWithCsrfRetry,
} = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockNavigate: vi.fn(),
  mockFetchWithCsrfRetry: vi.fn(),
}));

let mockSearchParams = new URLSearchParams();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ register: mockRegister }),
}));

vi.mock('../utils/apiInterceptor', () => ({
  fetchWithCsrfRetry: mockFetchWithCsrfRetry,
}));

vi.mock('../utils/logger.frontend', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('./Footer', () => ({
  default: () => <div data-testid="footer" />,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  };
});

const renderRegister = () => render(
  <MemoryRouter>
    <Register />
  </MemoryRouter>
);

describe('Register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockFetchWithCsrfRetry.mockResolvedValue({
      json: async () => ({ authUrl: 'https://accounts.google.com/oauth' }),
    });
  });

  it('renders registration fields and actions', () => {
    renderRegister();

    expect(screen.getByPlaceholderText('auth.register.namePlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('auth.register.emailPlaceholder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth.register.registerButton' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth.register.registerWithGoogle' })).toBeInTheDocument();
  });

  it('localizes the password visibility toggles', () => {
    renderRegister();

    expect(screen.getByRole('button', { name: 'auth.togglePassword.show' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth.togglePassword.showConfirmation' })).toBeInTheDocument();
  });

  it('exposes programmatic labels for registration fields', () => {
    renderRegister();

    expect(screen.getByLabelText('auth.register.nameLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.register.emailLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.register.passwordLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.register.confirmPasswordLabel')).toBeInTheDocument();
  });

  it('shows Google registration error from query params', async () => {
    mockSearchParams = new URLSearchParams('error=registration_failed');
    renderRegister();

    expect(await screen.findByText('auth.register.googleRegistrationFailed')).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('/register', { replace: true });
  });

  it('validates required fields and password rules', async () => {
    renderRegister();

    fireEvent.submit(screen.getByRole('button', { name: 'auth.register.registerButton' }).closest('form') as HTMLFormElement);
    expect(await screen.findByText('errors.required')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('auth.register.namePlaceholder'), { target: { value: 'Test', name: 'name' } });
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), { target: { value: 'test@test.com', name: 'email' } });
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), { target: { value: 'short', name: 'password' } });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPasswordPlaceholder'), { target: { value: 'short', name: 'confirmPassword' } });
    fireEvent.click(screen.getByRole('button', { name: 'auth.register.registerButton' }));
    expect(await screen.findByText('errors.passwordLength')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), { target: { value: 'password123', name: 'password' } });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPasswordPlaceholder'), { target: { value: 'different123', name: 'confirmPassword' } });
    fireEvent.click(screen.getByRole('button', { name: 'auth.register.registerButton' }));
    expect(await screen.findByText('errors.passwordMismatch')).toBeInTheDocument();
  });

  it('submits normalized email and navigates to signin on success', async () => {
    mockRegister.mockResolvedValue({ success: true });
    renderRegister();

    fireEvent.change(screen.getByPlaceholderText('auth.register.namePlaceholder'), { target: { value: 'John Doe', name: 'name' } });
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), { target: { value: 'John@Example.COM', name: 'email' } });
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), { target: { value: 'password123', name: 'password' } });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPasswordPlaceholder'), { target: { value: 'password123', name: 'confirmPassword' } });
    fireEvent.click(screen.getByRole('button', { name: 'auth.register.registerButton' }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith('/signin?success=registered_pending');
  });

  it('shows backend error when register fails', async () => {
    mockRegister.mockRejectedValue(new Error('Email déjà utilisé'));
    renderRegister();

    fireEvent.change(screen.getByPlaceholderText('auth.register.namePlaceholder'), { target: { value: 'John Doe', name: 'name' } });
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), { target: { value: 'john@example.com', name: 'email' } });
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordPlaceholder'), { target: { value: 'password123', name: 'password' } });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPasswordPlaceholder'), { target: { value: 'password123', name: 'confirmPassword' } });
    fireEvent.click(screen.getByRole('button', { name: 'auth.register.registerButton' }));

    expect(await screen.findByText('Email déjà utilisé')).toBeInTheDocument();
  });

  it('shows Google auth bootstrap failure when authUrl is missing', async () => {
    mockFetchWithCsrfRetry.mockResolvedValue({ json: async () => ({}) });
    renderRegister();

    fireEvent.click(screen.getByRole('button', { name: 'auth.register.registerWithGoogle' }));

    expect(await screen.findByText('auth.register.googleRegistrationFailed')).toBeInTheDocument();
  });

  it('shows Google auth bootstrap failure on exception', async () => {
    mockFetchWithCsrfRetry.mockRejectedValue(new Error('oauth error'));
    renderRegister();

    fireEvent.click(screen.getByRole('button', { name: 'auth.register.registerWithGoogle' }));

    expect(await screen.findByText('auth.register.googleRegistrationFailed')).toBeInTheDocument();
  });
});
