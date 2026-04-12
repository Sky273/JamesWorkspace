import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdaptationsDealsGroupedView from './AdaptationsDealsGroupedView';

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

vi.mock('./AdaptationsDealsGroupedView.parts', () => ({
  GroupedSearchHeader: () => <div>search-header</div>,
  DealSection: () => <div>deal-section</div>,
  MissionSection: () => <div>mission-section</div>,
}));

vi.mock('../ui/Skeleton', () => ({
  SkeletonAdaptationList: () => <div>skeleton</div>,
}));

describe('AdaptationsDealsGroupedView refresh wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authGetMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        deals: [],
        unassigned: [],
      }),
    });
  });

  it('forces a grouped adaptations refresh when the refresh token changes', async () => {
    const { rerender } = render(<AdaptationsDealsGroupedView refreshToken={0} />);

    await waitFor(() => {
      expect(authGetMock).toHaveBeenCalledWith('/api/adaptations/grouped-by-deal');
    });

    authGetMock.mockClear();

    rerender(<AdaptationsDealsGroupedView refreshToken={1} />);

    await waitFor(() => {
      expect(authGetMock).toHaveBeenCalledWith('/api/adaptations/grouped-by-deal?refresh=1');
    });
  });
});
