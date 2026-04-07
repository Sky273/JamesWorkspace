import {
  ANONYMIZATION_RULES_ANONYMOUS,
  ANONYMIZATION_RULES_NOMINATIVE,
  DEFAULT_ADAPTATION_PROMPT,
  DEFAULT_ANALYSIS_PROMPT,
  DEFAULT_IMPROVEMENT_PROMPT,
  DEFAULT_PRE_ANALYSIS_PROMPT as DEFAULT_PRE_ANALYSIS_PROMPT_TEXT,
  DEFAULT_MATCH_ANALYSIS_PROMPT
} from './prompts/resume.prompts.js';
import {
  BATCH_PROFILE_SCORING_PROMPT,
  DETAILED_PROFILE_ANALYSIS_PROMPT,
  MISSION_KEYWORDS_EXTRACTION_PROMPT,
  TITLE_MATCHING_REFINEMENT_PROMPT
} from './prompts/profileMatching.prompts.js';

export const CONTRACT_REGISTRY = Object.freeze({
  resume_analysis_v1: Object.freeze({
    id: 'resume_analysis_v1',
    version: '1.0.0',
    domain: 'resume',
    validatorModule: '../services/openai/contracts.js',
    validatorExport: 'validateResumeAnalysisPayload',
    description: 'Analyse structurée d\'un CV.'
  }),
  resume_pre_analysis_v1: Object.freeze({
    id: 'resume_pre_analysis_v1',
    version: '1.0.0',
    domain: 'resume',
    validatorModule: null,
    validatorExport: null,
    description: 'Pre-analyse textuelle d\'un CV avant l\'analyse structuree.'
  }),
  resume_improvement_v1: Object.freeze({
    id: 'resume_improvement_v1',
    version: '1.0.0',
    domain: 'resume',
    validatorModule: '../services/openai/contracts.js',
    validatorExport: 'validateResumeImprovementEnvelope',
    description: 'Enveloppe JSON d\'amélioration de CV.'
  }),
  mission_match_v1: Object.freeze({
    id: 'mission_match_v1',
    version: '1.0.0',
    domain: 'mission',
    validatorModule: '../services/openai/contracts.js',
    validatorExport: 'validateMatchAnalysisPayload',
    description: 'Analyse d\'adéquation CV ↔ mission.'
  }),
  mission_adaptation_v1: Object.freeze({
    id: 'mission_adaptation_v1',
    version: '1.0.0',
    domain: 'mission',
    validatorModule: '../services/openai/contracts.js',
    validatorExport: 'validateAdaptationPayload',
    description: 'Adaptation structurée d\'un CV à une mission.'
  }),
  mission_keywords_v1: Object.freeze({
    id: 'mission_keywords_v1',
    version: '1.0.0',
    domain: 'profileMatching',
    validatorModule: '../services/profileMatching/contracts.js',
    validatorExport: 'validateMissionKeywordsPayload',
    description: 'Extraction des mots-clés mission pour le matching.'
  }),
  detailed_profile_analysis_v1: Object.freeze({
    id: 'detailed_profile_analysis_v1',
    version: '1.0.0',
    domain: 'profileMatching',
    validatorModule: '../services/profileMatching/contracts.js',
    validatorExport: 'validateDetailedProfileAnalysisPayload',
    description: 'Analyse détaillée d\'un profil pour une mission.'
  }),
  batch_profile_scoring_v1: Object.freeze({
    id: 'batch_profile_scoring_v1',
    version: '1.0.0',
    domain: 'profileMatching',
    validatorModule: '../services/profileMatching/contracts.js',
    validatorExport: 'validateBatchProfileScoringPayload',
    description: 'Scoring batch de profils pour le matching.'
  }),
  title_matching_refinement_v1: Object.freeze({
    id: 'title_matching_refinement_v1',
    version: '1.0.0',
    domain: 'profileMatching',
    validatorModule: null,
    validatorExport: null,
    description: 'Affinage LLM des titres de poste pour le ranking local.'
  }),
  anonymization_rules_v1: Object.freeze({
    id: 'anonymization_rules_v1',
    version: '1.0.0',
    domain: 'resume',
    validatorModule: null,
    validatorExport: null,
    description: 'Règles textuelles d\'anonymisation appliquées aux prompts CV.'
  })
});

export const PROMPT_REGISTRY = Object.freeze({
  DEFAULT_PRE_ANALYSIS_PROMPT: Object.freeze({
    key: 'DEFAULT_PRE_ANALYSIS_PROMPT',
    id: 'resume.pre-analysis.default',
    version: '1.2.0',
    domain: 'resume',
    operation: 'resume-pre-analysis',
    contractId: 'resume_pre_analysis_v1',
    owner: 'resume',
    sourceModule: './prompts/resume.prompts.js',
    text: DEFAULT_PRE_ANALYSIS_PROMPT_TEXT
  }),
  DEFAULT_ANALYSIS_PROMPT: Object.freeze({
    key: 'DEFAULT_ANALYSIS_PROMPT',
    id: 'resume.analysis.default',
    version: '1.8.8',
    domain: 'resume',
    operation: 'resume-analysis',
    contractId: 'resume_analysis_v1',
    owner: 'resume',
    sourceModule: './prompts/resume.prompts.js',
    text: DEFAULT_ANALYSIS_PROMPT
  }),
  DEFAULT_IMPROVEMENT_PROMPT: Object.freeze({
    key: 'DEFAULT_IMPROVEMENT_PROMPT',
    id: 'resume.improvement.default',
    version: '1.8.8',
    domain: 'resume',
    operation: 'resume-improvement',
    contractId: 'resume_improvement_v1',
    owner: 'resume',
    sourceModule: './prompts/resume.prompts.js',
    text: DEFAULT_IMPROVEMENT_PROMPT
  }),
  DEFAULT_MATCH_ANALYSIS_PROMPT: Object.freeze({
    key: 'DEFAULT_MATCH_ANALYSIS_PROMPT',
    id: 'mission.match.default',
    version: '1.8.8',
    domain: 'mission',
    operation: 'resume-mission-match',
    contractId: 'mission_match_v1',
    owner: 'resume-adaptation',
    sourceModule: './prompts/resume.prompts.js',
    text: DEFAULT_MATCH_ANALYSIS_PROMPT
  }),
  DEFAULT_ADAPTATION_PROMPT: Object.freeze({
    key: 'DEFAULT_ADAPTATION_PROMPT',
    id: 'mission.adaptation.default',
    version: '1.8.8',
    domain: 'mission',
    operation: 'resume-mission-adaptation',
    contractId: 'mission_adaptation_v1',
    owner: 'resume-adaptation',
    sourceModule: './prompts/resume.prompts.js',
    text: DEFAULT_ADAPTATION_PROMPT
  }),
  ANONYMIZATION_RULES_ANONYMOUS: Object.freeze({
    key: 'ANONYMIZATION_RULES_ANONYMOUS',
    id: 'resume.anonymization.anonymous',
    version: '1.8.8',
    domain: 'resume',
    operation: 'resume-anonymization',
    contractId: 'anonymization_rules_v1',
    owner: 'resume',
    sourceModule: './prompts/resume.prompts.js',
    text: ANONYMIZATION_RULES_ANONYMOUS
  }),
  ANONYMIZATION_RULES_NOMINATIVE: Object.freeze({
    key: 'ANONYMIZATION_RULES_NOMINATIVE',
    id: 'resume.anonymization.nominative',
    version: '1.8.8',
    domain: 'resume',
    operation: 'resume-anonymization',
    contractId: 'anonymization_rules_v1',
    owner: 'resume',
    sourceModule: './prompts/resume.prompts.js',
    text: ANONYMIZATION_RULES_NOMINATIVE
  }),
  MISSION_KEYWORDS_EXTRACTION_PROMPT: Object.freeze({
    key: 'MISSION_KEYWORDS_EXTRACTION_PROMPT',
    id: 'profile-matching.mission-keywords.default',
    version: '1.8.8',
    domain: 'profileMatching',
    operation: 'mission-keywords-extraction',
    contractId: 'mission_keywords_v1',
    owner: 'profile-matching',
    sourceModule: './prompts/profileMatching.prompts.js',
    text: MISSION_KEYWORDS_EXTRACTION_PROMPT
  }),
  DETAILED_PROFILE_ANALYSIS_PROMPT: Object.freeze({
    key: 'DETAILED_PROFILE_ANALYSIS_PROMPT',
    id: 'profile-matching.detailed-analysis.default',
    version: '1.8.8',
    domain: 'profileMatching',
    operation: 'detailed-profile-analysis',
    contractId: 'detailed_profile_analysis_v1',
    owner: 'profile-matching',
    sourceModule: './prompts/profileMatching.prompts.js',
    text: DETAILED_PROFILE_ANALYSIS_PROMPT
  }),
  TITLE_MATCHING_REFINEMENT_PROMPT: Object.freeze({
    key: 'TITLE_MATCHING_REFINEMENT_PROMPT',
    id: 'profile-matching.title-refinement.default',
    version: '1.8.8',
    domain: 'profileMatching',
    operation: 'title-matching-refinement',
    contractId: 'title_matching_refinement_v1',
    owner: 'profile-matching',
    sourceModule: './prompts/profileMatching.prompts.js',
    text: TITLE_MATCHING_REFINEMENT_PROMPT
  }),
  BATCH_PROFILE_SCORING_PROMPT: Object.freeze({
    key: 'BATCH_PROFILE_SCORING_PROMPT',
    id: 'profile-matching.batch-scoring.default',
    version: '1.8.8',
    domain: 'profileMatching',
    operation: 'batch-profile-scoring',
    contractId: 'batch_profile_scoring_v1',
    owner: 'profile-matching',
    sourceModule: './prompts/profileMatching.prompts.js',
    text: BATCH_PROFILE_SCORING_PROMPT
  })
});

export function getPromptDefinition(key) {
  return PROMPT_REGISTRY[key] || null;
}

export function getPromptText(key) {
  return PROMPT_REGISTRY[key]?.text || null;
}

export function getPromptContract(key) {
  const definition = getPromptDefinition(key);
  return definition ? CONTRACT_REGISTRY[definition.contractId] || null : null;
}

export function listPromptDefinitions() {
  return Object.values(PROMPT_REGISTRY);
}

export function listPromptDefinitionsByDomain(domain) {
  return listPromptDefinitions().filter((entry) => entry.domain === domain);
}

export function getContractDefinition(contractId) {
  return CONTRACT_REGISTRY[contractId] || null;
}

export function buildPromptExecutionMetadata(key, source = 'default') {
  const prompt = getPromptDefinition(key);
  if (!prompt) {
    return {
      promptKey: key,
      promptSource: source,
      promptId: null,
      promptVersion: null,
      contractId: null,
      contractVersion: null
    };
  }

  const contract = getPromptContract(key);
  return {
    promptKey: prompt.key,
    promptId: prompt.id,
    promptVersion: prompt.version,
    promptSource: source,
    promptDomain: prompt.domain,
    promptOperation: prompt.operation,
    contractId: contract?.id || null,
    contractVersion: contract?.version || null
  };
}
