import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UsersManagement from './UsersManagement';

const useAuthMock = vi.fn();
const getCustomersPaginatedMock = vi.fn();
const getUsersPaginatedMock = vi.fn();
const createUserMock = vi.fn();
const createCustomerMock = vi.fn();
const updateCustomerMock = vi.fn();
const deleteCustomerMock = vi.fn();
const deleteUserMock = vi.fn();
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

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
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
    deleteUser: (...args: unknown[]) => deleteUserMock(...args),
    forcePasswordReset: (...args: unknown[]) => forcePasswordResetMock(...args),
    updateCustomer: (...args: unknown[]) => updateCustomerMock(...args),
    createCustomer: (...args: unknown[]) => createCustomerMock(...args),
    uploadFirmLogo: vi.fn(),
    deleteCustomer: (...args: unknown[]) => deleteCustomerMock(...args),
  },
}));

vi.mock('../components/UsersManagement/ConfirmDeleteModal', () => ({
  default: ({
    isOpen,
    onConfirm,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
  }) => (
    isOpen ? (
      <button onClick={() => void onConfirm()}>
        confirm-delete-modal
      </button>
    ) : null
  ),
}));

vi.mock('../components/UsersManagement/FirmFormModal', () => ({
  default: ({
    isOpen,
    firm,
    onSubmit,
  }: {
    isOpen: boolean;
    firm?: { id?: string; name?: string } | null;
    onSubmit: (data: { name: string; logoFile?: File | null }) => void;
  }) => (
    isOpen ? (
      <button onClick={() => onSubmit({ name: firm ? 'Renamed Cabinet' : 'New Cabinet', logoFile: null })}>
        submit-firm-modal
      </button>
    ) : null
  ),
}));

vi.mock('../components/UsersManagement/PasswordModal', () => ({
  default: () => null,
}));

vi.mock('../components/UsersManagement/UserFormModal', () => ({
  default: ({
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
          role: 'localAdmin',
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
    useAuthMock.mockReturnValue({
      user: {
        role: 'admin',
        firmId: 'firm-1',
        firmName: 'Acme',
      },
    });

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
      role: 'localAdmin',
      status: 'Active',
    });
    createCustomerMock.mockResolvedValue({
      id: 'firm-3',
      name: 'New Cabinet',
    });
    updateCustomerMock.mockResolvedValue({
      id: 'firm-1',
      name: 'Renamed Cabinet',
    });
    deleteCustomerMock.mockResolvedValue({ message: 'Firm deleted successfully' });
    deleteUserMock.mockResolvedValue({ message: 'User deleted successfully' });
  });

  it('loads the dashboard and creates a user through the page flow', async () => {
    getUsersPaginatedMock
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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
        role: 'localAdmin',
        status: 'Active',
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('users.management.messages.userCreatedInvitationSent');
    expect(await screen.findByText('Lookman')).toBeInTheDocument();
    expect(getUsersPaginatedMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(getCustomersPaginatedMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('hides firms management for local admins and avoids loading firms list', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'localAdmin',
        firmId: 'firm-1',
        firmName: 'Acme',
      },
    });

    render(<UsersManagement />);

    expect(await screen.findByText('users.management.title')).toBeInTheDocument();

    await waitFor(() => {
      expect(getUsersPaginatedMock).toHaveBeenCalled();
    });

    expect(getCustomersPaginatedMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /users\.management\.tabs\.firms/i })).not.toBeInTheDocument();
  });

  it('does not refetch indefinitely for local admins', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'localAdmin',
        firmId: 'firm-1',
        firmName: 'Acme',
      },
    });

    render(<UsersManagement />);

    expect(await screen.findByText('users.management.title')).toBeInTheDocument();

    await waitFor(() => {
      expect(getUsersPaginatedMock).toHaveBeenCalledTimes(1);
    });
  });

  it('supports local admins when the session exposes the legacy firm_id field', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'localAdmin',
        firm_id: 'firm-1',
        firmName: 'Acme',
      },
    });

    render(<UsersManagement />);

    expect(await screen.findByText('users.management.title')).toBeInTheDocument();

    await waitFor(() => {
      expect(getUsersPaginatedMock).toHaveBeenCalledTimes(1);
    });

    expect(getCustomersPaginatedMock).not.toHaveBeenCalled();
  });

  it('refreshes the firms view after creating a firm', async () => {
    const refreshedFirmsResponse = {
      customers: [
        { id: 'firm-1', name: 'Acme' },
        { id: 'firm-2', name: 'Globex' },
      ],
      pagination: { totalCount: 3, hasMore: false, page: 1, pageSize: 12 },
    };

    getCustomersPaginatedMock
      .mockResolvedValueOnce({
        customers: [
          { id: 'firm-1', name: 'Acme' },
          { id: 'firm-2', name: 'Globex' },
        ],
        pagination: { totalCount: 2, hasMore: false, page: 1, pageSize: 12 },
      })
      .mockResolvedValueOnce(refreshedFirmsResponse)
      .mockResolvedValue(refreshedFirmsResponse);

    render(<UsersManagement />);

    fireEvent.click(await screen.findByRole('button', { name: /users\.management\.tabs\.firms/i }));
    fireEvent.click(screen.getByRole('button', { name: /users\.management\.addFirm/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-firm-modal' }));

    await waitFor(() => {
      expect(createCustomerMock).toHaveBeenCalledWith({ name: 'New Cabinet' });
    });

    await waitFor(() => {
      expect(screen.getByText('New Cabinet')).toBeInTheDocument();
    });

    expect(getCustomersPaginatedMock.mock.calls.some(([args]) => (
      typeof args === 'object'
      && args !== null
      && 'forceRefresh' in (args as Record<string, unknown>)
      && (args as Record<string, unknown>).forceRefresh === true
      && (args as Record<string, unknown>).page === 1
    ))).toBe(true);
  });

  it('refreshes the firms view after updating a firm', async () => {
    const refreshedFirmsResponse = {
      customers: [
        { id: 'firm-1', name: 'Renamed Cabinet' },
        { id: 'firm-2', name: 'Globex' },
      ],
      pagination: { totalCount: 2, hasMore: false, page: 1, pageSize: 12 },
    };

    getCustomersPaginatedMock
      .mockResolvedValueOnce({
        customers: [
          { id: 'firm-1', name: 'Acme' },
          { id: 'firm-2', name: 'Globex' },
        ],
        pagination: { totalCount: 2, hasMore: false, page: 1, pageSize: 12 },
      })
      .mockResolvedValueOnce(refreshedFirmsResponse)
      .mockResolvedValue(refreshedFirmsResponse);

    render(<UsersManagement />);

    fireEvent.click(await screen.findByRole('button', { name: /users\.management\.tabs\.firms/i }));
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /users\.management\.actions\.edit/i })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'submit-firm-modal' }));

    await waitFor(() => {
      expect(updateCustomerMock).toHaveBeenCalledWith('firm-1', { name: 'Renamed Cabinet' });
    });

    await waitFor(() => {
      expect(screen.getByText('Renamed Cabinet')).toBeInTheDocument();
    });

    expect(getCustomersPaginatedMock.mock.calls.some(([args]) => (
      typeof args === 'object'
      && args !== null
      && 'forceRefresh' in (args as Record<string, unknown>)
      && (args as Record<string, unknown>).forceRefresh === true
    ))).toBe(true);
  });

  it('refreshes the firms view after deleting a firm', async () => {
    const refreshedFirmsResponse = {
      customers: [
        { id: 'firm-2', name: 'Globex' },
      ],
      pagination: { totalCount: 1, hasMore: false, page: 1, pageSize: 12 },
    };

    getCustomersPaginatedMock
      .mockResolvedValueOnce({
        customers: [
          { id: 'firm-1', name: 'Acme' },
          { id: 'firm-2', name: 'Globex' },
        ],
        pagination: { totalCount: 2, hasMore: false, page: 1, pageSize: 12 },
      })
      .mockResolvedValueOnce(refreshedFirmsResponse)
      .mockResolvedValue(refreshedFirmsResponse);

    render(<UsersManagement />);

    fireEvent.click(await screen.findByRole('button', { name: /users\.management\.tabs\.firms/i }));
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /users\.management\.actions\.delete/i })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'confirm-delete-modal' }));

    await waitFor(() => {
      expect(deleteCustomerMock).toHaveBeenCalledWith('firm-1');
    });

    await waitFor(() => {
      expect(screen.queryByText('Acme')).not.toBeInTheDocument();
    });

    expect(getCustomersPaginatedMock.mock.calls.some(([args]) => (
      typeof args === 'object'
      && args !== null
      && 'forceRefresh' in (args as Record<string, unknown>)
      && (args as Record<string, unknown>).forceRefresh === true
    ))).toBe(true);
  });

  it('removes a deleted user from the visible list immediately', async () => {
    getUsersPaginatedMock
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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

    render(<UsersManagement />);

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /users\.management\.actions\.delete/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'confirm-delete-modal' }));

    await waitFor(() => {
      expect(deleteUserMock).toHaveBeenCalledWith('user-1');
    });

    await waitFor(() => {
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    });
  });
});
