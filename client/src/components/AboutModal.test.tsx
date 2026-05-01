import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AboutModal from './AboutModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('../../../CHANGELOG.md?raw', () => ({
  default: '## v1.9.3\n\n- Corrections QA',
}));

vi.mock('@headlessui/react', () => ({
  Dialog: Object.assign(
    ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
    {
      Panel: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
      ),
      Title: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <h3 className={className}>{children}</h3>
      ),
    },
  ),
  Transition: Object.assign(
    ({ children, show }: { children: React.ReactNode; show: boolean }) => (show ? <>{children}</> : null),
    {
      Child: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    },
  ),
}));

describe('AboutModal', () => {
  it('shows the current version and changelog when opened', async () => {
    render(<AboutModal isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Version v1.9.3')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Corrections QA')).toBeInTheDocument());
  });
});
