import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import FirmCreditsPage from './FirmCreditsPage';

const useAuthMock = vi.fn();
const getFirmCreditsPaginatedMock = vi.fn();
const addFirmCreditsMock = vi.fn();
const getStripeCreditPacksMock = vi.fn();
const createStripeCheckoutSessionMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.name && options?.amount) {
        return `${key}:${options.amount}:${options.name}`;
      }
      if (options?.name) {
        return `${key}:${options.name}`;
      }
      return key;
    },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../hooks/useScopedViewRefresh', () => ({
  useScopedViewRefresh: vi.fn(),
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
  },
}));

vi.mock('../utils/viewRefreshScopes', () => ({
  markFirmViewsDirty: vi.fn(),
}));

vi.mock('../utils/userService', () => ({
  default: {
    getFirmCreditsPaginated: (...args: unknown[]) => getFirmCreditsPaginatedMock(...args),
    addFirmCredits: (...args: unknown[]) => addFirmCreditsMock(...args),
    getStripeCreditPacks: (...args: unknown[]) => getStripeCreditPacksMock(...args),
    createStripeCheckoutSession: (...args: unknown[]) => createStripeCheckoutSessionMock(...args),
  },
}));

describe('FirmCreditsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        search: '',
        pathname: '/admin',
        hash: '',
        assign: vi.fn(),
      },
    });
    getFirmCreditsPaginatedMock.mockResolvedValue({
      firms: [{
        id: 'firm-1',
        name: 'Acme',
        credits: 1000,
        status: 'active',
        total_credits_consumed: 45,
        total_credits_added: 1000,
        top_consumers: [{ user_name: 'Alice', credits_consumed: 30, action_count: 3, last_used_at: '2026-04-13T10:00:00.000Z' }],
        recent_credit_transactions: [{ id: 'tx-1', user_name: 'Alice', action_type: 'resume.analysis', credits_delta: -20, balance_after: 980, created_at: '2026-04-13T10:00:00.000Z' }]
      }],
      pagination: { totalCount: 1, hasMore: false, page: 1, limit: 12 },
    });
    getStripeCreditPacksMock.mockResolvedValue({
      enabled: true,
      currency: 'eur',
      packs: [{ id: 'starter', name: 'Starter', credits: 250, priceCents: 2900, description: 'Pack test', currency: 'eur' }],
    });
  });

  it('allows super admins to add credits', async () => {
    useAuthMock.mockReturnValue({
      user: { role: 'admin', firmId: 'firm-1', firmName: 'Acme' },
    });
    addFirmCreditsMock.mockResolvedValue({ id: 'firm-1', name: 'Acme', credits: 1300, status: 'active' });

    render(<MemoryRouter><FirmCreditsPage /></MemoryRouter>);

    await screen.findByText('Acme');
    fireEvent.click(screen.getAllByRole('button', { name: 'firmCredits.addCredits' })[0]);
    fireEvent.change(screen.getByLabelText('firmCredits.modal.amountLabel'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'firmCredits.modal.confirm' }));

    await waitFor(() => {
      expect(addFirmCreditsMock).toHaveBeenCalledWith('firm-1', 300);
    });
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it('does not expose add credits action to local admins', async () => {
    useAuthMock.mockReturnValue({
      user: { role: 'localAdmin', firmId: 'firm-1', firmName: 'Acme' },
    });

    render(<MemoryRouter><FirmCreditsPage /></MemoryRouter>);

    await screen.findByText('Acme');
    expect(screen.queryByRole('button', { name: 'firmCredits.addCredits' })).not.toBeInTheDocument();
    expect(screen.getByText('firmCredits.purchase.title')).toBeInTheDocument();
  });

  it('starts a Stripe checkout for local admins', async () => {
    useAuthMock.mockReturnValue({
      user: { role: 'localAdmin', firmId: 'firm-1', firmName: 'Acme', email: 'admin@acme.test' },
    });
    createStripeCheckoutSessionMock.mockResolvedValue({ id: 'purchase-1', url: 'https://checkout.stripe.test/session' });

    render(<MemoryRouter><FirmCreditsPage /></MemoryRouter>);

    await screen.findByText('Acme');
    fireEvent.click(screen.getByRole('button', { name: 'firmCredits.purchase.cta' }));

    await waitFor(() => {
      expect(createStripeCheckoutSessionMock).toHaveBeenCalledWith('starter');
    });
    expect(window.location.assign).toHaveBeenCalledWith('https://checkout.stripe.test/session');
  });

  it('renders consumption details by user', async () => {
    useAuthMock.mockReturnValue({
      user: { role: 'admin', firmId: 'firm-1', firmName: 'Acme' },
    });

    render(<MemoryRouter><FirmCreditsPage /></MemoryRouter>);

    await screen.findByText('Alice');
    expect(screen.getByText('firmCredits.card.topConsumers')).toBeInTheDocument();
  });

  it('navigates to the firm credit detail page', async () => {
    useAuthMock.mockReturnValue({
      user: { role: 'admin', firmId: 'firm-1', firmName: 'Acme' },
    });

    render(<MemoryRouter><FirmCreditsPage /></MemoryRouter>);

    await screen.findByText('Acme');
    fireEvent.click(screen.getAllByText('firmCredits.viewDetail')[0]);

    expect(navigateMock).toHaveBeenCalledWith('/admin/firm-credits/firm-1');
  });
});
