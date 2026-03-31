import type { ChangeEvent } from 'react';

interface ProviderOption {
  value: string;
  label: string;
}

interface ModelOption {
  value: string;
  label: string;
}

interface LLMProviderModelSectionProps {
  provider: string;
  providerDescription: string;
  providerOptions: ProviderOption[];
  providerRuntimeUnavailableModels: string[];
  minimaxHighspeedEnabled: boolean;
  modelValue: string;
  modelOptions: ModelOption[];
  currentModelLabel: string;
  ollamaBaseUrl?: string;
  onProviderChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onModelChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onOllamaUrlChange: (event: ChangeEvent<HTMLInputElement>) => void;
  t: (key: string) => string;
}

export default function LLMProviderModelSection({
  provider,
  providerDescription,
  providerOptions,
  providerRuntimeUnavailableModels,
  minimaxHighspeedEnabled,
  modelValue,
  modelOptions,
  currentModelLabel,
  ollamaBaseUrl,
  onProviderChange,
  onModelChange,
  onOllamaUrlChange,
  t
}: LLMProviderModelSectionProps): JSX.Element {
  return (
    <>
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('settings.llm.title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{providerDescription}</p>
        {provider === 'minimax' && !minimaxHighspeedEnabled && (
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
            {t('settings.llm.minimaxHighspeedDisabled')}
          </p>
        )}
        {providerRuntimeUnavailableModels.length > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
            {provider === 'minimax'
              ? t('settings.llm.minimaxRuntimeUnavailable')
              : t('settings.llm.runtimeUnavailable')}{' '}
            <span className="font-medium">{providerRuntimeUnavailableModels.join(', ')}</span>
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('settings.llm.provider')}
        </label>
        <select
          value={provider}
          onChange={onProviderChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        >
          {providerOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {provider !== 'ollama' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('settings.llm.model')}
          </label>
          <select
            value={modelValue}
            onChange={onModelChange}
            className="w-full px-4 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
          >
            {modelOptions.map((model) => (
              <option key={model.value} value={model.value}>{model.label}</option>
            ))}
          </select>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t('settings.currentModel')} : <span className="font-semibold">{currentModelLabel}</span>
          </p>
        </div>
      )}

      {provider === 'ollama' && (
        <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('settings.llm.ollamaBaseUrl')}
            </label>
            <input
              type="url"
              value={ollamaBaseUrl || ''}
              onChange={onOllamaUrlChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              placeholder="https://ollama.example.com"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t('settings.llm.ollamaHelp')}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
