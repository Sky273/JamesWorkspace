import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('./LanguageSelector', () => ({
  default: ({ variant }: { variant: string }) => <div>language-selector:{variant}</div>,
}));

import HeaderActions from './HeaderActions';

describe('HeaderActions', () => {
  it('renders the reusable header action group and wires actions', () => {
    const onToggleTheme = vi.fn();
    const onOpenAbout = vi.fn();

    render(
      <MemoryRouter>
        <HeaderActions
          theme="light"
          onToggleTheme={onToggleTheme}
          onOpenAbout={onOpenAbout}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('header-actions')).toBeInTheDocument();
    expect(screen.getByText('language-selector:header')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'navigation.settings' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'header.theme.dark' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.about' }));

    expect(onToggleTheme).toHaveBeenCalledTimes(1);
    expect(onOpenAbout).toHaveBeenCalledTimes(1);
  });

  it('does not render the crescent theme icon that looked like a backslash', () => {
    render(
      <MemoryRouter>
        <HeaderActions
          theme="dark"
          onToggleTheme={vi.fn()}
          onOpenAbout={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(document.body.textContent).not.toContain('\\');
  });
});
