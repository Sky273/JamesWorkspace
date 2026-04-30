import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DealDetailView from './DealDetailView';

const navigateMock = vi.fn();
const authDeleteMock = vi.fn();
const authGetMock = vi.fn();
const authPostMock = vi.fn();
const authPutMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../hooks/useAuthFetch', () => ({
  useAuthFetch: () => ({
    authDelete: authDeleteMock,
    authGet: authGetMock,
    authPost: authPostMock,
    authPut: authPutMock,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
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
            global_rating: 58,
            improved_global_rating: 65,
            'Created At': '2026-04-09T09:00:00Z',
            consent_status: 'granted',
          },
        ],
      });
  });

  it('loads deal details, displays budget, and navigates to the unified resume entry with return context', async () => {
    render(<DealDetailView dealId="deal-1" onBack={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Affaire test')).toBeInTheDocument();
    });

    expect(screen.getByText(/45/i)).toBeInTheDocument();
    expect(screen.getByText('Une affaire de test')).toBeInTheDocument();
    expect(screen.getByText('ADA')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'resumes.view' }));

    expect(navigateMock).toHaveBeenCalledWith('/resumes/resume-1', {
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

  it('adds an existing mission to the deal from the detail view', async () => {
    authGetMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'mission-1', title: 'Product Manager', deal_id: 'deal-1' },
            { id: 'mission-2', title: 'Tech Lead' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'mission-1', title: 'Product Manager', status: 'Active' },
          { id: 'mission-2', title: 'Tech Lead', status: 'Active' },
        ],
      });
    authPutMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'mission-2' }) });

    render(<DealDetailView dealId="deal-1" onBack={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Product Manager')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'crm.deals.addMission' }));

    await waitFor(() => {
      expect(screen.getByLabelText('crm.deals.selectMission')).toBeInTheDocument();
    });

    expect(screen.queryByRole('option', { name: 'Product Manager' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('crm.deals.selectMission'), {
      target: { value: 'mission-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'crm.deals.addMissionConfirm' }));

    await waitFor(() => {
      expect(authPutMock).toHaveBeenCalledWith('/api/missions/mission-2', { dealId: 'deal-1' });
    });
    expect(authGetMock).toHaveBeenLastCalledWith('/api/deals/deal-1/missions?refresh=1');
    expect(await screen.findByText('Tech Lead')).toBeInTheDocument();
    expect(toastSuccessMock).toHaveBeenCalledWith('crm.deals.missionAdded');
  });

  it('removes a mission association from the deal detail view', async () => {
    authPutMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'mission-1' }) });
    authGetMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<DealDetailView dealId="deal-1" onBack={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Product Manager')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'crm.deals.removeMissionFromDeal' }));

    await waitFor(() => {
      expect(authPutMock).toHaveBeenCalledWith('/api/missions/mission-1', { dealId: null });
    });
    expect(authGetMock).toHaveBeenLastCalledWith('/api/deals/deal-1/missions?refresh=1');
    expect(await screen.findByText('crm.deals.noAssociatedMissions')).toBeInTheDocument();
    expect(toastSuccessMock).toHaveBeenCalledWith('crm.deals.missionRemoved');
  });

  it('adds an existing resume to the deal from the detail view', async () => {
    authGetMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'resume-1', Name: 'ADA', Title: 'Product Owner' },
            { id: 'resume-2', Name: 'HJE', Title: 'Chef de projet' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'resume-1', Name: 'ADA', Title: 'Product Owner' },
          { id: 'resume-2', Name: 'HJE', Title: 'Chef de projet' },
        ],
      });
    authPostMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'resume-2' }) });

    render(<DealDetailView dealId="deal-1" onBack={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('ADA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'crm.deals.addResume' }));

    await waitFor(() => {
      expect(screen.getByLabelText('crm.deals.selectResume')).toBeInTheDocument();
    });

    expect(screen.queryByRole('option', { name: 'ADA - Product Owner' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('crm.deals.selectResume'), {
      target: { value: 'resume-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'crm.deals.addResumeConfirm' }));

    await waitFor(() => {
      expect(authPostMock).toHaveBeenCalledWith('/api/deals/deal-1/resumes', { resumeId: 'resume-2' });
    });
    expect(authGetMock).toHaveBeenLastCalledWith('/api/deals/deal-1/resumes?refresh=1');
    expect(await screen.findByText('HJE')).toBeInTheDocument();
    expect(toastSuccessMock).toHaveBeenCalledWith('crm.deals.resumeAdded');
  });

  it('removes a resume association from the deal detail view', async () => {
    authDeleteMock.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
    authGetMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<DealDetailView dealId="deal-1" onBack={vi.fn()} onEdit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('ADA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'crm.deals.removeResumeFromDeal' }));

    await waitFor(() => {
      expect(authDeleteMock).toHaveBeenCalledWith('/api/deals/deal-1/resumes/resume-1');
    });
    expect(authGetMock).toHaveBeenLastCalledWith('/api/deals/deal-1/resumes?refresh=1');
    expect(await screen.findByText('crm.deals.noAssociatedResumes')).toBeInTheDocument();
    expect(toastSuccessMock).toHaveBeenCalledWith('crm.deals.resumeRemoved');
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
