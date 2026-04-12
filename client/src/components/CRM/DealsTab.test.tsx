import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const stableT = (key: string) => key;

const fetchWithAuthMock = vi.fn();
const createAuthOptionsWithCsrfMock = vi.fn().mockResolvedValue({});
const toastErrorMock = vi.fn();
const navigateMock = vi.fn();
const setSearchParamsMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: () => ({ pathname: '/clients', search: '', state: null }),
    useNavigate: () => navigateMock,
    useSearchParams: () => [new URLSearchParams(), setSearchParamsMock],
  };
});

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock('../../utils/apiInterceptor', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
  createAuthOptionsWithCsrf: (...args: unknown[]) => createAuthOptionsWithCsrfMock(...args),
}));

vi.mock('./DealCard', () => ({
  default: ({ deal, onView, onEdit, onDelete }: {
    deal: { id: string; title: string };
    onView: (deal: { id: string; title: string }) => void;
    onEdit: (deal: { id: string; title: string }) => void;
    onDelete: (deal: { id: string; title: string }) => void;
  }) => (
    <div data-testid={`deal-card-${deal.id}`}>
      <span>{deal.title}</span>
      <button aria-label={`view-${deal.id}`} onClick={() => onView(deal)}>view-{deal.id}</button>
      <button aria-label={`edit-${deal.id}`} onClick={() => onEdit(deal)}>edit-{deal.id}</button>
      <button aria-label={`delete-${deal.id}`} onClick={() => onDelete(deal)}>delete-{deal.id}</button>
    </div>
  ),
}));

vi.mock('./DealFormModal', () => ({
  default: ({ open, isEditing }: { open: boolean; isEditing: boolean }) =>
    open ? <div data-testid="deal-form-modal">{isEditing ? 'editing' : 'creating'}</div> : null,
}));

vi.mock('./DealDeleteModal', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="deal-delete-modal" /> : null),
}));

vi.mock('../page/SearchField', () => ({
  default: ({ value, onChange, placeholder }: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  }) => (
    <input
      aria-label="search-field"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import DealsTab, { mergePreservedDealIntoResults } from './DealsTab';

describe('DealsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads clients and deals, refreshes filters, and opens create modal', async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'client-1', name: 'Acme', type: 'client' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'deal-1',
              title: 'Affaire test',
              status: 'open',
              priority: 'medium',
              resumes_count: 2,
              missions_count: 1,
              created_at: '2026-04-10T09:00:00.000Z',
              updated_at: '2026-04-10T09:00:00.000Z',
            },
          ],
          pagination: { totalCount: 1 },
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'deal-1',
              title: 'Affaire test',
              status: 'open',
              priority: 'medium',
              resumes_count: 2,
              missions_count: 1,
              created_at: '2026-04-10T09:00:00.000Z',
              updated_at: '2026-04-10T09:00:00.000Z',
            },
          ],
          pagination: { totalCount: 1 },
        }),
      });

    render(<DealsTab preFilterClientId="client-1" />);

    await waitFor(() => {
      expect(screen.getByText('Affaire test')).toBeInTheDocument();
    });

    expect(screen.getByText('1 crm.deals.results')).toBeInTheDocument();
    expect(setSearchParamsMock).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'crm.deals.add' }));
    expect(screen.getByTestId('deal-form-modal')).toHaveTextContent('creating');

    fireEvent.click(screen.getByRole('button', { name: 'view-deal-1' }));
    expect(navigateMock).toHaveBeenCalledWith('/deals/deal-1');

    fireEvent.click(screen.getByRole('button', { name: 'delete-deal-1' }));
    expect(screen.getByTestId('deal-delete-modal')).toBeInTheDocument();
  });

  it('shows an error toast when the deals request fails', async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'client-1', name: 'Acme', type: 'client' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

    render(<DealsTab preFilterClientId="client-1" />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('crm.deals.messages.errorFetching');
    });
  });
});

describe('mergePreservedDealIntoResults', () => {
  it('keeps a created deal visible when the refreshed page is stale', () => {
    const result = mergePreservedDealIntoResults(
      [
        { id: 'deal-2', title: 'Existing Deal', status: 'open', client_id: 'client-1' },
      ],
      { id: 'deal-1', title: 'New Deal', status: 'open', client_id: 'client-1' },
      {
        normalizedSearch: '',
        clientFilter: 'client-1',
        statusFilter: 'open',
        pageSize: 12,
      }
    );

    expect(result.map((deal) => deal.id)).toEqual(['deal-1', 'deal-2']);
  });

  it('does not preserve a deal excluded by active filters', () => {
    const result = mergePreservedDealIntoResults(
      [
        { id: 'deal-2', title: 'Existing Deal', status: 'open', client_id: 'client-1' },
      ],
      { id: 'deal-1', title: 'Won Deal', status: 'won', client_id: 'client-1' },
      {
        normalizedSearch: '',
        clientFilter: 'client-1',
        statusFilter: 'open',
        pageSize: 12,
      }
    );

    expect(result.map((deal) => deal.id)).toEqual(['deal-2']);
  });
});
