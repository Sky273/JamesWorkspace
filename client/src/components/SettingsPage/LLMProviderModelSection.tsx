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
        <h2 className="mb-1 text-base font-semibold text-[var(--cv-text)]">
          {t('settings.llm.title')}
        </h2>
        <p className="mb-4 text-sm text-[var(--cv-muted)]">{providerDescription}</p>
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
        <label className="mb-2 block text-sm font-medium text-[var(--cv-muted)]">
          {t('settings.llm.provider')}
        </label>
        <select
          value={provider}
          onChange={onProviderChange}
          className="w-full rounded-[9px] border border-[#dedbe8] bg-white px-4 py-2 text-sm text-[var(--cv-text)] focus:border-[#6246ea] focus:ring-2 focus:ring-[#6246ea]/20 dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
        >
          {providerOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {provider !== 'ollama' && provider !== 'huggingface' && (
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--cv-muted)]">
            {t('settings.llm.model')}
          </label>
          <select
            value={modelValue}
            onChange={onModelChange}
            className="w-full rounded-[9px] border border-[#dedbe8] bg-white px-4 py-2 text-sm text-[var(--cv-text)] focus:border-[#6246ea] focus:ring-2 focus:ring-[#6246ea]/20 dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
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
            className="w-full rounded-[9px] border border-[#dedbe8] bg-white px-4 py-2 text-sm text-[var(--cv-text)] focus:border-[#6246ea] focus:ring-2 focus:ring-[#6246ea]/20 dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
            placeholder="MiniMaxAI/MiniMax-M2.7"
          />
          <datalist id="huggingface-model-suggestions">
            {modelOptions.map((model) => (
              <option key={model.value} value={model.value}>{model.label}</option>
            ))}
          </datalist>
          <p className="mt-2 text-sm text-[var(--cv-muted)]">
            Renseignez un modèle Hugging Face compatible OpenAI router. La valeur par défaut est <span className="font-semibold">MiniMaxAI/MiniMax-M2.7</span>.
          </p>
          <p className="mt-2 text-sm text-[var(--cv-muted)]">
            {t('settings.currentModel')} : <span className="font-semibold">{currentModelLabel}</span>
          </p>
        </div>
      )}

      {provider === 'ollama' && (
        <div className="space-y-4 rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--cv-muted)]">
              {t('settings.llm.ollamaBaseUrl')}
            </label>
            <input
              type="url"
              value={ollamaBaseUrl || ''}
              onChange={onOllamaUrlChange}
              className="w-full rounded-[9px] border border-[#dedbe8] bg-white px-4 py-2 text-sm text-[var(--cv-text)] focus:border-[#6246ea] focus:ring-2 focus:ring-[#6246ea]/20 dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
              placeholder="https://ollama.example.com"
            />
            <p className="mt-2 text-sm text-[var(--cv-muted)]">
              {t('settings.llm.ollamaHelp')}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--cv-muted)]">
              {t('settings.llm.model')}
            </label>
            <select
              value={modelValue}
              onChange={onModelChange}
              className="w-full rounded-[9px] border border-[#dedbe8] bg-white px-4 py-2 text-sm text-[var(--cv-text)] focus:border-[#6246ea] focus:ring-2 focus:ring-[#6246ea]/20 dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
            >
              <option value="">Sélectionner un modèle distant</option>
              {modelOptions.map((model) => (
                <option key={model.value} value={model.value}>{model.label}</option>
              ))}
            </select>
            <p className="mt-2 text-sm text-[var(--cv-muted)]">
              {ollamaDiscoveryLoading
                ? 'Interrogation de l’instance Ollama distante...'
                : modelOptions.length > 0
                  ? `Modèles détectés : ${modelOptions.length}`
                  : 'Aucun modèle détecté sur cette instance.'}
            </p>
          </div>

          {selectedOllamaCapabilities && (
            <div className="grid gap-2 rounded-[9px] border border-[#dedbe8] bg-white p-3 text-sm text-[var(--cv-muted)] dark:border-white/10 dark:bg-[#182235] md:grid-cols-2">
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
          className="app-button-secondary inline-flex min-h-10 items-center rounded-[9px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testingConnection ? 'Test en cours...' : 'Tester le modèle'}
        </button>
      </div>
    </>
  );
}
