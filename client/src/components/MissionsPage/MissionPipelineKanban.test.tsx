import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MissionPipelineKanban from './MissionPipelineKanban';

const getStagesMock = vi.fn();
const getPipelineByMissionIdMock = vi.fn();
const fetchWithAuthMock = vi.fn();
const getAdaptationsByMissionMock = vi.fn();
const addToPipelineMock = vi.fn();
const removeFromPipelineMock = vi.fn();
const getInterviewsMock = vi.fn();
const scheduleInterviewMock = vi.fn();
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
  removeFromPipeline: (...args: unknown[]) => removeFromPipelineMock(...args),
  updatePipelineNotes: vi.fn(),
  getInterviews: (...args: unknown[]) => getInterviewsMock(...args),
  scheduleInterview: (...args: unknown[]) => scheduleInterviewMock(...args),
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
    removeFromPipelineMock.mockResolvedValue(undefined);
    getInterviewsMock.mockResolvedValue([]);
    scheduleInterviewMock.mockResolvedValue({
      id: 'interview-1',
      pipeline_id: 'entry-1',
      title: 'Entretien client',
      description: null,
      interview_type: 'client',
      scheduled_at: '2026-05-04T16:00:00Z',
      duration_minutes: 60,
      location: null,
      meeting_link: null,
      attendees: [],
      calendar_event_id: null,
      calendar_provider: null,
      status: 'scheduled',
      outcome: null,
      outcome_notes: null,
      created_by: 'user-1',
      created_at: '2026-05-01T10:00:00Z',
      updated_at: '2026-05-01T10:00:00Z',
    });
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

  it('adds a mission adaptation to the pipeline with adaptationId preserved', async () => {
    render(
      <MemoryRouter>
        <MissionPipelineKanban missionId="mission-1" missionTitle="Product Manager" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('pipeline.title')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'pipeline.addCandidate' }));

    const adaAdaptedCandidateButton = await waitFor(() => {
      const button = screen.getAllByRole('button').find(
        (candidateButton) =>
          candidateButton.textContent?.includes('ADA') &&
          candidateButton.textContent?.includes('pipeline.adapted')
      );

      expect(button).toBeTruthy();
      return button!;
    });

    fireEvent.click(adaAdaptedCandidateButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'pipeline.add' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'pipeline.add' }));

    await waitFor(() => {
      expect(addToPipelineMock).toHaveBeenCalledWith(expect.objectContaining({
        resumeId: 'resume-1',
        adaptationId: 'adapt-1',
        missionId: 'mission-1'
      }));
    });
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

  it('renders adaptation links in the pipeline cards when an adapted CV is already in the pipeline', async () => {
    getPipelineByMissionIdMock.mockResolvedValueOnce([
      {
        id: 'entry-2',
        resume_id: 'resume-1',
        adaptation_id: 'adapt-1',
        mission_id: 'mission-1',
        client_id: null,
        stage: 'new',
        notes: 'Adaptation sélectionnée',
        created_by: 'user-1',
        created_at: '2026-04-10T09:00:00Z',
        updated_at: '2026-04-10T09:00:00Z',
        moved_at: '2026-04-10T09:00:00Z',
        resume_name: 'ADA',
        global_score: 65,
        tags: ['Product'],
        interview_count: 0,
      },
    ]);

    render(
      <MemoryRouter>
        <MissionPipelineKanban missionId="mission-1" missionTitle="Product Manager" />
      </MemoryRouter>
    );

    const adaptedLink = await screen.findByRole('link', { name: 'ADA' });
    expect(adaptedLink).toHaveAttribute('href', '/adaptations/adapt-1');
  });

  it('shows a visible remove action on pipeline cards', async () => {
    render(
      <MemoryRouter>
        <MissionPipelineKanban missionId="mission-1" missionTitle="Product Manager" />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: 'pipeline.remove' })).toBeInTheDocument();
  });

  it('refreshes the interviews modal with a forced read after scheduling an interview', async () => {
    getInterviewsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'interview-1',
          pipeline_id: 'entry-1',
          title: 'Entretien client',
          description: 'Brief',
          interview_type: 'client',
          scheduled_at: '2026-05-04T16:00:00Z',
          duration_minutes: 60,
          location: 'Google Meet',
          meeting_link: null,
          attendees: [],
          calendar_event_id: null,
          calendar_provider: null,
          status: 'scheduled',
          outcome: null,
          outcome_notes: null,
          created_by: 'user-1',
          created_at: '2026-05-01T10:00:00Z',
          updated_at: '2026-05-01T10:00:00Z',
        },
      ]);

    render(
      <MemoryRouter>
        <MissionPipelineKanban missionId="mission-1" missionTitle="Product Manager" />
      </MemoryRouter>
    );

    const manageButtons = await screen.findAllByRole('button', { name: 'pipeline.manageInterviews' });
    fireEvent.click(manageButtons[0]);

    await waitFor(() => {
      expect(getInterviewsMock).toHaveBeenCalledWith('entry-1', { forceRefresh: true });
    });

    const interviewsModal = (await screen.findByRole('heading', { name: 'pipeline.manageInterviews' }))
      .closest('.cv-surface');
    expect(interviewsModal).toBeTruthy();
    fireEvent.click(within(interviewsModal as HTMLElement).getByRole('button', { name: 'pipeline.scheduleInterview' }));

    fireEvent.change(await screen.findByPlaceholderText('pipeline.interviewTitlePlaceholder'), {
      target: { value: 'Entretien client' },
    });
    const inputs = Array.from(document.querySelectorAll('input'));
    const scheduledAtInput = inputs.find((input) => input.type === 'datetime-local') ?? inputs[1];
    expect(scheduledAtInput).toBeTruthy();
    fireEvent.change(scheduledAtInput!, {
      target: { value: '2026-05-04T16:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'pipeline.schedule' }));

    await waitFor(() => {
      expect(scheduleInterviewMock).toHaveBeenCalledWith('entry-1', expect.objectContaining({
        title: 'Entretien client',
        scheduledAt: '2026-05-04T16:00',
      }));
      expect(getInterviewsMock).toHaveBeenLastCalledWith('entry-1', { forceRefresh: true });
      expect(screen.getAllByText('Entretien client').length).toBeGreaterThan(0);
    });
  });
});
