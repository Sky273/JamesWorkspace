import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string }) => {
      if (typeof options === 'string') {
        return options;
      }
      return options?.defaultValue || key;
    },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('./DealResumeCard', () => ({
  default: ({ resume, onClick }: { resume: { id: string; name: string }; onClick: (id: string) => void }) => (
    <button onClick={() => onClick(resume.id)}>{resume.name}</button>
  ),
}));

import DealSection from './DealSection';
import type { DealGroup } from './dealsGrouped.types';

const deal: DealGroup = {
  id: 'deal-1',
  title: 'Affaire test',
  status: 'open',
  priority: 'medium',
  client_name: 'Acme',
  client_type: 'client',
  contact_name: 'Luc',
  resumes_count: 12,
  resumes: Array.from({ length: 12 }, (_, index) => ({
    id: `resume-${index + 1}`,
    name: `CV ${index + 1}`,
    status: 'improved',
    created_at: '2026-04-10T09:00:00.000Z',
  })),
  missions: [
    {
      id: 'mission-1',
      title: 'Product Manager',
      status: 'Active',
      created_at: '2026-04-10T09:00:00.000Z',
      adaptations_count: 1,
      adaptations: [
        {
          id: 'adapt-1',
          resume_id: 'resume-1',
          resume_name: 'ADA',
          adapted_title: 'Chef de produit',
          match_score: 82,
          status: 'completed',
          created_at: '2026-04-10T09:00:00.000Z',
        },
      ],
    },
  ],
};

describe('DealSection', () => {
  it('renders the expanded deal, navigates to deal and mission resources, and toggles extra resumes', () => {
    const onExportDeal = vi.fn();
    const saveViewState = vi.fn();

    render(
      <DealSection
        deal={deal}
        originalDeal={deal}
        isExpanded
        hasActiveFilters={false}
        isDragOver={false}
        isSourceDeal={false}
        isDragging={false}
        draggedResumeId={null}
        dropping={false}
        onToggle={vi.fn()}
        onDragEnter={vi.fn()}
        onDragLeave={vi.fn()}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
        onDragStart={vi.fn()}
        onDragEnd={vi.fn()}
        onResumeClick={vi.fn()}
        onDownload={vi.fn()}
        onDelete={vi.fn()}
        onDealChange={vi.fn(async () => undefined)}
        onExportDeal={onExportDeal}
        getResumeTags={() => ({})}
        getDownloadTitle={() => 'Télécharger'}
        saveViewState={saveViewState}
      />
    );

    expect(screen.getByText('Affaire test')).toBeInTheDocument();
    expect(screen.getByText('Product Manager')).toBeInTheDocument();
    expect(screen.getByText('ADA')).toBeInTheDocument();
    expect(screen.getByText('CV 1')).toBeInTheDocument();
    expect(screen.queryByText('CV 11')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
    expect(saveViewState).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/deals/deal-1');

    fireEvent.click(screen.getByRole('button', { name: 'dealExport.title' }));
    expect(onExportDeal).toHaveBeenCalledWith(deal);

    fireEvent.click(screen.getByRole('button', { name: 'resumes.groupedView.showMore' }));
    expect(screen.getByText('CV 11')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Product Manager'));
    expect(navigateMock).toHaveBeenCalledWith('/missions/mission-1');

    fireEvent.click(screen.getByText('ADA'));
    expect(navigateMock).toHaveBeenCalledWith('/adaptations/adapt-1', {
      state: { from: 'dealsGroupedView' },
    });
  });
});
