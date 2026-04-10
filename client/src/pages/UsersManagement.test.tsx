import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UsersManagement from './UsersManagement';

const getCustomersPaginatedMock = vi.fn();
const getUsersPaginatedMock = vi.fn();
const createUserMock = vi.fn();
const forcePasswordResetMock = vi.fn();
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

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../utils/userService', () => ({
  default: {
    getCustomersPaginated: (...args: unknown[]) => getCustomersPaginatedMock(...args),
    getUsersPaginated: (...args: unknown[]) => getUsersPaginatedMock(...args),
    createUser: (...args: unknown[]) => createUserMock(...args),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    forcePasswordReset: (...args: unknown[]) => forcePasswordResetMock(...args),
    updateCustomer: vi.fn(),
    createCustomer: vi.fn(),
    uploadFirmLogo: vi.fn(),
    deleteCustomer: vi.fn(),
  },
}));

vi.mock('../components/UsersManagement', () => ({
  ConfirmDeleteModal: () => null,
  FirmFormModal: () => null,
  PasswordModal: () => null,
  UserFormModal: ({
    isOpen,
    onSubmit,
  }: {
    isOpen: boolean;
    onSubmit: (data: {
      name: string;
      email: string;
      jobTitle: string;
      phone: string;
      firmId: string;
      role: string;
      status: string;
    }) => void;
  }) => (
    isOpen ? (
      <button
        onClick={() => onSubmit({
          name: 'Lookman',
          email: 'lookman@yopmail.com',
          jobTitle: '',
          phone: '',
          firmId: 'firm-1',
          role: 'admin',
          status: 'Active',
        })}
      >
        submit-user-modal
      </button>
    ) : null
  ),
}));

describe('UsersManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getCustomersPaginatedMock.mockResolvedValue({
      customers: [
        { id: 'firm-1', name: 'Acme' },
        { id: 'firm-2', name: 'Globex' },
      ],
      pagination: { totalCount: 2, hasMore: false, page: 1, pageSize: 12 },
    });

    getUsersPaginatedMock.mockResolvedValue({
      users: [
        {
          id: 'user-1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          firmId: 'firm-2',
          firmName: 'Globex',
          role: 'user',
          status: 'active',
        },
      ],
      pagination: { totalCount: 1, hasMore: false, page: 1, pageSize: 12 },
    });

    createUserMock.mockResolvedValue({
      id: 'user-2',
      name: 'Lookman',
      email: 'lookman@yopmail.com',
      role: 'Admin',
      status: 'Active',
    });
  });

  it('loads the dashboard and creates a user through the page flow', async () => {
    render(<UsersManagement />);

    expect(await screen.findByText('users.management.title')).toBeInTheDocument();
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /users\.management\.addUser/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-user-modal' }));

    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith({
        name: 'Lookman',
        email: 'lookman@yopmail.com',
        jobTitle: '',
        phone: '',
        firmId: 'firm-1',
        role: 'Admin',
        status: 'Active',
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('users.management.messages.userCreatedInvitationSent');
    expect(getUsersPaginatedMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(getCustomersPaginatedMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
