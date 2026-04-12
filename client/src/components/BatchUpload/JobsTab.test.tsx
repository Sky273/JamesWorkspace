import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import JobsTab from './JobsTab';

const fetchWithAuthMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../utils/apiInterceptor', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
  createAuthOptionsWithCsrf: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('./jobsTab/JobsTabHeader', () => ({
  default: () => <div>jobs-header</div>,
}));

vi.mock('./jobsTab/JobCard', () => ({
  default: ({ job }: { job: { id: string } }) => <div>{job.id}</div>,
}));

describe('JobsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          id: 'job-1',
          status: 'completed',
          job_type: 'collect-trends',
          options: {},
          total_items: 1,
          processed_items: 1,
          success_count: 1,
          error_count: 0,
          created_at: '2026-04-12T00:00:00.000Z',
        },
      ]),
    });
  });

  it('marks the corresponding cached screens dirty when a collection job completes', async () => {
    render(<JobsTab />);

    await waitFor(() => {
      const storedScopes = window.sessionStorage.getItem('appDirtyViewScopes');
      expect(storedScopes).toContain('marketTrends');
      expect(storedScopes).not.toContain('jobs');
    });
  });
});
