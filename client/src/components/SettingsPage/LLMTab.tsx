/**
 * LLM Model Selection Tab for Settings Page
 * TypeScript version
 */

import { ChangeEvent } from 'react';

interface FormData {
  llmModel: string;
  cvMode?: 'nominative' | 'anonymous';
  [key: string]: string | number | boolean | undefined;
}

interface LLMTabProps {
  formData: FormData;
  onInputChange: (key: string, value: string) => void;
  t: (key: string) => string;
}

const LLMTab = ({ formData, onInputChange, t }: LLMTabProps): JSX.Element => {
  const handleModelChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    onInputChange('llmModel', e.target.value);
  };

  const handleCvModeChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    onInputChange('cvMode', e.target.value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('settings.llm.title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('settings.llm.description')}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('settings.llm.model')}
        </label>
        <select
          value={formData.llmModel}
          onChange={handleModelChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        >
          <optgroup label="GPT-5 (Dernière génération)">
            <option value="gpt-5.4">GPT-5.4 (Dernière version)</option>
            <option value="gpt-5.4-pro">GPT-5.4 Pro (Plus intelligent)</option>
            <option value="gpt-5.2">GPT-5.2</option>
            <option value="gpt-5.2-pro">GPT-5.2 Pro</option>
            <option value="gpt-5.1">GPT-5.1</option>
            <option value="gpt-5">GPT-5</option>
          </optgroup>
          <optgroup label="GPT-4o (Production)">
            <option value="gpt-4o">GPT-4o (Recommandé)</option>
            <option value="gpt-4o-mini">GPT-4o Mini (Rapide et économique)</option>
          </optgroup>
        </select>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t('settings.currentModel')} : <span className="font-semibold">{formData.llmModel}</span>
        </p>
      </div>

      {/* CV Mode Selection */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('settings.llm.cvMode')}
        </label>
        <select
          value={formData.cvMode || 'nominative'}
          onChange={handleCvModeChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        >
          <option value="nominative">{t('settings.llm.cvModeNominative')}</option>
          <option value="anonymous">{t('settings.llm.cvModeAnonymous')}</option>
        </select>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {formData.cvMode === 'anonymous' 
            ? t('settings.llm.cvModeAnonymousDescription')
            : t('settings.llm.cvModeNominativeDescription')
          }
        </p>
      </div>
    </div>
  );
};

export default LLMTab;
