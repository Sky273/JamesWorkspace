import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import AdminWorkspacePage from './AdminWorkspacePage';

const useAuthMock = vi.fn();

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

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('./UsersManagement', () => ({
  default: ({ forcedTab }: { forcedTab?: string }) => <div>{`users-management:${forcedTab || 'users'}`}</div>,
}));

vi.mock('./TemplatesPage', () => ({
  default: () => <div>templates-page</div>,
}));

vi.mock('./admin/EmailTemplatesPage', () => ({
  default: () => <div>email-templates-page</div>,
}));

vi.mock('./TagsManagement', () => ({
  default: () => <div>tags-page</div>,
}));

vi.mock('./FirmCreditsPage', () => ({
  default: () => <div>firm-credits-page</div>,
}));

describe('AdminWorkspacePage', () => {
  it('shows firm tab for super admins', () => {
    useAuthMock.mockReturnValue({ user: { role: 'admin' } });

    render(
      <MemoryRouter initialEntries={['/admin?tab=firms']}>
        <Routes>
          <Route path="/admin" element={<AdminWorkspacePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /adminWorkspace.tabs.firms/i })).toBeInTheDocument();
    expect(screen.getByText('users-management:firms')).toBeInTheDocument();
  });

  it('hides firm tab for local admins and allows switching to credits', () => {
    useAuthMock.mockReturnValue({ user: { role: 'localAdmin' } });

    render(
      <MemoryRouter initialEntries={['/admin?tab=users']}>
        <Routes>
          <Route path="/admin" element={<AdminWorkspacePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('adminWorkspace.tabs.firms')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /adminWorkspace.tabs.firmCredits/i }));
    expect(screen.getByText('firm-credits-page')).toBeInTheDocument();
  });
});
