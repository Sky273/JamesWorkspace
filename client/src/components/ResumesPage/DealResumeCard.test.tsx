import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./AddToDealMenu', () => ({
  default: ({ onSuccess }: { onSuccess: () => Promise<void> }) => (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void onSuccess();
      }}
    >
      manage-deals
    </button>
  ),
}));

vi.mock('./ResumePreviewPanel', () => ({
  default: ({ onClose, onOpenFull }: { onClose: () => void; onOpenFull: (id: string) => void }) => (
    <div data-testid="resume-preview-panel">
      <button type="button" onClick={onClose}>close-preview</button>
      <button type="button" onClick={() => onOpenFull('resume-1')}>open-full</button>
    </div>
  ),
}));

import DealResumeCard from './DealResumeCard';
import type { ResumeBasic } from './dealsGrouped.types';

const resume = {
  id: 'resume-1',
  name: 'Ada Lovelace',
  title: 'Product Manager',
  status: 'improved',
  improved_global_rating: 84,
  created_at: '2026-04-10T09:00:00.000Z',
  firm_name: 'Comutitres',
  skills: 'React,Node',
  industries: 'Transport',
} satisfies ResumeBasic;

describe('DealResumeCard', () => {
  it('preserves row navigation and resume actions', () => {
    const onClick = vi.fn();
    const onDealChange = vi.fn(async () => undefined);
    const onDelete = vi.fn();
    const onDownload = vi.fn();

    render(
      <DealResumeCard
        resume={resume}
        sourceDealId={null}
        isDragging={false}
        dropping={false}
        draggableEnabled={false}
        onDragStart={vi.fn()}
        onDragEnd={vi.fn()}
        onClick={onClick}
        onDownload={onDownload}
        onDelete={onDelete}
        onDealChange={onDealChange}
        getResumeTags={() => ({
          skills: ['React', 'Node'],
          industries: ['Transport'],
          tools: [],
          soft_skills: [],
        })}
        getDownloadTitle={() => 'download-title'}
        index={0}
      />
    );

    fireEvent.keyDown(screen.getByRole('article'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /resumes.preview.title/i }));
    fireEvent.click(screen.getByRole('button', { name: /common.download/i }));
    fireEvent.click(screen.getByRole('button', { name: 'manage-deals' }));
    fireEvent.click(screen.getByRole('button', { name: /common.delete/i }));

    expect(screen.getByTestId('resume-preview-panel')).toBeInTheDocument();
    expect(onClick).toHaveBeenCalledWith('resume-1');
    expect(onDownload).toHaveBeenCalledWith(resume, expect.any(Object));
    expect(onDealChange).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(resume, expect.any(Object));
  });
});
