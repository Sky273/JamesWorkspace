import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const stableT = (key: string) => key;

const fetchWithAuthMock = vi.fn();
const createAuthOptionsWithCsrfMock = vi.fn().mockResolvedValue({});
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
  }),
}));

vi.mock('../../utils/apiInterceptor', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
  createAuthOptionsWithCsrf: (...args: unknown[]) => createAuthOptionsWithCsrfMock(...args),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

import ManageResumeDealsModal from './AddToDealMenu';

describe('ManageResumeDealsModal', () => {
  it('loads associated deals, adds a resume to a deal, and removes it', async () => {
    const onSuccess = vi.fn();

    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'deal-1', title: 'Affaire A', client_name: 'Acme', status: 'open' },
            { id: 'deal-2', title: 'Affaire B', client_name: 'Beta', status: 'won' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              deal_id: 'deal-1',
              deal_title: 'Affaire A',
              client_name: 'Acme',
              status: 'open',
              added_at: '2026-04-10T09:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'deal-1', title: 'Affaire A', client_name: 'Acme', status: 'open' },
            { id: 'deal-2', title: 'Affaire B', client_name: 'Beta', status: 'won' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              deal_id: 'deal-1',
              deal_title: 'Affaire A',
              client_name: 'Acme',
              status: 'open',
              added_at: '2026-04-10T09:00:00.000Z',
            },
            {
              deal_id: 'deal-2',
              deal_title: 'Affaire B',
              client_name: 'Beta',
              status: 'won',
              added_at: '2026-04-10T10:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true });

    render(<ManageResumeDealsModal resumeId="resume-1" onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: /crm.deals.modal.manageDeals/i }));

    await waitFor(() => {
      expect(screen.getByText('Affaire A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'common.add' }));
    expect(screen.getByPlaceholderText('crm.deals.modal.searchDeal')).toBeInTheDocument();
    expect(screen.getByText('Affaire B')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Affaire B'));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('crm.deals.modal.cvAdded');
    });
    expect(onSuccess).toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: 'crm.deals.modal.removeFromDeal' })[0]);
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('crm.deals.modal.cvRemoved');
    });
  });
});
