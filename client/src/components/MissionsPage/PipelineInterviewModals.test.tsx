import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  PipelineInterviewsListModal,
  PipelineScheduleInterviewModal,
} from './PipelineInterviewModals';
import type { InterviewFormValues } from './MissionPipelineKanban.types';
import type { Interview, PipelineEntry } from '../../services/pipelineService';

const baseEntry: PipelineEntry = {
  id: 'pipeline-1',
  resume_id: 'resume-1',
  mission_id: 'mission-1',
  client_id: 'client-1',
  stage: 'screening',
  notes: null,
  created_by: 'user-1',
  created_at: '2026-04-10T09:00:00.000Z',
  updated_at: '2026-04-10T09:00:00.000Z',
  moved_at: '2026-04-10T09:00:00.000Z',
  resume_name: 'ADA',
};

const baseInterview: Interview = {
  id: 'interview-1',
  pipeline_id: 'pipeline-1',
  title: 'Entretien client final',
  description: 'Valider le cadrage produit',
  interview_type: 'client',
  scheduled_at: '2026-04-15T09:30:00.000Z',
  duration_minutes: 60,
  location: 'Paris',
  meeting_link: 'https://meet.example.com/ada',
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
};

const emptyInterviewForm: InterviewFormValues = {
  title: '',
  description: '',
  interviewType: 'client',
  scheduledAt: '',
  durationMinutes: 60,
  location: '',
  meetingLink: '',
};

describe('PipelineInterviewsListModal', () => {
  it('renders interviews and forwards complete, cancel and schedule actions', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const onSchedule = vi.fn();
    const onClose = vi.fn();

    render(
      <PipelineInterviewsListModal
        entry={baseEntry}
        interviews={[
          baseInterview,
          {
            ...baseInterview,
            id: 'interview-2',
            status: 'completed',
            outcome: 'positive',
            outcome_notes: 'Très bon échange',
          },
        ]}
        loadingInterviews={false}
        isEnglish={false}
        onComplete={onComplete}
        onCancel={onCancel}
        onSchedule={onSchedule}
        onClose={onClose}
      />
    );

    expect(screen.getByText('pipeline.manageInterviews')).toBeInTheDocument();
    expect(screen.getByText('ADA')).toBeInTheDocument();
    expect(screen.getAllByText('Entretien client final')).toHaveLength(2);
    expect(screen.getAllByText('pipeline.joinMeeting')).toHaveLength(2);
    expect(screen.getByText('pipeline.outcomes.positive')).toBeInTheDocument();
    expect(screen.getByText('Très bon échange')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.complete' }));
    expect(onComplete).toHaveBeenCalledWith(baseInterview, 'positive');

    fireEvent.click(screen.getByRole('button', { name: 'pipeline.cancelInterview' }));
    expect(onCancel).toHaveBeenCalledWith(baseInterview);

    fireEvent.click(screen.getByRole('button', { name: 'pipeline.scheduleInterview' }));
    expect(onSchedule).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'common.close' })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the empty state when there are no interviews', () => {
    render(
      <PipelineInterviewsListModal
        entry={baseEntry}
        interviews={[]}
        loadingInterviews={false}
        isEnglish={false}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
        onSchedule={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('pipeline.noInterviews')).toBeInTheDocument();
  });
});

describe('PipelineScheduleInterviewModal', () => {
  it('keeps scheduling disabled until required fields are filled and propagates field updates', () => {
    const setNewInterview = vi.fn();
    const onSchedule = vi.fn();
    const onClose = vi.fn();

    const { container, rerender } = render(
      <PipelineScheduleInterviewModal
        isEnglish={false}
        newInterview={emptyInterviewForm}
        setNewInterview={setNewInterview}
        onSchedule={onSchedule}
        onClose={onClose}
      />
    );

    const scheduleButton = screen.getByRole('button', { name: 'pipeline.schedule' });
    expect(scheduleButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('pipeline.interviewTitlePlaceholder'), {
      target: { value: 'Entretien client' },
    });
    expect(setNewInterview).toHaveBeenCalledWith({
      ...emptyInterviewForm,
      title: 'Entretien client',
    });

    const scheduledAtInput = container.querySelector('input[type="datetime-local"]');
    expect(scheduledAtInput).not.toBeNull();

    fireEvent.change(scheduledAtInput as HTMLInputElement, {
      target: { value: '2026-04-21T14:00' },
    });
    expect(setNewInterview).toHaveBeenCalledWith({
      ...emptyInterviewForm,
      scheduledAt: '2026-04-21T14:00',
    });

    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'technical' },
    });
    expect(setNewInterview).toHaveBeenCalledWith({
      ...emptyInterviewForm,
      interviewType: 'technical',
    });

    rerender(
      <PipelineScheduleInterviewModal
        isEnglish={false}
        newInterview={{
          ...emptyInterviewForm,
          title: 'Entretien client',
          scheduledAt: '2026-04-21T14:00',
        }}
        setNewInterview={setNewInterview}
        onSchedule={onSchedule}
        onClose={onClose}
      />
    );

    expect(screen.getByRole('button', { name: 'pipeline.schedule' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'pipeline.schedule' }));
    expect(onSchedule).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
