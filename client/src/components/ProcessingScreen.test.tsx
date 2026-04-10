import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const stableT = (key: string, options?: { returnObjects?: boolean }) => {
  if (options?.returnObjects) {
    const arrays: Record<string, string[]> = {
      'processing.steps.upload.steps': ['uploading'],
      'processing.steps.extract.steps': ['extracting'],
      'processing.steps.preanalyze.steps': ['preanalyzing'],
      'processing.steps.analyze.steps': ['analyzing'],
    };
    return arrays[key] ?? [key];
  }
  return key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
  }),
}));

import ProcessingScreen from './ProcessingScreen';

describe('ProcessingScreen', () => {
  it('renders fullscreen overlay with the active step and error message', () => {
    render(
      <ProcessingScreen
        currentStep="extract"
        fullscreen
        error="Erreur OCR"
      />
    );

    expect(screen.getByTestId('processing-screen-fullscreen-overlay')).toBeInTheDocument();
    expect(screen.getByText('processing.steps.extract.title')).toBeInTheDocument();
    expect(screen.getByText('processing.title')).toBeInTheDocument();
    expect(screen.getByText('Erreur OCR')).toBeInTheDocument();
  });

  it('omits the pre-analysis step when disabled', () => {
    render(
      <ProcessingScreen
        currentStep="analyze"
        preAnalysisEnabled={false}
      />
    );

    expect(screen.queryByText('processing.steps.preanalyze.title')).not.toBeInTheDocument();
    expect(screen.getByText('processing.steps.analyze.title')).toBeInTheDocument();
  });
});
