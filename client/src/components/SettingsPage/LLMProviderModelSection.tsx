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
  ollamaDiscoveryLoading?: boolean;
  ollamaModelCapabilities?: Record<string, {
    family: string | null;
    format: string | null;
    parameterSize: string | null;
    quantizationLevel: string | null;
    contextLength: number | null;
    architecture: string | null;
  }>;
  onProviderChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onModelChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onModelTextChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onOllamaUrlChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onTestConnection: () => void | Promise<void>;
  testingConnection?: boolean;
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
  ollamaDiscoveryLoading,
  ollamaModelCapabilities,
  onProviderChange,
  onModelChange,
  onModelTextChange,
  onOllamaUrlChange,
  onTestConnection,
  testingConnection = false,
  t
}: LLMProviderModelSectionProps): JSX.Element {
  const selectedOllamaCapabilities = ollamaModelCapabilities?.[modelValue];
  const canTestConnection = provider === 'ollama'
    ? Boolean((ollamaBaseUrl || '').trim() && modelValue)
    : Boolean(modelValue);
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

      {provider !== 'ollama' && provider !== 'huggingface' && (
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

      {provider === 'huggingface' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('settings.llm.model')}
          </label>
          <input
            list="huggingface-model-suggestions"
            value={modelValue}
            onChange={onModelTextChange}
            className="w-full px-4 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
            placeholder="MiniMaxAI/MiniMax-M2.7"
          />
          <datalist id="huggingface-model-suggestions">
            {modelOptions.map((model) => (
              <option key={model.value} value={model.value}>{model.label}</option>
            ))}
          </datalist>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Renseignez un modele Hugging Face compatible OpenAI router. La valeur par defaut est <span className="font-semibold">MiniMaxAI/MiniMax-M2.7</span>.
          </p>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('settings.llm.model')}
            </label>
            <select
              value={modelValue}
              onChange={onModelChange}
              className="w-full px-4 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
            >
              <option value="">Selectionner un modele distant</option>
              {modelOptions.map((model) => (
                <option key={model.value} value={model.value}>{model.label}</option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {ollamaDiscoveryLoading
                ? 'Interrogation de l instance Ollama distante...'
                : modelOptions.length > 0
                  ? `Modeles detectes: ${modelOptions.length}`
                  : 'Aucun modele detecte sur cette instance.'}
            </p>
          </div>

          {selectedOllamaCapabilities && (
            <div className="grid gap-2 rounded-md border border-blue-200/80 bg-white/70 p-3 text-sm text-gray-700 dark:border-blue-900/70 dark:bg-gray-900/40 dark:text-gray-200 md:grid-cols-2">
              <div>Famille: <span className="font-medium">{selectedOllamaCapabilities.family || '-'}</span></div>
              <div>Architecture: <span className="font-medium">{selectedOllamaCapabilities.architecture || '-'}</span></div>
              <div>Contexte: <span className="font-medium">{selectedOllamaCapabilities.contextLength || '-'}</span></div>
              <div>Quantization: <span className="font-medium">{selectedOllamaCapabilities.quantizationLevel || '-'}</span></div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void onTestConnection()}
          disabled={!canTestConnection || testingConnection}
          className="inline-flex min-h-11 items-center rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testingConnection ? 'Test en cours...' : 'Tester le modele'}
        </button>
      </div>
    </>
  );
}
