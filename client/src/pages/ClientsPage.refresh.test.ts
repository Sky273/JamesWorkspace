import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markViewScopesDirty } from '../utils/viewRefresh';
import { useClientsDashboard } from './ClientsPage.hooks';

const getClientsMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../utils/clientService', () => ({
  default: {
    getClients: (...args: unknown[]) => getClientsMock(...args),
    getClient: vi.fn(),
    createClient: vi.fn(),
    updateClient: vi.fn(),
    deleteClient: vi.fn(),
    createContact: vi.fn(),
    updateContact: vi.fn(),
    deleteContact: vi.fn(),
  },
}));

describe('useClientsDashboard refresh wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

    getClientsMock.mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Acme', type: 'client' }],
      pagination: { totalCount: 1, hasMore: false, page: 1, pageSize: 12 },
    });
  });

  it('forces a refresh on mount when the clients scope is already dirty', async () => {
    markViewScopesDirty(['clients']);

    renderHook(() => useClientsDashboard());

    await waitFor(() => {
      expect(getClientsMock).toHaveBeenCalledWith(expect.objectContaining({ forceRefresh: true }));
    });
  });

  it('forces a refresh when a runtime clients dirty event is emitted', async () => {
    renderHook(() => useClientsDashboard());

    await waitFor(() => {
      expect(getClientsMock).toHaveBeenCalled();
    });

    getClientsMock.mockClear();
    markViewScopesDirty(['clients']);

    await waitFor(() => {
      expect(getClientsMock).toHaveBeenCalledWith(expect.objectContaining({ forceRefresh: true }));
    });
  });
});
