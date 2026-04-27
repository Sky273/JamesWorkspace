import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SearchAndActions from './SearchAndActions';

const t = ((key: string) => key) as never;

describe('SearchAndActions', () => {
  it('keeps search, filters, upload, batch upload, refresh, and reset actions accessible', () => {
    const onBatchUpload = vi.fn();
    const onRefresh = vi.fn();
    const onReset = vi.fn();
    const onSearchChange = vi.fn();
    const onToggleFilter = vi.fn();
    const onUpload = vi.fn();

    render(
      <SearchAndActions
        searchQuery="react"
        onSearchChange={onSearchChange}
        isFilterExpanded={false}
        onToggleFilter={onToggleFilter}
        selectedTagsCount={2}
        onRefresh={onRefresh}
        onUpload={onUpload}
        onBatchUpload={onBatchUpload}
        onReset={onReset}
        t={t}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('resumes.searchPlaceholder'), {
      target: { value: 'node' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'resumes.uploadButton' }));
    fireEvent.click(screen.getByRole('button', { name: /resumes.filterButton/i }));
    fireEvent.click(screen.getByRole('button', { name: 'resumes.batchUploadButton' }));
    fireEvent.click(screen.getByRole('button', { name: 'resumes.refresh' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.resetFilters' }));

    expect(onSearchChange).toHaveBeenCalledWith('node');
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onToggleFilter).toHaveBeenCalledTimes(1);
    expect(onBatchUpload).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
