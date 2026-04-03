export interface FormData {
  preAnalysisEnabled?: boolean;
  'Pre Analysis Prompt': string;
  'Analysis Prompt': string;
  'Improvement Prompt': string;
  'Match Analysis Prompt': string;
  'Adaptation Prompt': string;
}

export interface PromptGovernanceEntry {
  settingKey: string;
  promptKey: string;
  promptId: string | null;
  promptVersion: string | null;
  promptDomain: string | null;
  promptOperation: string | null;
  contractId: string | null;
  contractVersion: string | null;
  sourceModule: string | null;
  defaultText: string;
}

export interface PromptVersionStateEntry {
  currentRevision: number;
  activeSource: 'default' | 'custom';
  activeTextHash: string;
  isModified: boolean;
  lastChangedAt: string | null;
  history: Array<{
    revision: number;
    source: 'default' | 'custom';
    reason: string;
    text: string;
    textHash: string;
    changedAt: string | null;
    changedByUserId: string | null;
    changedByEmail: string | null;
    promptId: string | null;
    promptVersion: string | null;
    contractId: string | null;
    contractVersion: string | null;
  }>;
}

export interface PromptFieldDefinition {
  promptKey: keyof FormData;
  labelKey: string;
  helpTextKey: string;
  placeholders: string[];
}

export interface PromptSectionDefinition {
  id: string;
  titleKey?: string;
  fields: PromptFieldDefinition[];
}

export const PROMPT_SECTIONS: PromptSectionDefinition[] = [
  {
    id: 'pre-analysis',
    fields: [
      {
        promptKey: 'Pre Analysis Prompt',
        labelKey: 'settings.prompts.preAnalysis',
        helpTextKey: 'settings.prompts.preAnalysisHelp',
        placeholders: ['{TEXT}', '{FILENAME}'],
      },
    ],
  },
  {
    id: 'core-analysis',
    fields: [
      {
        promptKey: 'Analysis Prompt',
        labelKey: 'settings.prompts.analysis',
        helpTextKey: 'settings.prompts.analysisHelp',
        placeholders: ['{TEXT}'],
      },
      {
        promptKey: 'Improvement Prompt',
        labelKey: 'settings.prompts.improvement',
        helpTextKey: 'settings.prompts.improvementHelp',
        placeholders: ['{TEXT}', '{ANALYSIS}'],
      },
    ],
  },
  {
    id: 'adaptation',
    titleKey: 'settings.prompts.adaptationSection',
    fields: [
      {
        promptKey: 'Match Analysis Prompt',
        labelKey: 'settings.prompts.matchAnalysis',
        helpTextKey: 'settings.prompts.matchAnalysisHelp',
        placeholders: ['{RESUME_TEXT}', '{MISSION_TITLE}', '{MISSION_CONTENT}'],
      },
      {
        promptKey: 'Adaptation Prompt',
        labelKey: 'settings.prompts.adaptation',
        helpTextKey: 'settings.prompts.adaptationHelp',
        placeholders: ['{RESUME_TEXT}', '{RESUME_ANALYSIS}', '{MISSION_TITLE}', '{MISSION_CONTENT}', '{MATCH_ANALYSIS}'],
      },
    ],
  },
];

export const fallbackText = (t: (key: string) => string, key: string, fallback: string): string => {
  const translated = t(key);
  return translated === key ? fallback : translated;
};
