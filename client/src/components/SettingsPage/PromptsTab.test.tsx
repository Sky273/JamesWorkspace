import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PromptsTab from './PromptsTab';

const formData = {
  'Analysis Prompt': 'Default analysis prompt',
  'Improvement Prompt': 'Custom improvement prompt',
  'Match Analysis Prompt': 'Default match prompt',
  'Adaptation Prompt': 'Default adaptation prompt',
};

const promptGovernance = {
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

describe('PromptsTab', () => {
  it('renders governance metadata and default/customized status', () => {
    render(
      <PromptsTab
        formData={formData}
        onInputChange={() => {}}
        promptGovernance={promptGovernance}
        t={(key) => key}
      />
    );

    expect(screen.getByText('resume.analysis.default')).toBeInTheDocument();
    expect(screen.getByText('resume_improvement_v1')).toBeInTheDocument();
    expect(screen.getByText('Par defaut')).toBeInTheDocument();
    expect(screen.getByText('Personnalise')).toBeInTheDocument();
  });
});
