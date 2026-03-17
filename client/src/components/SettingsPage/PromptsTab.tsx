/**
 * Prompts Configuration Tab for Settings Page
 * TypeScript version
 */

import { ChangeEvent } from 'react';

interface FormData {
  'Analysis Prompt': string;
  'Improvement Prompt': string;
  'Match Analysis Prompt': string;
  'Adaptation Prompt': string;
  [key: string]: string | number | boolean;
}

interface PromptTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helpText: string;
  placeholders: string[];
  t: (key: string) => string;
}

interface PromptsTabProps {
  formData: FormData;
  onInputChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

const PromptTextarea = ({ label, value, onChange, helpText, placeholders, t }: PromptTextareaProps): JSX.Element => {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    onChange(e.target.value);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <textarea
        value={value}
        onChange={handleChange}
        rows={12}
        placeholder={t('settings.prompts.placeholder')}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 font-mono text-sm"
      />
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {helpText}{' '}
        {placeholders.map((ph, idx) => (
          <span key={ph}>
            <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">{ph}</code>
            {idx < placeholders.length - 1 && ', '}
          </span>
        ))}
      </p>
    </div>
  );
};

const PromptsTab = ({ formData, onInputChange, t }: PromptsTabProps): JSX.Element => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('settings.prompts.title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('settings.prompts.description')}
        </p>
      </div>

      <PromptTextarea
        label={t('settings.prompts.analysis')}
        value={formData['Analysis Prompt']}
        onChange={(value) => onInputChange('Analysis Prompt', value)}
        helpText={t('settings.prompts.analysisHelp')}
        placeholders={['{TEXT}']}
        t={t}
      />

      <PromptTextarea
        label={t('settings.prompts.improvement')}
        value={formData['Improvement Prompt']}
        onChange={(value) => onInputChange('Improvement Prompt', value)}
        helpText={t('settings.prompts.improvementHelp')}
        placeholders={['{TEXT}', '{ANALYSIS}']}
        t={t}
      />

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('settings.prompts.adaptationSection')}
        </h3>
      </div>

      <PromptTextarea
        label={t('settings.prompts.matchAnalysis')}
        value={formData['Match Analysis Prompt']}
        onChange={(value) => onInputChange('Match Analysis Prompt', value)}
        helpText={t('settings.prompts.matchAnalysisHelp')}
        placeholders={['{RESUME_TEXT}', '{MISSION_TITLE}', '{MISSION_CONTENT}']}
        t={t}
      />

      <PromptTextarea
        label={t('settings.prompts.adaptation')}
        value={formData['Adaptation Prompt']}
        onChange={(value) => onInputChange('Adaptation Prompt', value)}
        helpText={t('settings.prompts.adaptationHelp')}
        placeholders={['{RESUME_TEXT}', '{RESUME_ANALYSIS}', '{MISSION_TITLE}', '{MISSION_CONTENT}', '{MATCH_ANALYSIS}']}
        t={t}
      />
    </div>
  );
};

export default PromptsTab;
