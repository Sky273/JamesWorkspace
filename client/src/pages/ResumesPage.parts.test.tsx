import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/ResumesPage', () => ({
  ManageResumeDealsModal: () => <div data-testid="manage-resume-deals-modal" />,
}));

import { ResumeFiltersPanel } from './ResumesPage.parts';

describe('ResumeFiltersPanel', () => {
  it('filters visible categories, exposes selected tags, and delegates actions', () => {
    const clearFilters = vi.fn();
    const handleTagClick = vi.fn();

    render(
      <ResumeFiltersPanel
        clearFilters={clearFilters}
        getTagCategory={(tag) => (tag === 'Jira' ? 'Tools' : 'Skills')}
        handleTagClick={handleTagClick}
        isFilterExpanded={true}
        selectedTags={['Jira']}
        tagsByCategory={{
          Skills: ['React', 'Node'],
          Industries: ['Banque'],
          Tools: ['Jira', 'Postman'],
          'Soft Skills': ['Leadership'],
        }}
      />
    );

    expect(screen.getAllByText('Jira').length).toBeGreaterThan(0);
    expect(screen.getAllByText('common.resetFilters').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText('resumes.filterSearchPlaceholder'), {
      target: { value: 'jir' },
    });

    expect(screen.getByText('resumes.filters.tools')).toBeInTheDocument();
    expect(screen.queryByText('resumes.filters.skills')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Jira' }));
    expect(handleTagClick).toHaveBeenCalledWith('Jira');

    fireEvent.click(screen.getAllByText('common.resetFilters')[0]);
    expect(clearFilters).toHaveBeenCalledTimes(1);
  });
});
