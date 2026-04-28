import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DealDeleteModal from './DealDeleteModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('DealDeleteModal', () => {
  it('uses the foreground modal overlay treatment', () => {
    const onClose = vi.fn();

    render(
      <DealDeleteModal
        open={true}
        deal={{
          id: 'deal-1',
          title: 'Affaire test',
          status: 'open',
          priority: 'medium',
          resumes_count: 0,
          missions_count: 0,
          created_at: '2026-04-28T00:00:00.000Z',
          updated_at: '2026-04-28T00:00:00.000Z',
        }}
        saving={false}
        onDelete={vi.fn()}
        onClose={onClose}
      />
    );

    const overlay = screen.getByText('crm.deals.confirmDelete').closest('.fixed');
    expect(overlay).toHaveClass('z-[10000]');
    expect(overlay).toHaveClass('bg-slate-500/45');
    expect(overlay).not.toHaveClass('bg-black/50');

    fireEvent.click(overlay as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
