import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { markViewScopesDirty } from '../utils/viewRefresh';
import FirmCreditsPage from './FirmCreditsPage';

const useAuthMock = vi.fn();
const getFirmCreditsPaginatedMock = vi.fn();
const getStripeCreditPacksMock = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../utils/userService', () => ({
  default: {
    getFirmCreditsPaginated: (...args: unknown[]) => getFirmCreditsPaginatedMock(...args),
    getStripeCreditPacks: (...args: unknown[]) => getStripeCreditPacksMock(...args),
  },
}));

vi.mock('../components/page/AnimatedCard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/page/CardActionButton', () => ({
  default: ({ label, onClick }: { label: string; onClick: () => void }) => <button onClick={onClick}>{label}</button>,
}));

vi.mock('../components/page/EmptyStateCard', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('../components/page/PageHeader', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('../components/page/PaginationPair', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/page/SearchField', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock('../components/page/StatCardsGrid', () => ({
  default: () => <div>stats-grid</div>,
}));

describe('FirmCreditsPage refresh wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    useAuthMock.mockReturnValue({
      user: { role: 'localAdmin', firmId: 'firm-1', firmName: 'Acme' },
    });
    getFirmCreditsPaginatedMock.mockResolvedValue({
      firms: [],
      pagination: { totalCount: 0, hasMore: false, page: 1, limit: 12 },
    });
    getStripeCreditPacksMock.mockResolvedValue({
      enabled: true,
      currency: 'eur',
      packs: [],
    });
  });

  it('forces a firm credits refresh for the embedded admin tab when the firms scope is dirty', async () => {
    markViewScopesDirty(['firms']);

    render(<MemoryRouter><FirmCreditsPage embedded /></MemoryRouter>);

    await waitFor(() => {
      expect(getFirmCreditsPaginatedMock).toHaveBeenCalledWith(
        expect.objectContaining({ forceRefresh: true }),
      );
    });
  });
});
