import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TwoFactorVerify from './TwoFactorVerify';

const {
  mockSignIn,
  mockToastLoading,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockToastLoading: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('../services/authService', () => ({
  authService: {
    signIn: (...args: unknown[]) => mockSignIn(...args),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    loading: mockToastLoading,
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

const defaultProps = {
  userId: 'u1',
  email: 'john@example.com',
  password: 'secret',
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

describe('TwoFactorVerify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps verify disabled for short codes', () => {
    render(<TwoFactorVerify {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123' } });

    expect(screen.getByRole('button', { name: 'Vérifier' })).toBeDisabled();
  });

  it('verifies the code and calls onSuccess on success', async () => {
    mockSignIn.mockResolvedValue({ id: 'user-1', email: 'john@example.com' });
    const onSuccess = vi.fn();
    render(<TwoFactorVerify {...defaultProps} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier' }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('john@example.com', 'secret', '123456');
    });
    expect(mockToastSuccess).toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 550));
    expect(onSuccess).toHaveBeenCalledWith({ id: 'user-1', email: 'john@example.com' });
  }, 7000);

  it('shows the service error when verification fails', async () => {
    mockSignIn.mockRejectedValue(new Error('Code invalide'));
    render(<TwoFactorVerify {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.keyDown(screen.getByPlaceholderText('000000'), { key: 'Enter' });

    expect(await screen.findByText('Code invalide')).toBeInTheDocument();
    expect(mockToastError).toHaveBeenCalledWith('Code invalide', { id: '2fa-verify' });
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<TwoFactorVerify {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
