import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DealDetailView from './DealDetailView';

const navigateMock = vi.fn();
const authGetMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../hooks/useAuthFetch', () => ({
  useAuthFetch: () => ({
    authGet: authGetMock,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('../../pages/ResumesPage.hooks', () => ({
  getResumePreviewTags: vi.fn((resume: Record<string, unknown>, category: string) => {
    const map: Record<string, string[]> = {
      Skills: ['React', 'Node'],
      Industries: ['Banque'],
      Tools: ['Jira'],
      'Soft Skills': ['Leadership'],
    };
    return map[category] || [];
  }),
}));

describe('DealDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'scrollY', { value: 320, writable: true, configurable: true });

    authGetMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'deal-1',
          title: 'Affaire test',
          notes: 'Une affaire de test',
          budget_min: '45000',
          budget_max: '70000',
          created_at: '2026-04-10T09:00:00Z',
          updated_at: '2026-04-11T09:00:00Z',
          status: 'open',
          priority: 'medium',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'mission-1',
            title: 'Product Manager',
            status: 'Active',
            client_name: 'Acme',
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'resume-1',
            Name: 'ADA',
            Title: 'Product Owner',
            Status: 'Improved',
            'Global Rating': '58',
            'Improved Global Rating': '65',
            'Created At': '2026-04-09T09:00:00Z',
            consent_status: 'granted',
          },
        ],
      });
  });

  it('loads deal details, displays budget, and navigates to the resume analysis with return context', async () => {
    render(<DealDetailView dealId="deal-1" onBack={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Affaire test')).toBeInTheDocument();
    });

    expect(screen.getByText(/45/i)).toBeInTheDocument();
    expect(screen.getByText('Une affaire de test')).toBeInTheDocument();
    expect(screen.getByText('ADA')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'resumes.view' }));

    expect(navigateMock).toHaveBeenCalledWith('/resumes/resume-1/analysis', {
      state: {
        from: 'dealDetailView',
        dealReturnContext: {
          dealId: 'deal-1',
          scrollY: 320,
        },
      },
    });
  });

  it('navigates to the mission detail from the associated missions section', async () => {
    render(<DealDetailView dealId="deal-1" onBack={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Product Manager')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'missions.view' }));

    expect(navigateMock).toHaveBeenCalledWith('/missions/mission-1');
  });

  it('shows the not found state when the deal request fails', async () => {
    authGetMock.mockReset();
    authGetMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    render(<DealDetailView dealId="deal-404" onBack={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('crm.deals.notFound')).toBeInTheDocument();
    });
    expect(toastErrorMock).toHaveBeenCalledWith('crm.deals.loadError');
  });
});
