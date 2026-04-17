import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResetPasswordPage from './ResetPasswordPage';

const { mockNavigate, mockResetPassword } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockResetPassword: vi.fn(),
}));

vi.mock('../services/authService', () => ({
  authService: {
    resetPassword: mockResetPassword,
  },
}));

vi.mock('../components/Footer', () => ({
  default: () => <div data-testid="footer" />,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderResetPasswordPage = (initialEntry = '/reset-password?token=test-token') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks confirmation as invalid when passwords do not match', async () => {
    renderResetPasswordPage();

    fireEvent.change(screen.getByLabelText('auth.resetPassword.newPasswordLabel'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('auth.resetPassword.confirmPasswordLabel'), { target: { value: 'different123' } });
    fireEvent.submit(screen.getByRole('button', { name: 'auth.resetPassword.submitButton' }).closest('form') as HTMLFormElement);

    expect(await screen.findByRole('alert')).toHaveTextContent('auth.resetPassword.passwordMismatch');
    expect(screen.getByLabelText('auth.resetPassword.confirmPasswordLabel')).toHaveAttribute('aria-invalid', 'true');
  });

  it('has no critical accessibility violations on the reset-password form', async () => {
    const { container } = renderResetPasswordPage();
    const results = await axe(container);

    expect(results.violations).toHaveLength(0);
  });
});
