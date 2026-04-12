import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getViewRefreshSnapshotMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../utils/viewRefresh', () => ({
  getViewRefreshSnapshot: () => getViewRefreshSnapshotMock(),
}));

describe('ViewRefreshDebugCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getViewRefreshSnapshotMock.mockReturnValue({
      dirtyScopes: { users: 2, templates: 1 },
      counters: { marks: 5, deliveries: 3, consumes: 2 },
      scopeCounters: {
        marks: { users: 2, templates: 1 },
        deliveries: { users: 1 },
        consumes: { templates: 1 },
      },
      recentEvents: [
        { type: 'mark', scopes: ['users'], at: '2026-04-12T10:00:00.000Z' },
      ],
    });
  });

  it('renders the debug snapshot when refresh debug is enabled', async () => {
    vi.stubEnv('VITE_DEBUG_VIEW_REFRESH', '1');
    const { default: ViewRefreshDebugCard } = await import('./ViewRefreshDebugCard');

    render(<ViewRefreshDebugCard />);

    expect(screen.getByText('Refresh transverse')).toBeInTheDocument();
    expect(screen.getByText('users v2')).toBeInTheDocument();
    expect(screen.getByText('templates v1')).toBeInTheDocument();
  });

  it('refreshes the displayed snapshot on demand', async () => {
    vi.stubEnv('VITE_DEBUG_VIEW_REFRESH', '1');
    getViewRefreshSnapshotMock
      .mockReturnValueOnce({
        dirtyScopes: {},
        counters: { marks: 0, deliveries: 0, consumes: 0 },
        scopeCounters: { marks: {}, deliveries: {}, consumes: {} },
        recentEvents: [],
      })
      .mockReturnValueOnce({
        dirtyScopes: { resumes: 4 },
        counters: { marks: 1, deliveries: 1, consumes: 1 },
        scopeCounters: { marks: { resumes: 1 }, deliveries: { resumes: 1 }, consumes: { resumes: 1 } },
        recentEvents: [{ type: 'deliver', scopes: ['resumes'], at: '2026-04-12T10:00:01.000Z' }],
      });

    const { default: ViewRefreshDebugCard } = await import('./ViewRefreshDebugCard');
    render(<ViewRefreshDebugCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Recharger le snapshot' }));

    expect(screen.getByText('resumes v4')).toBeInTheDocument();
  });
});
