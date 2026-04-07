import { SparklesIcon } from '@heroicons/react/24/outline';
import { render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TagsCategoryGrid from './TagsCategoryGrid';
import type { CategoryConfig } from './types';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: ComponentProps<'div'> & { children?: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
    a: ({ children, ...props }: ComponentProps<'a'> & { children?: ReactNode }) => (
      <a {...props}>{children}</a>
    ),
  },
}));

describe('TagsCategoryGrid', () => {
  const categoryConfig: Record<string, CategoryConfig> = {
    Skills: {
      icon: SparklesIcon,
      color: 'blue',
      bgLight: 'bg-blue-100',
      textColor: 'text-blue-600',
      tagBg: 'bg-blue-50',
      tagText: 'text-blue-700',
      tagBorder: 'border-blue-200',
    },
  };

  it('renders a global empty state when no category matches the filters', () => {
    render(
      <TagsCategoryGrid
        activeTab="raw"
        filteredTags={{}}
        filteredCleanedTags={{}}
        filteredEscoTags={{}}
        categoryConfig={categoryConfig}
        onEditTag={vi.fn()}
        t={(key) => key}
      />
    );

    expect(screen.getByText('tags.noTags')).toBeInTheDocument();
  });
});
