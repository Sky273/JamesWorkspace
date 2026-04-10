import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./DealSection', () => ({
  default: () => <div data-testid="deal-section" />,
}));

import { FilterPanel, UnassignedSection } from './DealsGroupedView.sections';
import type { GroupedData, ResumeBasic, TagsByCategory } from './dealsGrouped.types';

const t = ((key: string) => key) as never;

const emptyGroupedData: GroupedData = {
  deals: [],
  unassigned: [],
  totalDeals: 0,
  totalAssigned: 0,
  totalUnassigned: 0,
};

const populatedTags: TagsByCategory = {
  Skills: ['React', 'Node'],
  Industries: ['Banque'],
  Tools: ['Jira', 'Postman'],
  'Soft Skills': ['Leadership'],
};

describe('DealsGroupedView.sections', () => {
  it('filters grouped tags and opens the full category drawer', () => {
    const handleTagClick = vi.fn();

    render(
      <FilterPanel
        allTags={populatedTags}
        getTagCategory={(tag) => (tag === 'Jira' ? 'Tools' : 'Skills')}
        handleTagClick={handleTagClick}
        isFilterExpanded={true}
        selectedTags={['Jira']}
        t={t}
        visibleData={{ ...emptyGroupedData, totalAssigned: 2 }}
      />
    );

    expect(screen.getAllByText('Jira').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText('resumes.filterSearchPlaceholder'), {
      target: { value: 'jir' },
    });

    expect(screen.getByText('resumes.filters.tools')).toBeInTheDocument();
    expect(screen.queryByText('resumes.filters.skills')).not.toBeInTheDocument();

    const jiraFilterButton = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.trim() === 'Jira');
    expect(jiraFilterButton).toBeDefined();
    fireEvent.click(jiraFilterButton!);
    expect(handleTagClick).toHaveBeenCalledWith('Jira');

    fireEvent.click(screen.getByRole('button', { name: 'resumes.viewAllTags' }));
    expect(screen.getAllByText('resumes.filters.tools').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Jira').length).toBeGreaterThan(1);
  });

  it('expands and collapses the unassigned section progressively', () => {
    const setExpandedResumeSections = vi.fn();
    const setUnassignedExpanded = vi.fn();
    const renderResumeCard = (resume: ResumeBasic) => <div key={resume.id}>{resume.name}</div>;

    const resumes = Array.from({ length: 12 }, (_, index) => ({
      id: `resume-${index + 1}`,
      name: `Resume ${index + 1}`,
      status: 'new',
      created_at: '2026-04-10T09:00:00Z',
    })) as ResumeBasic[];

    const { rerender } = render(
      <UnassignedSection
        data={{ ...emptyGroupedData, unassigned: resumes }}
        expandedResumeSections={new Set()}
        hasActiveFilters={false}
        renderResumeCard={renderResumeCard}
        setExpandedResumeSections={setExpandedResumeSections}
        setUnassignedExpanded={setUnassignedExpanded}
        t={t}
        unassignedExpanded={true}
        visibleData={{ ...emptyGroupedData, unassigned: resumes, totalUnassigned: resumes.length }}
      />
    );

    expect(screen.getByText('Resume 1')).toBeInTheDocument();
    expect(screen.getByText('Resume 10')).toBeInTheDocument();
    expect(screen.queryByText('Resume 11')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /resumes.groupedView.showMore/i }));
    expect(setExpandedResumeSections).toHaveBeenCalled();

    const expandedSet = new Set<string>(['unassigned']);
    rerender(
      <UnassignedSection
        data={{ ...emptyGroupedData, unassigned: resumes }}
        expandedResumeSections={expandedSet}
        hasActiveFilters={false}
        renderResumeCard={renderResumeCard}
        setExpandedResumeSections={setExpandedResumeSections}
        setUnassignedExpanded={setUnassignedExpanded}
        t={t}
        unassignedExpanded={true}
        visibleData={{ ...emptyGroupedData, unassigned: resumes, totalUnassigned: resumes.length }}
      />
    );

    expect(screen.getByText('Resume 11')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /resumes.groupedView.showLess/i }));
    expect(setExpandedResumeSections).toHaveBeenCalled();
  });
});
