import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import packageJson from '../../../package.json';

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
    expect(screen.getByText('language-selector:header')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'navigation.settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'common.about' })).toBeNull();
    expect(screen.getByText(`v${packageJson.version}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'header.theme.dark' })).toHaveClass('app-header-actions__text-control');
    expect(screen.getByRole('button', { name: 'header.theme.dark' })).toHaveClass('dark:text-white');
    expect(screen.getByText(`v${packageJson.version}`)).toHaveClass('app-header-actions__version');
    expect(screen.getByText(`v${packageJson.version}`)).toHaveClass('dark:text-white');

    fireEvent.click(screen.getByRole('button', { name: 'header.theme.dark' }));
    fireEvent.click(screen.getByRole('button', { name: 'about.openChangelog' }));

    expect(onToggleTheme).toHaveBeenCalledTimes(1);
    expect(onOpenAbout).toHaveBeenCalledTimes(1);
  });

  it('does not render SVG icons in the rewritten header actions', () => {
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
    expect(screen.getByTestId('header-actions').querySelector('svg')).toBeNull();
  });
});
