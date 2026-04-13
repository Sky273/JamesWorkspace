import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getViewRefreshSnapshotMock = vi.fn();
const isViewRefreshDebugEnabledMock = vi.fn(() => true);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../utils/viewRefresh', () => ({
  getViewRefreshSnapshot: () => getViewRefreshSnapshotMock(),
  isViewRefreshDebugEnabled: () => isViewRefreshDebugEnabledMock(),
}));

describe('ViewRefreshDebugCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isViewRefreshDebugEnabledMock.mockReturnValue(true);
    getViewRefreshSnapshotMock.mockReturnValue({
      dirtyScopes: { users: 2, templates: 1 },
      counters: { marks: 5, deliveries: 3, consumes: 2 },
      scopeCounters: {
        marks: { users: 2, templates: 1 },
        deliveries: { users: 1 },
        consumes: { templates: 1 },
      },
      refreshCycles: {
        total: 3,
        failures: 1,
        averageDurationMs: 42.5,
        maxDurationMs: 80,
        lastDurationMs: 12,
        byScope: {
          users: { total: 2, failures: 1, averageDurationMs: 30, maxDurationMs: 40, lastDurationMs: 20 },
          templates: { total: 1, failures: 0, averageDurationMs: 67, maxDurationMs: 67, lastDurationMs: 67 },
        },
      },
      recentEvents: [
        { type: 'mark', scopes: ['users'], at: '2026-04-12T10:00:00.000Z' },
      ],
    });
  });

  it('renders the debug snapshot when refresh debug is enabled', async () => {
    const { default: ViewRefreshDebugCard } = await import('./ViewRefreshDebugCard');

    render(<ViewRefreshDebugCard />);

    expect(screen.getByText('Refresh transverse')).toBeInTheDocument();
    expect(screen.getByText('users v2')).toBeInTheDocument();
    expect(screen.getByText('templates v1')).toBeInTheDocument();
    expect(screen.getByText('Performance par scope')).toBeInTheDocument();
    expect(screen.getByText('42.5 ms')).toBeInTheDocument();
  });

  it('refreshes the displayed snapshot on demand', async () => {
    getViewRefreshSnapshotMock
      .mockReturnValueOnce({
        dirtyScopes: {},
        counters: { marks: 0, deliveries: 0, consumes: 0 },
        scopeCounters: { marks: {}, deliveries: {}, consumes: {} },
        refreshCycles: {
          total: 0,
          failures: 0,
          averageDurationMs: 0,
          maxDurationMs: 0,
          lastDurationMs: 0,
          byScope: {},
        },
        recentEvents: [],
      })
      .mockReturnValueOnce({
        dirtyScopes: { resumes: 4 },
        counters: { marks: 1, deliveries: 1, consumes: 1 },
        scopeCounters: { marks: { resumes: 1 }, deliveries: { resumes: 1 }, consumes: { resumes: 1 } },
        refreshCycles: {
          total: 1,
          failures: 0,
          averageDurationMs: 18,
          maxDurationMs: 18,
          lastDurationMs: 18,
          byScope: {
            resumes: { total: 1, failures: 0, averageDurationMs: 18, maxDurationMs: 18, lastDurationMs: 18 },
          },
        },
        recentEvents: [{ type: 'deliver', scopes: ['resumes'], at: '2026-04-12T10:00:01.000Z' }],
      });

    const { default: ViewRefreshDebugCard } = await import('./ViewRefreshDebugCard');
    render(<ViewRefreshDebugCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Recharger le snapshot' }));

    expect(screen.getByText('resumes v4')).toBeInTheDocument();
    expect(screen.getAllByText('18.0 ms').length).toBeGreaterThan(0);
  });
});
