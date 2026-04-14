import { render, screen } from '@testing-library/react';
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
  it('renders a manage link next to client selection that redirects to the CRM', () => {
    render(
      <MemoryRouter>
        <MissionFormModal
          isEditing={false}
          formData={{
            Title: '',
            Content: '',
            Status: 'Draft',
            'Client ID': '',
            'Contact ID': '',
            'Firm ID': '',
            'Deal ID': '',
          }}
          setFormData={vi.fn()}
          clients={[]}
          contacts={[]}
          deals={[]}
          loadingClients={false}
          loadingContacts={false}
          loadingDeals={false}
          onSubmit={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Gérer' })).toHaveAttribute('href', '/clients');
  });
});
