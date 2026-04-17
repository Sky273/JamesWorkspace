import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ImprovementAnimation from './ImprovementAnimation';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('ImprovementAnimation', () => {
  it('announces progress as a live status region', () => {
    render(<ImprovementAnimation currentStep="improving" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Amélioration du CV en cours...')).toBeInTheDocument();
  });

  it('exposes fullscreen mode as a dialog', () => {
    render(<ImprovementAnimation currentStep="analyzing" fullscreen />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Analyse de qualité en cours...')).toBeInTheDocument();
  });
});
