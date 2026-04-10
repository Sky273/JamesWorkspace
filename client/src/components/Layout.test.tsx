import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const signOutMock = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      name: 'Luc Moreau',
      firmName: 'ResumeConverter',
      role: 'admin',
    },
    signOut: (...args: unknown[]) => signOutMock(...args),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Outlet: () => <div>layout-outlet</div>,
    useLocation: () => ({ pathname: '/resumes' }),
  };
});

vi.mock('./Sidebar', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => <div>sidebar:{String(isOpen)}</div>,
}));
vi.mock('./ScrollToTop', () => ({ default: () => <div>scroll-top</div> }));
vi.mock('./LanguageSelector', () => ({ default: () => <div>language-selector</div> }));
vi.mock('./Footer', () => ({ default: () => <div>footer</div> }));
vi.mock('./HealthIndicator', () => ({ default: () => <div>health-indicator</div> }));
vi.mock('./Breadcrumbs', () => ({ default: () => <div>breadcrumbs</div> }));
vi.mock('./AboutModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>about-modal</div> : null),
}));
vi.mock('./ChatBot', () => ({ default: () => <div>chatbot</div> }));

import Layout from './Layout';

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.className = '';
    document.cookie = '';
  });

  it('renders the shell, toggles the mobile sidebar, opens the about modal, and signs out', async () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    expect(screen.getByText('layout-outlet')).toBeInTheDocument();
    expect(screen.getByText('breadcrumbs')).toBeInTheDocument();
    expect(screen.getByText('LM')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.openMenu' }));
    expect(screen.getByText('sidebar:true')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.about' }));
    await waitFor(() => {
      expect(screen.getByText('about-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('common.signOut'));
    expect(signOutMock).toHaveBeenCalled();
  });
});
