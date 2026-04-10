import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import PipelineHistoryModal from './PipelineHistoryModal';

describe('PipelineHistoryModal', () => {
  it('renders empty history and closes the modal', () => {
    const onClose = vi.fn();

    render(
      <PipelineHistoryModal
        history={[]}
        stages={[]}
        isEnglish={false}
        formatDate={(value) => value}
        onClose={onClose}
      />
    );

    expect(screen.getByText('pipeline.noHistory')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders stage history entries with formatted dates and notes', () => {
    render(
      <PipelineHistoryModal
        history={[
          {
            id: 'history-1',
            from_stage: 'stage-1',
            to_stage: 'stage-2',
            created_at: '2026-04-10T12:00:00.000Z',
            changed_by_name: 'Luc',
            notes: 'Passed technical screening',
          },
        ]}
        stages={[
          { id: 'stage-1', label: 'Nouveau', labelEn: 'New', color: '#111111' },
          { id: 'stage-2', label: 'Préselection', labelEn: 'Screened', color: '#222222' },
        ]}
        isEnglish={false}
        formatDate={(value) => `formatted:${value}`}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Nouveau')).toBeInTheDocument();
    expect(screen.getByText('Préselection')).toBeInTheDocument();
    expect(screen.getByText('Passed technical screening')).toBeInTheDocument();
    expect(screen.getByText(/formatted:2026-04-10T12:00:00.000Z/)).toBeInTheDocument();
  });
});
