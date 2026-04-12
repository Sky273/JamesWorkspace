import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ClientDetailModal from './ClientDetailModal';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

describe('ClientDetailModal', () => {
  it('renders a refresh action and triggers it', () => {
    const onRefresh = vi.fn();

    render(
      <ClientDetailModal
        isOpen
        onClose={vi.fn()}
        client={{
          id: 'client-1',
          name: 'Acme',
          type: 'client',
          contacts: [],
          recentSubmissions: [],
        }}
        onEditClient={vi.fn()}
        onAddContact={vi.fn()}
        onEditContact={vi.fn()}
        onDeleteContact={vi.fn()}
        onRefresh={onRefresh}
        t={(key: string) => key}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'common.refresh' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
