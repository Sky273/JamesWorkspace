import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OperationLLMCard from './OperationLLMCard';

describe('OperationLLMCard', () => {
  it('renders post-analysis fallback metrics for improvement runs', () => {
    const translations: Record<string, string> = {
      'metrics.source': 'Source',
      'metrics.stage': 'Étape',
      'metrics.resumeSource': 'Source CV',
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
          postAnalysisMergeRuns: 1,
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
            postAnalysisMergeRuns: 1,
            source: 'embedded-analysis-fallback',
            stage: 'post-analysis',
            mergedKeys: ['title', 'tags'],
          }]
        }}
        successRatio={0.75}
        t={(key: string, options?: { defaultValue?: string }) => translations[key] ?? options?.defaultValue ?? key}
        safeNumber={(value: unknown, defaultValue = 0) => typeof value === 'number' ? value : defaultValue}
        formatNumber={(value?: number) => String(value ?? 0)}
      />
    );

    expect(screen.getByText('Fallbacks post-analyse')).toBeInTheDocument();
    expect(screen.getByText('Fusions post-analyse')).toBeInTheDocument();
    expect(screen.getByText('openai/gpt-5.4-mini')).toBeInTheDocument();
    expect(screen.getByText(/Fallbacks post-analyse: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Fusions post-analyse: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Source: Analyse embarquée conservée/)).toBeInTheDocument();
    expect(screen.getByText(/Étape: Post-analyse/)).toBeInTheDocument();
    expect(screen.getByText(/Champs fusionnés: title, tags/)).toBeInTheDocument();
  });

  it('renders adaptation source and resume source labels for recent entries', () => {
    const translations: Record<string, string> = {
      'metrics.source': 'Source',
      'metrics.resumeSource': 'Source CV',
    };

    render(
      <OperationLLMCard
        mode="adaptation"
        metrics={{
          runs: 2,
          matchRuns: 2,
          successfulRuns: 2,
          failedRuns: 0,
          structuredRuns: 1,
          fallbackRuns: 1,
          inputChars: 800,
          outputChars: 700,
          recent: [{
            timestamp: '2026-04-17T10:00:00.000Z',
            provider: 'glm/glm-5',
            event: 'completed',
            matchRuns: 1,
            successfulRuns: 1,
            failedRuns: 0,
            structuredRuns: 0,
            fallbackRuns: 1,
            source: 'plain-text-fallback',
            resumeSource: 'improved_text',
          }]
        }}
        successRatio={1}
        t={(key: string, options?: { defaultValue?: string }) => translations[key] ?? options?.defaultValue ?? key}
        safeNumber={(value: unknown, defaultValue = 0) => typeof value === 'number' ? value : defaultValue}
        formatNumber={(value?: number) => String(value ?? 0)}
      />
    );

    expect(screen.getByText(/Source: Fallback texte brut/)).toBeInTheDocument();
    expect(screen.getByText(/Source CV: CV amélioré/)).toBeInTheDocument();
  });
});
