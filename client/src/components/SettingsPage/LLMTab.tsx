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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
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
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <optgroup label="GPT-5 (Dernière génération - 2026)">
            <option value="gpt-5.2">GPT-5.2 (Plus récent)</option>
            <option value="gpt-5.2-pro">GPT-5.2 Pro (Plus intelligent)</option>
            <option value="gpt-5.1-chat-latest">GPT-5.1 Chat</option>
            <option value="gpt-5-chat-latest">GPT-5 Chat</option>
            <option value="gpt-5-pro">GPT-5 Pro</option>
            <option value="gpt-5-codex">GPT-5 Codex (Optimisé code)</option>
          </optgroup>
          <optgroup label="GPT-4.1 (Nouvelle génération)">
            <option value="gpt-4.1">GPT-4.1 (Smartest non-reasoning)</option>
            <option value="gpt-4.1-mini">GPT-4.1 Mini (Plus rapide)</option>
            <option value="gpt-4.1-nano">GPT-4.1 Nano (Plus économique)</option>
          </optgroup>
          <optgroup label="GPT-4o (Recommandé pour production)">
            <option value="chatgpt-4o-latest">ChatGPT-4o Latest (Recommandé)</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini (Rapide et économique)</option>
          </optgroup>
          <optgroup label="Modèles de raisonnement (o-series)">
            <option value="o3">o3 (Raisonnement complexe)</option>
            <option value="o3-pro">o3 Pro (Plus de compute)</option>
            <option value="o3-mini">o3 Mini (Alternative légère)</option>
            <option value="o4-mini">o4 Mini (Rapide et économique)</option>
          </optgroup>
          <optgroup label="Anciens modèles (Legacy)">
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
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
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
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
