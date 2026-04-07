import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProcessingScreen from './ProcessingScreen';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) => {
      if (options?.returnObjects) {
        return [key];
      }
      return key;
    },
  }),
}));

describe('ProcessingScreen', () => {
  it('hides the pre-analysis step when pre-analysis is disabled', () => {
    render(
      <ProcessingScreen
        currentStep="analyze"
        preAnalysisEnabled={false}
      />
    );

    expect(screen.queryByText('processing.steps.preanalyze.title')).not.toBeInTheDocument();
    expect(screen.getByText('processing.steps.upload.title')).toBeInTheDocument();
    expect(screen.getByText('processing.steps.extract.title')).toBeInTheDocument();
    expect(screen.getByText('processing.steps.analyze.title')).toBeInTheDocument();
  });

  it('keeps the pre-analysis step when pre-analysis is enabled', () => {
    render(
      <ProcessingScreen
        currentStep="preanalyze"
        preAnalysisEnabled={true}
      />
    );

    expect(screen.getByText('processing.steps.preanalyze.title')).toBeInTheDocument();
  });

  it('mounts the fullscreen overlay at the document level', () => {
    render(
      <ProcessingScreen
        currentStep="analyze"
        fullscreen={true}
      />
    );

    const overlay = screen.getByTestId('processing-screen-fullscreen-overlay');
    expect(overlay).toBeInTheDocument();
    expect(document.body).toContainElement(overlay);
    expect(overlay).toHaveClass('fixed', 'inset-0', 'z-[100]');
  });
});
