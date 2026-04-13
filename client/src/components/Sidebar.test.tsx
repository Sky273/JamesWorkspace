import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import Sidebar from './Sidebar';

const useAuthMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

describe('Sidebar', () => {
  it('shows Administration entry to local admins in the manager section', () => {
    useAuthMock.mockReturnValue({
      user: { role: 'localAdmin' },
    });

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /Administration/i })).toHaveAttribute('href', '/admin');
  });

  it('hides super-admin-only metrics entry from local admins', () => {
    useAuthMock.mockReturnValue({
      user: { role: 'localAdmin' },
    });

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: /Metrics/i })).not.toBeInTheDocument();
  });

  it('hides individual admin entries that are now grouped under Administration', () => {
    useAuthMock.mockReturnValue({
      user: { role: 'admin' },
    });

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: /Modèles de CV|templates/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Templates email/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Étiquettes|tags/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Utilisateurs|users/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Crédits cabinets|firm credits/i })).not.toBeInTheDocument();
  });
});
