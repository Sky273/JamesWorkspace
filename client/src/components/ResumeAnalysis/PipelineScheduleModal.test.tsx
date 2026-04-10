import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import PipelineScheduleModal from './PipelineScheduleModal';

describe('PipelineScheduleModal', () => {
  it('updates interview fields and forwards schedule/close actions', () => {
    const setNewInterview = vi.fn();
    const onSchedule = vi.fn();
    const onClose = vi.fn();

    render(
      <PipelineScheduleModal
        newInterview={{
          title: '',
          description: '',
          interviewType: 'client',
          scheduledAt: '',
          durationMinutes: 60,
          location: '',
          meetingLink: '',
          attendees: [],
        }}
        setNewInterview={setNewInterview}
        onSchedule={onSchedule}
        onClose={onClose}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('pipeline.interviewTitlePlaceholder'), {
      target: { value: 'Entretien client' },
    });
    expect(setNewInterview).toHaveBeenCalledWith(expect.objectContaining({ title: 'Entretien client' }));

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'technical' } });
    expect(setNewInterview).toHaveBeenCalledWith(expect.objectContaining({ interviewType: 'technical' }));

    fireEvent.click(screen.getByRole('button', { name: 'pipeline.schedule' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

    expect(onSchedule).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
