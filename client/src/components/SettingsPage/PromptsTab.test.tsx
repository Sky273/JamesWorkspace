import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import PromptsTab from './PromptsTab';

const formData = {
  preAnalysisEnabled: true,
  'Pre Analysis Prompt': 'Default pre-analysis prompt',
  'Analysis Prompt': 'Default analysis prompt',
  'Improvement Prompt': 'Custom improvement prompt',
  'Match Analysis Prompt': 'Default match prompt',
  'Adaptation Prompt': 'Default adaptation prompt',
};

const promptGovernance = {
  'Pre Analysis Prompt': {
    settingKey: 'Pre Analysis Prompt',
    promptKey: 'DEFAULT_PRE_ANALYSIS_PROMPT',
    promptId: 'resume.pre-analysis.default',
    promptVersion: '1.0.0',
    promptDomain: 'resume',
    promptOperation: 'resume-pre-analysis',
    contractId: 'resume_pre_analysis_v1',
    contractVersion: '1.0.0',
    sourceModule: './prompts/resume.prompts.js',
    defaultText: 'Default pre-analysis prompt',
  },
  'Analysis Prompt': {
    settingKey: 'Analysis Prompt',
    promptKey: 'DEFAULT_ANALYSIS_PROMPT',
    promptId: 'resume.analysis.default',
    promptVersion: '1.8.8',
    promptDomain: 'resume',
    promptOperation: 'resume-analysis',
    contractId: 'resume_analysis_v1',
    contractVersion: '1.0.0',
    sourceModule: './prompts/resume.prompts.js',
    defaultText: 'Default analysis prompt',
  },
  'Improvement Prompt': {
    settingKey: 'Improvement Prompt',
    promptKey: 'DEFAULT_IMPROVEMENT_PROMPT',
    promptId: 'resume.improvement.default',
    promptVersion: '1.8.8',
    promptDomain: 'resume',
    promptOperation: 'resume-improvement',
    contractId: 'resume_improvement_v1',
    contractVersion: '1.0.0',
    sourceModule: './prompts/resume.prompts.js',
    defaultText: 'Default improvement prompt',
  },
};

const promptVersionState = {
  'Pre Analysis Prompt': {
    currentRevision: 2,
    activeSource: 'default' as const,
    activeTextHash: 'hash-pre-analysis',
    isModified: false,
    lastChangedAt: '2026-03-31T09:00:00.000Z',
    history: [{
      revision: 1,
      source: 'default' as const,
      reason: 'initial_default',
      text: 'Older pre-analysis prompt',
      textHash: 'hash-pre-analysis-v1',
      changedAt: '2026-03-30T09:00:00.000Z',
      changedByUserId: null,
      changedByEmail: null,
      promptId: 'resume.pre-analysis.default',
      promptVersion: '1.0.0',
      contractId: 'resume_pre_analysis_v1',
      contractVersion: '1.0.0',
    }, {
      revision: 2,
      source: 'default' as const,
      reason: 'reverted_to_default',
      text: 'Default pre-analysis prompt',
      textHash: 'hash-pre-analysis',
      changedAt: '2026-03-31T09:00:00.000Z',
      changedByUserId: 'user-1',
      changedByEmail: 'admin@example.com',
      promptId: 'resume.pre-analysis.default',
      promptVersion: '1.0.0',
      contractId: 'resume_pre_analysis_v1',
      contractVersion: '1.0.0',
    }],
  },
  'Analysis Prompt': {
    currentRevision: 1,
    activeSource: 'default' as const,
    activeTextHash: 'hash-analysis',
    isModified: false,
    lastChangedAt: null,
    history: [{
      revision: 1,
      source: 'default' as const,
      reason: 'initial_default',
      text: 'Default analysis prompt',
      textHash: 'hash-analysis',
      changedAt: null,
      changedByUserId: null,
      changedByEmail: null,
      promptId: 'resume.analysis.default',
      promptVersion: '1.8.8',
      contractId: 'resume_analysis_v1',
      contractVersion: '1.0.0',
    }],
  },
  'Improvement Prompt': {
    currentRevision: 3,
    activeSource: 'custom' as const,
    activeTextHash: 'hash-improvement',
    isModified: true,
    lastChangedAt: '2026-04-01T11:00:00.000Z',
    history: [{
      revision: 1,
      source: 'default' as const,
      reason: 'initial_default',
      text: 'Default improvement prompt',
      textHash: 'hash-default',
      changedAt: null,
      changedByUserId: null,
      changedByEmail: null,
      promptId: 'resume.improvement.default',
      promptVersion: '1.8.8',
      contractId: 'resume_improvement_v1',
      contractVersion: '1.0.0',
    }, {
      revision: 2,
      source: 'custom' as const,
      reason: 'updated_custom',
      text: 'Another improvement prompt',
      textHash: 'hash-v2',
      changedAt: '2026-03-31T10:00:00.000Z',
      changedByUserId: 'user-1',
      changedByEmail: 'admin@example.com',
      promptId: 'resume.improvement.default',
      promptVersion: '1.8.8',
      contractId: 'resume_improvement_v1',
      contractVersion: '1.0.0',
    }, {
      revision: 3,
      source: 'custom' as const,
      reason: 'updated_custom',
      text: 'Custom improvement prompt',
      textHash: 'hash-improvement',
      changedAt: '2026-04-01T11:00:00.000Z',
      changedByUserId: 'user-1',
      changedByEmail: 'admin@example.com',
      promptId: 'resume.improvement.default',
      promptVersion: '1.8.8',
      contractId: 'resume_improvement_v1',
      contractVersion: '1.0.0',
    }],
  },
};

describe('PromptsTab', () => {
  it('renders governance metadata and default/customized status', () => {
    const onInputChange = vi.fn();
    render(
      <PromptsTab
        formData={formData}
        onInputChange={onInputChange}
        promptGovernance={promptGovernance}
        promptVersionState={promptVersionState}
        t={(key) => key}
      />
    );

    expect(screen.getByText('resume.analysis.default')).toBeInTheDocument();
    expect(screen.getByText('resume.pre-analysis.default')).toBeInTheDocument();
    expect(screen.getByText('resume_improvement_v1')).toBeInTheDocument();
    expect(screen.getByText('resume_pre_analysis_v1')).toBeInTheDocument();
    expect(screen.getAllByText('2026-04-01T11:00:00.000Z').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Par defaut').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Personnalise').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText('Historique des versions')[0]);
    fireEvent.click(screen.getAllByText('Restaurer dans l editeur')[0]);

    expect(onInputChange).toHaveBeenCalledWith('Pre Analysis Prompt', 'Older pre-analysis prompt');
  });

  it('hides the pre-analysis prompt when the option is disabled', () => {
    render(
      <PromptsTab
        formData={{ ...formData, preAnalysisEnabled: false }}
        onInputChange={vi.fn()}
        promptGovernance={promptGovernance}
        promptVersionState={promptVersionState}
        t={(key) => key}
      />
    );

    expect(screen.queryByText('resume.pre-analysis.default')).not.toBeInTheDocument();
    expect(screen.getByText('settings.prompts.preAnalysisEnabled')).toBeInTheDocument();
  });

  it('hides the pre-analysis prompt dynamically when the toggle is switched off', () => {
    const Wrapper = (): JSX.Element => {
      const [currentFormData, setCurrentFormData] = useState(formData);

      return (
        <PromptsTab
          formData={currentFormData}
          onInputChange={(key, value) => {
            setCurrentFormData((prev) => ({
              ...prev,
              [key]: value,
            }));
          }}
          promptGovernance={promptGovernance}
          promptVersionState={promptVersionState}
          t={(key) => key}
        />
      );
    };

    render(<Wrapper />);

    expect(screen.getByText('resume.pre-analysis.default')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.queryByText('resume.pre-analysis.default')).not.toBeInTheDocument();
  });
});
