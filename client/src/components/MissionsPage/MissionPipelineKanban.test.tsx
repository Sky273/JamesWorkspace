import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MissionPipelineKanban from './MissionPipelineKanban';

const getStagesMock = vi.fn();
const getPipelineByMissionIdMock = vi.fn();
const fetchWithAuthMock = vi.fn();
const getAdaptationsByMissionMock = vi.fn();
const addToPipelineMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
  default: {
    success: vi.fn(),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('../../services/pipelineService', () => ({
  getStages: (...args: unknown[]) => getStagesMock(...args),
  getPipelineByMissionId: (...args: unknown[]) => getPipelineByMissionIdMock(...args),
  addToPipeline: (...args: unknown[]) => addToPipelineMock(...args),
  moveToStage: vi.fn(),
  removeFromPipeline: vi.fn(),
  updatePipelineNotes: vi.fn(),
  getInterviews: vi.fn(),
  scheduleInterview: vi.fn(),
  completeInterview: vi.fn(),
  cancelInterview: vi.fn(),
}));

vi.mock('../../utils/apiInterceptor', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock('../../utils/resumeAdaptationService', () => ({
  default: {
    getAdaptationsByMission: (...args: unknown[]) => getAdaptationsByMissionMock(...args),
  },
}));

describe('MissionPipelineKanban', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getStagesMock.mockResolvedValue([
      { id: 'new', label: 'Nouveau', labelEn: 'New', order: 1, color: '#2563eb' },
      { id: 'screening', label: 'Présélection', labelEn: 'Screening', order: 2, color: '#7c3aed' },
    ]);

    getPipelineByMissionIdMock.mockResolvedValue([
      {
        id: 'entry-1',
        resume_id: 'resume-2',
        mission_id: 'mission-1',
        client_id: null,
        stage: 'new',
        notes: '',
        created_by: 'user-1',
        created_at: '2026-04-10T09:00:00Z',
        updated_at: '2026-04-10T09:00:00Z',
        moved_at: '2026-04-10T09:00:00Z',
        resume_name: 'SLA',
        global_score: 77,
        tags: ['API'],
        interview_count: 0,
      },
    ]);

    getAdaptationsByMissionMock.mockResolvedValue([
      {
        id: 'adapt-1',
        resumeId: 'resume-1',
        missionId: 'mission-1',
        status: 'completed',
        'Adapted Title': 'Product Owner',
        'Match Score': 65,
      },
      {
        id: 'adapt-2',
        resumeId: 'resume-2',
        missionId: 'mission-1',
        status: 'completed',
        'Adapted Title': 'Analyste',
        'Match Score': 78,
      },
    ]);

    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'resume-1', Name: 'ADA', Title: 'PO', 'Global Score': 65, Tags: ['Product'] },
          { id: 'resume-2', Name: 'SLA', Title: 'Analyste', 'Global Score': 77, Tags: ['API'] },
          { id: 'resume-3', Name: 'AAL', Title: 'Data Engineer', 'Global Score': 50, Tags: ['Data'] },
        ],
      }),
    });
    addToPipelineMock.mockResolvedValue(undefined);
  });

  it('loads available candidates with mission adaptations first when opening the add modal', async () => {
    render(
      <MemoryRouter>
        <MissionPipelineKanban missionId="mission-1" missionTitle="Product Manager" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('pipeline.title')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'pipeline.addCandidate' }));

    await waitFor(() => {
      expect(screen.getAllByText('ADA').length).toBeGreaterThan(0);
      expect(screen.getByText('AAL')).toBeInTheDocument();
    });

    const candidateButtons = screen.getAllByRole('button').filter((button) =>
      ['ADA', 'AAL'].some((name) => button.textContent?.includes(name))
    );

    expect(candidateButtons[0].textContent).toContain('ADA');
    expect(screen.getAllByText('pipeline.adapted').length).toBeGreaterThan(0);
    expect(screen.getAllByText('pipeline.original').length).toBeGreaterThan(0);
  });
  it('shows the pipeline load error when the initial fetch fails', async () => {
    getStagesMock.mockRejectedValueOnce(new Error('load failed'));

    render(
      <MemoryRouter>
        <MissionPipelineKanban missionId="mission-1" missionTitle="Product Manager" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('pipeline.errors.loadFailed');
    });
  });

});
