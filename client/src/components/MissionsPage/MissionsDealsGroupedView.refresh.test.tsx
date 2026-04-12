import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MissionsDealsGroupedView from './MissionsDealsGroupedView';

const authGetMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../../hooks/useAuthFetch', () => ({
  useAuthFetch: () => ({
    authGet: (...args: unknown[]) => authGetMock(...args),
  }),
}));

vi.mock('../../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('./MissionsDealsGroupedView.parts', () => ({
  MissionsGroupedToolbar: () => <div>toolbar</div>,
  MissionsGroupedSummary: () => <div>summary</div>,
  MissionsGroupedEmptyState: () => <div>empty</div>,
  DealSection: () => <div>deal-section</div>,
  MissionCardInDeal: () => <div>mission-card</div>,
  canDeleteGroupedMission: () => true,
  normalizeMissionKeywordsText: () => '',
}));

vi.mock('../ui/Skeleton', () => ({
  SkeletonMissionList: () => <div>skeleton</div>,
}));

describe('MissionsDealsGroupedView refresh wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authGetMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        deals: [],
        unassigned: [],
        totalAssigned: 0,
        totalUnassigned: 0,
      }),
    });
  });

  it('forces a grouped missions refresh when the refresh token changes', async () => {
    const { rerender } = render(
      <MissionsDealsGroupedView
        onAddMission={vi.fn()}
        onEditMission={vi.fn()}
        onDeleteMission={vi.fn()}
        refreshToken={0}
      />,
    );

    await waitFor(() => {
      expect(authGetMock).toHaveBeenCalledWith('/api/missions/grouped-by-deal');
    });

    authGetMock.mockClear();

    rerender(
      <MissionsDealsGroupedView
        onAddMission={vi.fn()}
        onEditMission={vi.fn()}
        onDeleteMission={vi.fn()}
        refreshToken={1}
      />,
    );

    await waitFor(() => {
      expect(authGetMock).toHaveBeenCalledWith('/api/missions/grouped-by-deal?refresh=1');
    });
  });
});
