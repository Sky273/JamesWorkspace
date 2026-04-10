import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../utils/sanitizer.frontend', () => ({
  createSafeHtml: (html: string) => ({ __html: html }),
}));

import CompareTab from './CompareTab';

describe('CompareTab', () => {
  it('renders original and improved scores from mixed score formats', () => {
    render(
      <CompareTab
        resume={{
          'Global Rating': '75%',
          'Improved Global Rating': 91,
          'Original Text': '<p>Original CV</p>',
          'Improved Text': '<p>Improved CV</p>',
        }}
      />
    );

    expect(screen.getByText('resume.analysis.originalResume')).toBeInTheDocument();
    expect(screen.getByText('resume.analysis.improvedResume')).toBeInTheDocument();
    expect(screen.getByText('Score : 75%')).toBeInTheDocument();
    expect(screen.getByText('Score : 91%')).toBeInTheDocument();
    expect(screen.getByText('Original CV')).toBeInTheDocument();
    expect(screen.getByText('Improved CV')).toBeInTheDocument();
  });

  it('falls back to zero when score values are missing or invalid', () => {
    render(
      <CompareTab
        resume={{
          'Global Rating': 'n/a',
          'Improved Global Rating': undefined,
          'Original Text': '',
          'Improved Text': '',
        }}
      />
    );

    expect(screen.getAllByText('Score : 0%')).toHaveLength(2);
  });
});
