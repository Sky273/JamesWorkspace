import { describe, expect, it } from 'vitest';
import {
  CONTRACT_REGISTRY,
  PROMPT_REGISTRY,
  getContractDefinition,
  getPromptContract,
  getPromptDefinition,
  getPromptText,
  listPromptDefinitionsByDomain
} from '../../config/llmGovernance.js';

describe('llmGovernance', () => {
  it('exposes stable prompt definitions for historical exports', () => {
    const definition = getPromptDefinition('DEFAULT_ANALYSIS_PROMPT');
    expect(definition).toBeTruthy();
    expect(definition.id).toBe('resume.analysis.default');
    expect(definition.contractId).toBe('resume_analysis_v1');
    expect(getPromptText('DEFAULT_ANALYSIS_PROMPT')).toBeTypeOf('string');
    expect(getPromptText('DEFAULT_ANALYSIS_PROMPT').length).toBeGreaterThan(100);
  });

  it('links each governed prompt to a known contract', () => {
    for (const definition of Object.values(PROMPT_REGISTRY)) {
      expect(getPromptContract(definition.key)?.id).toBe(definition.contractId);
    }
  });

  it('exposes contract metadata for validators', () => {
    expect(getContractDefinition('mission_adaptation_v1')).toMatchObject({
      validatorModule: '../services/openai/contracts.js',
      validatorExport: 'validateAdaptationPayload'
    });
  });

  it('can list prompts by domain', () => {
    const resumePrompts = listPromptDefinitionsByDomain('resume');
    expect(resumePrompts.length).toBeGreaterThan(0);
    expect(resumePrompts.every(prompt => prompt.domain === 'resume')).toBe(true);
  });

  it('keeps contract ids unique', () => {
    const ids = Object.values(CONTRACT_REGISTRY).map(contract => contract.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
