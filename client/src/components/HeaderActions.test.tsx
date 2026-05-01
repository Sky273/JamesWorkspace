import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('./LanguageSelector', () => ({
  default: ({ variant }: { variant: string }) => (
    <button type="button" aria-label="header.changeLanguage" data-variant={variant}>
      <svg aria-hidden="true" />
    </button>
  ),
}));

import HeaderActions from './HeaderActions';

describe('HeaderActions', () => {
  it('renders a compact theme, language, and version control group', () => {
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
    expect(screen.getByRole('button', { name: 'header.changeLanguage' })).toHaveAttribute('data-variant', 'header');
    expect(screen.queryByRole('link', { name: 'navigation.settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'common.about' })).toBeNull();
    expect(screen.getByRole('button', { name: 'header.theme.dark' })).toHaveClass('app-header-actions__text-control');
    expect(screen.getByRole('button', { name: 'header.theme.dark' })).toHaveClass('dark:text-white');
    expect(screen.getByRole('button', { name: 'about.openChangelog' })).toHaveClass('app-header-actions__version');
    expect(screen.getByRole('button', { name: 'about.openChangelog' })).toHaveClass('dark:text-white');
    expect(screen.getByTestId('header-actions').querySelectorAll('svg')).toHaveLength(3);
    expect(screen.queryByText('header.theme.light')).toBeNull();
    expect(screen.queryByText('header.theme.dark')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'header.theme.dark' }));
    fireEvent.click(screen.getByRole('button', { name: 'about.openChangelog' }));

    expect(onToggleTheme).toHaveBeenCalledTimes(1);
    expect(onOpenAbout).toHaveBeenCalledTimes(1);
  });

  it('renders SVG icons without leaking a backslash character', () => {
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
    expect(screen.getByTestId('header-actions').querySelectorAll('svg')).toHaveLength(3);
  });
});
