import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EmailTemplatePreview from './EmailTemplatePreview';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

describe('EmailTemplatePreview', () => {
  it('exposes localized view mode labels and pressed state', () => {
    render(<EmailTemplatePreview html="<p>Hello</p>" subject="Subject" />);

    const desktopButton = screen.getByRole('button', { name: 'emailTemplates.desktopView' });
    const mobileButton = screen.getByRole('button', { name: 'emailTemplates.mobileView' });

    expect(desktopButton).toHaveAttribute('aria-pressed', 'true');
    expect(mobileButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(mobileButton);

    expect(desktopButton).toHaveAttribute('aria-pressed', 'false');
    expect(mobileButton).toHaveAttribute('aria-pressed', 'true');
  });
});
