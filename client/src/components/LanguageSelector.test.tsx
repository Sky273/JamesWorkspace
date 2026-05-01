import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LanguageSelector from './LanguageSelector';

const mockChangeLanguage = vi.fn();
const getBoundingClientRectMock = vi.fn(() => ({
  width: 40,
  height: 40,
  top: 12,
  left: 24,
  bottom: 52,
  right: 64,
  x: 24,
  y: 12,
  toJSON: () => ({}),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: mockChangeLanguage,
      resolvedLanguage: 'fr',
    },
  }),
}));

describe('LanguageSelector', () => {
  beforeEach(() => {
    mockChangeLanguage.mockReset();
    getBoundingClientRectMock.mockClear();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(getBoundingClientRectMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the header trigger with the expected icon button classes', () => {
    render(<LanguageSelector variant="header" />);

    const button = screen.getByRole('button', { name: 'header.changeLanguage' });
    expect(button).toHaveClass('inline-flex', 'h-9', 'w-9');
    expect(button).toHaveClass('app-header-actions__language');
    expect(button).toHaveClass('dark:text-white');
    expect(button).not.toHaveTextContent('fr');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('opens the menu and changes language', async () => {
    render(<LanguageSelector variant="header" />);

    fireEvent.click(screen.getByRole('button', { name: 'header.changeLanguage' }));

    const englishButton = await screen.findByRole('button', { name: /header\.language\.en/ });
    fireEvent.click(englishButton);

    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /header\.language\.en/ })).toBeNull();
    });
  });

  it('measures the trigger geometry when opening instead of during the initial render', async () => {
    render(<LanguageSelector variant="header" />);

    expect(getBoundingClientRectMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'header.changeLanguage' }));

    await screen.findByRole('button', { name: /header\.language\.fr/ });
    expect(getBoundingClientRectMock).toHaveBeenCalledTimes(1);
  });

  it('closes on escape and restores focus to the trigger', async () => {
    render(<LanguageSelector variant="header" />);

    const trigger = screen.getByRole('button', { name: 'header.changeLanguage' });
    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /header\.language\.fr/ })).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });
});
