import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const stableT = (key: string) => key;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
    i18n: {
      language: 'fr',
      changeLanguage: vi.fn(),
    },
  }),
}));

import InterviewsTab from './InterviewsTab';

const getUpcomingInterviewsMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('../../services/pipelineService', () => ({
  getUpcomingInterviews: (...args: unknown[]) => getUpcomingInterviewsMock(...args),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

describe('InterviewsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads scheduled interviews, shows them in the calendar, and supports refresh and month navigation', async () => {
    getUpcomingInterviewsMock.mockResolvedValue([
      {
        id: 'interview-1',
        pipeline_id: 'pipeline-1',
        title: 'Entretien produit',
        description: null,
        interview_type: 'client',
        scheduled_at: '2026-04-15T09:30:00.000Z',
        duration_minutes: 60,
        location: 'Visio',
        meeting_link: 'https://meet.example.com/1',
        attendees: [],
        calendar_event_id: null,
        calendar_provider: null,
        status: 'scheduled',
        outcome: null,
        outcome_notes: null,
        created_by: 'user-1',
        created_at: '2026-04-10T09:00:00.000Z',
        updated_at: '2026-04-10T09:00:00.000Z',
        resume_name: 'ADA',
        mission_title: 'Product Manager',
        client_name: 'Acme',
      },
      {
        id: 'interview-2',
        pipeline_id: 'pipeline-2',
        title: 'Entretien technique',
        description: null,
        interview_type: 'technical',
        scheduled_at: '2026-04-15T13:30:00.000Z',
        duration_minutes: 45,
        location: null,
        meeting_link: null,
        attendees: [],
        calendar_event_id: null,
        calendar_provider: null,
        status: 'scheduled',
        outcome: null,
        outcome_notes: null,
        created_by: 'user-1',
        created_at: '2026-04-10T09:00:00.000Z',
        updated_at: '2026-04-10T09:00:00.000Z',
        resume_name: 'SLA',
        mission_title: 'Product Manager',
        client_name: 'Acme',
      },
      {
        id: 'interview-3',
        pipeline_id: 'pipeline-3',
        title: 'Entretien annulé',
        description: null,
        interview_type: 'hr',
        scheduled_at: '2026-04-15T15:00:00.000Z',
        duration_minutes: 30,
        location: null,
        meeting_link: null,
        attendees: [],
        calendar_event_id: null,
        calendar_provider: null,
        status: 'cancelled',
        outcome: null,
        outcome_notes: null,
        created_by: 'user-1',
        created_at: '2026-04-10T09:00:00.000Z',
        updated_at: '2026-04-10T09:00:00.000Z',
        resume_name: 'IGNORED',
      },
    ]);

    render(<InterviewsTab />);

    await waitFor(() => {
      expect(screen.getByText('crm.interviews.title')).toBeInTheDocument();
    });

    expect(getUpcomingInterviewsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('crm.interviews.monthSummary')).toBeInTheDocument();
    expect(screen.getByText('ADA')).toBeInTheDocument();
    expect(screen.getByText('SLA')).toBeInTheDocument();

    const adaCalendarChip = screen.getAllByText('ADA')[0];
    const activeDayButton = adaCalendarChip.closest('button');
    expect(activeDayButton).not.toBeNull();
    fireEvent.click(activeDayButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByText('Entretien produit')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Product Manager').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Acme').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'crm.interviews.openMeeting' })).toHaveAttribute('href', 'https://meet.example.com/1');

    fireEvent.click(screen.getByRole('button', { name: 'crm.interviews.refresh' }));
    await waitFor(() => {
      expect(getUpcomingInterviewsMock).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'crm.interviews.nextMonth' }));
    await waitFor(() => {
      expect(getUpcomingInterviewsMock).toHaveBeenCalledTimes(3);
    });

    fireEvent.click(screen.getByRole('button', { name: 'crm.interviews.today' }));
    await waitFor(() => {
      expect(getUpcomingInterviewsMock).toHaveBeenCalledTimes(4);
    });
  });

  it('shows an error toast when loading interviews fails', async () => {
    getUpcomingInterviewsMock.mockRejectedValue(new Error('network'));

    render(<InterviewsTab />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('crm.interviews.loadError');
    });
  });

  it('shows the empty state when there are no upcoming interviews', async () => {
    getUpcomingInterviewsMock.mockResolvedValue([]);

    render(<InterviewsTab />);

    await waitFor(() => {
      expect(screen.getByText('crm.interviews.title')).toBeInTheDocument();
    });

    expect(screen.getByText('crm.interviews.monthSummary')).toBeInTheDocument();
    expect(screen.queryByText('ADA')).not.toBeInTheDocument();
  });
});
