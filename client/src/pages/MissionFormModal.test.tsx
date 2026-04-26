import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import MissionFormModal from './MissionFormModal';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('../components/AdminFirmSelector', () => ({
  default: () => <div>firm-selector</div>,
}));

describe('MissionFormModal', () => {
  const defaultProps = {
    isEditing: false,
    formData: {
      Title: '',
      Content: '',
      Status: 'Draft' as const,
      'Client ID': '',
      'Contact ID': '',
      'Firm ID': '',
      'Deal ID': '',
    },
    setFormData: vi.fn(),
    clients: [],
    contacts: [],
    deals: [],
    loadingClients: false,
    loadingContacts: false,
    loadingDeals: false,
    onSubmit: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders a manage link next to client selection that redirects to the CRM', () => {
    render(
      <MemoryRouter>
        <MissionFormModal {...defaultProps} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Gérer' })).toHaveAttribute('href', '/clients');
  });

  it('selects the deal client when a client-linked deal is selected', () => {
    const setFormData = vi.fn();

    render(
      <MemoryRouter>
        <MissionFormModal
          {...defaultProps}
          setFormData={setFormData}
          deals={[{ id: 'deal-1', title: 'Accord cadre 2025', status: 'open', client_id: 'comutitres-client' } as never]}
        />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Affaire'), { target: { value: 'deal-1' } });

    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({
      'Deal ID': 'deal-1',
      'Client ID': 'comutitres-client',
      'Contact ID': '',
    }));
  });

  it('clears the selected deal when the client changes away from the deal client', () => {
    const setFormData = vi.fn();

    render(
      <MemoryRouter>
        <MissionFormModal
          {...defaultProps}
          formData={{
            ...defaultProps.formData,
            'Deal ID': 'deal-1',
            'Client ID': 'comutitres-client',
          }}
          setFormData={setFormData}
          clients={[
            { id: 'comutitres-client', name: 'Comutitres', type: 'client' },
            { id: 'cea-client', name: 'CEA', type: 'client' },
          ]}
          deals={[{ id: 'deal-1', title: 'Accord cadre 2025', status: 'open', client_id: 'comutitres-client' } as never]}
        />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Client / Prospect'), { target: { value: 'cea-client' } });

    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({
      'Deal ID': '',
      'Client ID': 'cea-client',
      'Contact ID': '',
    }));
  });
});
