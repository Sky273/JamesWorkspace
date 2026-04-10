import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import PipelineCompleteModal from './PipelineCompleteModal';

describe('PipelineCompleteModal', () => {
  it('updates interview outcome and forwards complete/close actions', () => {
    const setInterviewOutcome = vi.fn();
    const onComplete = vi.fn();
    const onClose = vi.fn();

    render(
      <PipelineCompleteModal
        interviewOutcome={{ outcome: '', outcomeNotes: '' }}
        setInterviewOutcome={setInterviewOutcome}
        onComplete={onComplete}
        onClose={onClose}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'positive' } });
    expect(setInterviewOutcome).toHaveBeenCalledWith({ outcome: 'positive', outcomeNotes: '' });

    fireEvent.change(screen.getByPlaceholderText('pipeline.outcomeNotesPlaceholder'), {
      target: { value: 'Strong fit' },
    });
    expect(setInterviewOutcome).toHaveBeenCalledWith({ outcome: '', outcomeNotes: 'Strong fit' });

    fireEvent.click(screen.getByRole('button', { name: 'pipeline.complete' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

    expect(onComplete).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
