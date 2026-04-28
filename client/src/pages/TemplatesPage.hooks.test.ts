import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { markViewScopesDirty } from '../utils/viewRefresh';
import { useTemplatesDashboard } from './TemplatesPage.hooks';

const {
  navigateMock,
  getTemplatesPaginatedMock,
  useLocationMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  getTemplatesPaginatedMock: vi.fn(),
  useLocationMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => useLocationMock(),
}));

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

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../utils/templateService', () => ({
  templateService: {
    getTemplatesPaginated: (...args: unknown[]) => getTemplatesPaginatedMock(...args),
  },
}));

describe('useTemplatesDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    useLocationMock.mockReturnValue({
      pathname: '/templates',
      search: '',
      state: null,
    });
    getTemplatesPaginatedMock.mockResolvedValue({
      templates: [
        {
          id: 'tpl-1',
          Name: 'Existing Template',
          Status: 'active',
        },
      ],
      pagination: {
        totalCount: 1,
        hasMore: false,
      },
    });
  });

  it('keeps a newly created template visible when returning to the list view', async () => {
    useLocationMock.mockReturnValue({
      pathname: '/templates',
      search: '',
      state: {
        createdTemplate: {
          id: 'tpl-new',
          Name: 'New Template',
          Status: 'active',
        },
      },
    });

    const { result } = renderHook(() => useTemplatesDashboard());

    await waitFor(() => {
      expect(result.current.filteredTemplates[0]?.id).toBe('tpl-new');
    });

    expect(navigateMock).toHaveBeenCalledWith('/templates', { replace: true, state: null });
  });

  it('forces a server refresh when the refresh action is used', async () => {
    const { result } = renderHook(() => useTemplatesDashboard());

    await waitFor(() => {
      expect(result.current.filteredTemplates).toHaveLength(1);
    });

    await result.current.refreshTemplates();

    expect(getTemplatesPaginatedMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ forceRefresh: true })
    );
  });

  it('keeps an updated template visible after a refresh with an active search term', async () => {
    useLocationMock.mockReturnValue({
      pathname: '/templates',
      search: '',
      state: {
        updatedTemplate: {
          id: 'tpl-updated',
          Name: 'Updated Template',
          Status: 'active',
        },
      },
    });

    getTemplatesPaginatedMock
      .mockResolvedValueOnce({
        templates: [
          {
            id: 'tpl-1',
            Name: 'Existing Template',
            Status: 'active',
          },
        ],
        pagination: {
          totalCount: 1,
          hasMore: false,
        },
      })
      .mockResolvedValueOnce({
        templates: [
          {
            id: 'tpl-1',
            Name: 'Existing Template',
            Status: 'active',
          },
        ],
        pagination: {
          totalCount: 1,
          hasMore: false,
        },
      });

    const { result } = renderHook(() => useTemplatesDashboard());

    await waitFor(() => {
      expect(result.current.filteredTemplates[0]?.id).toBe('tpl-updated');
    });

    result.current.setSearchTerm('Updated');

    await waitFor(() => {
      expect(getTemplatesPaginatedMock).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Updated' }),
      );
    });

    await result.current.refreshTemplates();

    await waitFor(() => {
      expect(result.current.filteredTemplates.some((template) => template.id === 'tpl-updated')).toBe(true);
    });
  });

  it('keeps the navigation updated template when the first list response still contains stale data', async () => {
    useLocationMock.mockReturnValue({
      pathname: '/admin',
      search: '?tab=templates',
      state: {
        updatedTemplate: {
          id: 'tpl-1',
          Name: 'Updated Template',
          Description: 'Fresh description',
          Status: 'active',
        },
      },
    });

    getTemplatesPaginatedMock.mockResolvedValue({
      templates: [
        {
          id: 'tpl-1',
          Name: 'Old Template',
          Description: 'Stale description',
          Status: 'active',
        },
      ],
      pagination: {
        totalCount: 1,
        hasMore: false,
      },
    });

    const { result } = renderHook(() => useTemplatesDashboard({ embedded: true }));

    await waitFor(() => {
      expect(result.current.filteredTemplates[0]).toEqual(expect.objectContaining({
        id: 'tpl-1',
        Name: 'Updated Template',
        Description: 'Fresh description',
      }));
    });
  });

  it('preserves the admin tab query string when clearing navigation state', async () => {
    useLocationMock.mockReturnValue({
      pathname: '/admin',
      search: '?tab=templates',
      state: {
        createdTemplate: {
          id: 'tpl-admin',
          Name: 'Admin Template',
          Status: 'active',
        },
      },
    });

    const { result } = renderHook(() => useTemplatesDashboard({ embedded: true }));

    await waitFor(() => {
      expect(result.current.filteredTemplates[0]?.id).toBe('tpl-admin');
    });

    expect(navigateMock).toHaveBeenCalledWith('/admin?tab=templates', { replace: true, state: null });
  });

  it('forces a refresh for the embedded admin templates tab when the templates scope is dirty', async () => {
    useLocationMock.mockReturnValue({
      pathname: '/admin',
      search: '?tab=templates',
      state: null,
    });
    markViewScopesDirty(['templates']);

    renderHook(() => useTemplatesDashboard({ embedded: true }));

    await waitFor(() => {
      expect(getTemplatesPaginatedMock).toHaveBeenCalledWith(
        expect.objectContaining({ forceRefresh: true }),
      );
    });
  });
});
