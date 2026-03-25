import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LanguageSelector from './LanguageSelector';

const mockChangeLanguage = vi.fn();

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
  });

  it('renders the header trigger with the expected icon button classes', () => {
    render(<LanguageSelector variant="header" />);

    const button = screen.getByRole('button', { name: 'header.changeLanguage' });
    expect(button).toHaveClass('group', 'h-9', 'w-9');
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
