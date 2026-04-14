import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markViewScopesDirty } from '../utils/viewRefresh';
import { useUsersManagementDashboard } from './UsersManagement.hooks';

const useAuthMock = vi.fn();
const getCustomersPaginatedMock = vi.fn();
const getUsersPaginatedMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../utils/userService', () => ({
  default: {
    getCustomersPaginated: (...args: unknown[]) => getCustomersPaginatedMock(...args),
    getUsersPaginated: (...args: unknown[]) => getUsersPaginatedMock(...args),
  },
}));

describe('useUsersManagementDashboard refresh wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

    getUsersPaginatedMock.mockResolvedValue({
      users: [],
      pagination: { totalCount: 0, hasMore: false, page: 1, pageSize: 12 },
    });
    getCustomersPaginatedMock.mockResolvedValue({
      customers: [],
      pagination: { totalCount: 0, hasMore: false, page: 1, pageSize: 12 },
    });
  });

  it('forces a users refresh for the embedded admin users tab when the users scope is dirty', async () => {
    useAuthMock.mockReturnValue({
      user: { role: 'localAdmin', firmId: 'firm-1', firmName: 'Acme' },
    });
    markViewScopesDirty(['users']);

    renderHook(() => useUsersManagementDashboard({ embedded: true, forcedTab: 'users' }));

    await waitFor(() => {
      expect(getUsersPaginatedMock).toHaveBeenCalledWith(
        expect.objectContaining({ forceRefresh: true }),
      );
    });
  });

  it('forces a firms refresh for the embedded admin firms tab when the firms scope is dirty', async () => {
    useAuthMock.mockReturnValue({
      user: { role: 'admin', firmId: 'firm-1', firmName: 'Acme' },
    });
    markViewScopesDirty(['firms']);

    renderHook(() => useUsersManagementDashboard({ embedded: true, forcedTab: 'firms' }));

    await waitFor(() => {
      expect(getCustomersPaginatedMock).toHaveBeenCalledWith(
        expect.objectContaining({ forceRefresh: true }),
      );
    });
  });
});
