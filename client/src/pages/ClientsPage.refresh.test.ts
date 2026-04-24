import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markViewScopesDirty } from '../utils/viewRefresh';
import { useClientsDashboard } from './ClientsPage.hooks';

const getClientsMock = vi.fn();
const createClientMock = vi.fn();
const updateClientMock = vi.fn();
const deleteClientMock = vi.fn();

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
    createClient: (...args: unknown[]) => createClientMock(...args),
    updateClient: (...args: unknown[]) => updateClientMock(...args),
    deleteClient: (...args: unknown[]) => deleteClientMock(...args),
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
    createClientMock.mockResolvedValue({ id: 'prospect-1', name: 'Prospect', type: 'prospect' });
    updateClientMock.mockResolvedValue({ id: 'client-1', name: 'Acme updated', type: 'client' });
    deleteClientMock.mockResolvedValue(undefined);
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

  it('keeps all client filters dirty after creating a client from the current filter', async () => {
    const { result } = renderHook(() => useClientsDashboard());

    await waitFor(() => {
      expect(getClientsMock).toHaveBeenCalled();
    });
    getClientsMock.mockClear();

    await result.current.handleClientSubmit({ name: 'Prospect', type: 'prospect' });

    expect(getClientsMock).toHaveBeenCalledWith(expect.objectContaining({
      forceRefresh: true,
      type: '',
    }));
    getClientsMock.mockClear();

    act(() => {
      result.current.setActiveTab('client');
    });

    await waitFor(() => {
      expect(getClientsMock).toHaveBeenCalledWith(expect.objectContaining({
        forceRefresh: true,
        type: 'client',
      }));
    });
    getClientsMock.mockClear();

    act(() => {
      result.current.setActiveTab('prospect');
    });

    await waitFor(() => {
      expect(getClientsMock).toHaveBeenCalledWith(expect.objectContaining({
        forceRefresh: true,
        type: 'prospect',
      }));
    });
  });

  it('keeps all client filters dirty after updating and deleting a client', async () => {
    const { result } = renderHook(() => useClientsDashboard());

    await waitFor(() => {
      expect(getClientsMock).toHaveBeenCalled();
    });
    getClientsMock.mockClear();

    act(() => {
      result.current.setSelectedClient({ id: 'client-1', name: 'Acme', type: 'client' });
    });

    await result.current.handleClientSubmit({ name: 'Acme updated', type: 'client' });

    expect(getClientsMock).toHaveBeenCalledWith(expect.objectContaining({
      forceRefresh: true,
      type: '',
    }));
    getClientsMock.mockClear();

    act(() => {
      result.current.setActiveTab('client');
    });

    await waitFor(() => {
      expect(getClientsMock).toHaveBeenCalledWith(expect.objectContaining({
        forceRefresh: true,
        type: 'client',
      }));
    });
    getClientsMock.mockClear();

    act(() => {
      result.current.setActiveTab('prospect');
    });

    await waitFor(() => {
      expect(getClientsMock).toHaveBeenCalledWith(expect.objectContaining({
        forceRefresh: true,
        type: 'prospect',
      }));
    });
    getClientsMock.mockClear();

    act(() => {
      result.current.setDeleteTarget({ id: 'client-1', name: 'Acme updated', type: 'client' });
    });

    await result.current.handleDelete();

    expect(getClientsMock).toHaveBeenCalledWith(expect.objectContaining({
      forceRefresh: true,
      type: 'prospect',
    }));
    getClientsMock.mockClear();

    act(() => {
      result.current.setActiveTab('all');
    });

    await waitFor(() => {
      expect(getClientsMock).toHaveBeenCalledWith(expect.objectContaining({
        forceRefresh: true,
        type: '',
      }));
    });
    getClientsMock.mockClear();

    act(() => {
      result.current.setActiveTab('client');
    });

    await waitFor(() => {
      expect(getClientsMock).toHaveBeenCalledWith(expect.objectContaining({
        forceRefresh: true,
        type: 'client',
      }));
    });
  });
});
