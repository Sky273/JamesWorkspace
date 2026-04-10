import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('../components/page/PageHeader', () => ({
  default: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

vi.mock('../components/BatchUpload/JobsTab', () => ({
  default: () => <div>jobs-tab</div>,
}));

import BatchJobsPage from './BatchJobsPage';

describe('BatchJobsPage', () => {
  it('renders the jobs header and jobs tab', () => {
    render(<BatchJobsPage />);

    expect(screen.getByText('Jobs de traitement')).toBeInTheDocument();
    expect(screen.getByText('jobs-tab')).toBeInTheDocument();
  });
});
