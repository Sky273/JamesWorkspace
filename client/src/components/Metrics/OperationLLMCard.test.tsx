import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OperationLLMCard from './OperationLLMCard';

describe('OperationLLMCard', () => {
  it('renders post-analysis fallback metrics for improvement runs', () => {
    const translations: Record<string, string> = {
      'metrics.source': 'Source',
      'metrics.stage': 'Étape',
    };

    render(
      <OperationLLMCard
        mode="improvement"
        metrics={{
          runs: 4,
          successfulRuns: 3,
          failedRuns: 1,
          structuredRuns: 2,
          fallbackRuns: 1,
          postAnalysisFallbackRuns: 1,
          inputChars: 1200,
          outputChars: 900,
          recent: [{
            timestamp: '2026-04-17T09:00:00.000Z',
            provider: 'openai/gpt-5.4-mini',
            event: 'completed',
            successfulRuns: 1,
            failedRuns: 0,
            structuredRuns: 1,
            fallbackRuns: 0,
            postAnalysisFallbackRuns: 1,
            source: 'embedded-analysis-fallback',
            stage: 'post-analysis',
          }]
        }}
        successRatio={0.75}
        t={(key: string, options?: { defaultValue?: string }) => translations[key] ?? options?.defaultValue ?? key}
        safeNumber={(value: unknown, defaultValue = 0) => typeof value === 'number' ? value : defaultValue}
        formatNumber={(value?: number) => String(value ?? 0)}
      />
    );

    expect(screen.getByText('Fallbacks post-analyse')).toBeInTheDocument();
    expect(screen.getByText('openai/gpt-5.4-mini')).toBeInTheDocument();
    expect(screen.getByText(/Fallbacks post-analyse: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Source: Analyse embarquée conservée/)).toBeInTheDocument();
    expect(screen.getByText(/Étape: Post-analyse/)).toBeInTheDocument();
  });
});
