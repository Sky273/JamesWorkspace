import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PipelineAddCandidateModal from './PipelineAddCandidateModal';

describe('PipelineAddCandidateModal', () => {
  it('filters candidates, shows adaptation badges only when relevant, and enables add after selection', () => {
    const setSearchQuery = vi.fn();
    const setSelectedCandidateId = vi.fn();
    const setAddNotes = vi.fn();
    const onAdd = vi.fn();
    const onClose = vi.fn();

    const { rerender } = render(
      <PipelineAddCandidateModal
        availableCandidates={[
          {
            id: 'adaptation:1',
            resumeId: 'resume-1',
            name: 'ADA',
            title: 'Product Owner',
            source: 'adaptation',
            hasMissionAdaptation: true,
            adaptationId: 'adapt-1',
            score: 65,
          },
          {
            id: 'resume:1',
            resumeId: 'resume-1',
            name: 'SLA',
            title: 'Analyste',
            source: 'resume',
            hasMissionAdaptation: true,
          },
          {
            id: 'resume:2',
            resumeId: 'resume-2',
            name: 'AAL',
            title: 'Data Engineer',
            source: 'resume',
          },
        ]}
        loadingResumes={false}
        searchQuery=""
        setSearchQuery={setSearchQuery}
        selectedCandidateId=""
        setSelectedCandidateId={setSelectedCandidateId}
        addNotes=""
        setAddNotes={setAddNotes}
        onAdd={onAdd}
        onClose={onClose}
      />
    );

    expect(screen.getByText('ADA')).toBeInTheDocument();
    expect(screen.getByText('SLA')).toBeInTheDocument();
    expect(screen.getByText('AAL')).toBeInTheDocument();
    expect(screen.getByText('pipeline.adapted')).toBeInTheDocument();
    expect(screen.getByText('pipeline.original')).toBeInTheDocument();
    expect(screen.queryAllByText('pipeline.original')).toHaveLength(1);

    fireEvent.change(screen.getByPlaceholderText('pipeline.searchCandidates'), {
      target: { value: 'product' },
    });
    expect(setSearchQuery).toHaveBeenCalledWith('product');

    rerender(
      <PipelineAddCandidateModal
        availableCandidates={[
          {
            id: 'adaptation:1',
            resumeId: 'resume-1',
            name: 'ADA',
            title: 'Product Owner',
            source: 'adaptation',
            hasMissionAdaptation: true,
            adaptationId: 'adapt-1',
            score: 65,
          },
          {
            id: 'resume:1',
            resumeId: 'resume-1',
            name: 'SLA',
            title: 'Analyste',
            source: 'resume',
            hasMissionAdaptation: true,
          },
          {
            id: 'resume:2',
            resumeId: 'resume-2',
            name: 'AAL',
            title: 'Data Engineer',
            source: 'resume',
          },
        ]}
        loadingResumes={false}
        searchQuery="product"
        setSearchQuery={setSearchQuery}
        selectedCandidateId=""
        setSelectedCandidateId={setSelectedCandidateId}
        addNotes=""
        setAddNotes={setAddNotes}
        onAdd={onAdd}
        onClose={onClose}
      />
    );

    expect(screen.getByText('ADA')).toBeInTheDocument();
    expect(screen.queryByText('SLA')).not.toBeInTheDocument();
    expect(screen.queryByText('AAL')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ADA/i }));
    expect(setSelectedCandidateId).toHaveBeenCalledWith('adaptation:1');

    rerender(
      <PipelineAddCandidateModal
        availableCandidates={[
          {
            id: 'adaptation:1',
            resumeId: 'resume-1',
            name: 'ADA',
            title: 'Product Owner',
            source: 'adaptation',
            hasMissionAdaptation: true,
            adaptationId: 'adapt-1',
            score: 65,
          },
        ]}
        loadingResumes={false}
        searchQuery="product"
        setSearchQuery={setSearchQuery}
        selectedCandidateId="adaptation:1"
        setSelectedCandidateId={setSelectedCandidateId}
        addNotes="note test"
        setAddNotes={setAddNotes}
        onAdd={onAdd}
        onClose={onClose}
      />
    );

    const addButton = screen.getByRole('button', { name: 'pipeline.add' });
    expect(addButton).toBeEnabled();
    fireEvent.click(addButton);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
  it('shows the loading state and disables add when no candidate is selected', () => {
    render(
      <PipelineAddCandidateModal
        availableCandidates={[]}
        loadingResumes={true}
        searchQuery=""
        setSearchQuery={vi.fn()}
        selectedCandidateId=""
        setSelectedCandidateId={vi.fn()}
        addNotes=""
        setAddNotes={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'pipeline.add' })).toBeDisabled();
  });

  it('shows the empty state when no candidate matches the search', () => {
    render(
      <PipelineAddCandidateModal
        availableCandidates={[
          {
            id: 'resume:2',
            resumeId: 'resume-2',
            name: 'AAL',
            title: 'Data Engineer',
            source: 'resume',
          },
        ]}
        loadingResumes={false}
        searchQuery="product"
        setSearchQuery={vi.fn()}
        selectedCandidateId=""
        setSelectedCandidateId={vi.fn()}
        addNotes=""
        setAddNotes={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('pipeline.noCandidatesAvailable')).toBeInTheDocument();
  });
});
