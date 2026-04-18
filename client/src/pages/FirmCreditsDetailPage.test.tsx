import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import FirmCreditsDetailPage from './FirmCreditsDetailPage';

const getFirmCreditsDetailMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.name) {
        return `${key}:${options.name}`;
      }
      if (options?.value) {
        return `${key}:${String(options.value)}`;
      }
      return key;
    },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../utils/userService', () => ({
  default: {
    getFirmCreditsDetail: (...args: unknown[]) => getFirmCreditsDetailMock(...args),
  },
}));

describe('FirmCreditsDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFirmCreditsDetailMock.mockResolvedValue({
      firm: { id: 'firm-1', name: 'Acme', credits: 980 },
      summary: {
        transaction_count: 4,
        total_credits_consumed: 40,
        total_credits_added: 20,
        total_credits_refunded: 10,
        last_credit_activity_at: '2026-04-18T08:00:00.000Z',
      },
      userBreakdown: [
        {
          user_id: 'user-1',
          user_name: 'Alice',
          transaction_count: 2,
          consumed_credits: 30,
          added_credits: 0,
          refunded_credits: 0,
          net_credits: -30,
          last_activity_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      actionBreakdown: [
        {
          action_type: 'resume.analysis',
          unique_user_count: 1,
          transaction_count: 2,
          consumed_credits: 30,
          added_credits: 0,
          refunded_credits: 0,
          net_credits: -30,
          last_activity_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      userActionBreakdown: [
        {
          user_id: 'user-1',
          user_name: 'Alice',
          action_type: 'resume.analysis',
          transaction_count: 2,
          consumed_credits: 30,
          added_credits: 0,
          refunded_credits: 0,
          net_credits: -30,
          last_activity_at: '2026-04-18T08:00:00.000Z',
        },
      ],
      recentTransactions: [
        {
          id: 'tx-1',
          user_id: 'user-1',
          user_name: 'Alice',
          action_type: 'resume.analysis',
          credits_delta: -20,
          balance_after: 980,
          created_at: '2026-04-18T08:00:00.000Z',
        },
      ],
    });
  });

  it('loads and renders the firm credit detail breakdown', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/firm-credits/firm-1']}>
        <Routes>
          <Route path="/admin/firm-credits/:id" element={<FirmCreditsDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getFirmCreditsDetailMock).toHaveBeenCalledWith('firm-1');
    });

    expect(await screen.findByText('firmCredits.detail.title:Acme')).toBeInTheDocument();
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getByText('firmCredits.detail.sections.userActionBreakdown')).toBeInTheDocument();
  });
});
