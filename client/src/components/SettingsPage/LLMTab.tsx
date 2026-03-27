import { ChangeEvent, useMemo } from 'react';

interface FormData {
  llmProvider: 'openai' | 'anthropic' | 'ollama';
  llmModel: string;
  ollamaBaseUrl?: string;
  ollamaVisionModel?: string;
  ollamaKeepAlive?: string;
  ollamaNumCtx?: number;
  cvMode?: 'nominative' | 'anonymous';
  webglEnabled?: 'on' | 'off';
  [key: string]: string | number | boolean | undefined;
}

interface OllamaModelInfo {
  name: string;
  size?: number | null;
  modifiedAt?: string | null;
}

interface OllamaRuntimeStatus {
  running: boolean;
  activeModel: string | null;
  runningModels: OllamaModelInfo[];
}

interface LLMTabProps {
  formData: FormData;
  onInputChange: (key: string, value: string | number) => void;
  onOllamaPull: () => Promise<void>;
  onOllamaRun: () => Promise<void>;
  onOllamaStop: () => Promise<void>;
  onOllamaRefreshModels: () => Promise<void>;
  onOllamaRefreshStatus: () => Promise<void>;
  ollamaActionLoading?: 'pull' | 'run' | 'stop' | 'refresh' | 'status' | null;
  ollamaModels?: OllamaModelInfo[];
  ollamaRuntimeStatus?: OllamaRuntimeStatus;
  t: (key: string) => string;
}

const OPENAI_MODELS = [
  'gpt-5.4', 'gpt-5.4-pro', 'gpt-5.2', 'gpt-5.2-pro', 'gpt-5.1', 'gpt-5',
  'gpt-4o', 'gpt-4o-mini'
];

const ANTHROPIC_MODELS = [
  'claude-sonnet-4.6',
  'claude-opus-4.6',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022'
];

const OLLAMA_MODEL_SUGGESTIONS = [
  'llama3.2',
  'llama3.1',
  'mistral',
  'qwen2.5',
  'deepseek-r1',
  'llava',
  'llava:13b'
];

const KEEP_ALIVE_OPTIONS = ['1m', '5m', '15m', '1h', '-1'];

const fallbackText = (t: (key: string) => string, key: string, fallback: string): string => {
  const translated = t(key);
  return translated === key ? fallback : translated;
};

const actionButtonClassName = 'inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';

const LLMTab = ({
  formData,
  onInputChange,
  onOllamaPull,
  onOllamaRun,
  onOllamaStop,
  onOllamaRefreshModels,
  onOllamaRefreshStatus,
  ollamaActionLoading,
  ollamaModels = [],
  ollamaRuntimeStatus = { running: false, activeModel: null, runningModels: [] },
  t
}: LLMTabProps): JSX.Element => {
  const provider = formData.llmProvider || 'openai';

  const providerOptions = useMemo(() => ([
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'ollama', label: 'Ollama' }
  ]), []);

  const modelOptions = useMemo(() => {
    if (provider === 'anthropic') {
      return ANTHROPIC_MODELS;
    }
    if (provider === 'ollama') {
      return OLLAMA_MODEL_SUGGESTIONS;
    }
    return OPENAI_MODELS;
  }, [provider]);

  const handleProviderChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const nextProvider = e.target.value as 'openai' | 'anthropic' | 'ollama';
    onInputChange('llmProvider', nextProvider);

    if (nextProvider === 'anthropic' && !ANTHROPIC_MODELS.includes(formData.llmModel)) {
      onInputChange('llmModel', 'claude-sonnet-4.6');
    }

    if (nextProvider === 'openai' && !OPENAI_MODELS.includes(formData.llmModel)) {
      onInputChange('llmModel', 'gpt-4o');
    }

    if (nextProvider === 'ollama') {
      if (!formData.llmModel) {
        onInputChange('llmModel', 'llama3.2');
      }
      if (!formData.ollamaBaseUrl) {
        onInputChange('ollamaBaseUrl', 'http://127.0.0.1:11434');
      }
      if (!formData.ollamaKeepAlive) {
        onInputChange('ollamaKeepAlive', '5m');
      }
      if (!formData.ollamaNumCtx) {
        onInputChange('ollamaNumCtx', 8192);
      }
    }
  };

  const handleModelChange = (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>): void => {
    onInputChange('llmModel', e.target.value);
  };

  const handleCvModeChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    onInputChange('cvMode', e.target.value);
  };

  const handleWebglToggle = (): void => {
    onInputChange('webglEnabled', formData.webglEnabled === 'on' ? 'off' : 'on');
  };

  const handleNumericChange = (field: string) => (e: ChangeEvent<HTMLInputElement>): void => {
    onInputChange(field, Number(e.target.value));
  };

  const handleTextChange = (field: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    onInputChange(field, e.target.value);
  };

  const isModelObsolete = Boolean(formData.llmModel) && !modelOptions.includes(formData.llmModel);
  const hasModelName = Boolean(String(formData.llmModel || '').trim());
  const isBusy = Boolean(ollamaActionLoading);
  const hasLoadedModelList = ollamaModels.length > 0;
  const runningModels = ollamaRuntimeStatus.runningModels || [];
  const hasRunningModels = runningModels.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {fallbackText(t, 'settings.llm.title', 'Modele LLM')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {provider === 'ollama'
            ? fallbackText(t, 'settings.llm.ollamaDescription', 'Configurez le provider local Ollama, son endpoint et les modeles utilises par l application.')
            : fallbackText(t, 'settings.llm.description', 'Selectionnez le provider et le modele LLM a utiliser pour l analyse et l amelioration des CV.')}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {fallbackText(t, 'settings.llm.provider', 'Provider LLM')}
        </label>
        <select
          value={provider}
          onChange={handleProviderChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        >
          {providerOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {provider === 'ollama'
            ? fallbackText(t, 'settings.llm.ollamaModel', 'Modele Ollama principal')
            : fallbackText(t, 'settings.llm.model', 'Modele')}
        </label>
        {provider === 'ollama' ? (
          <input
            type="text"
            value={formData.llmModel}
            onChange={handleModelChange}
            className={`w-full px-4 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 ${
              isModelObsolete ? 'border-yellow-500 dark:border-yellow-400' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="llama3.2"
            autoComplete="off"
            spellCheck={false}
          />
        ) : (
          <select
            value={formData.llmModel}
            onChange={handleModelChange}
            className={`w-full px-4 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 ${
              isModelObsolete ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            {isModelObsolete && (
              <option value={formData.llmModel}>{formData.llmModel}</option>
            )}
            {modelOptions.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        )}
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {fallbackText(t, 'settings.currentModel', 'Modele actuel')} : <span className="font-semibold">{formData.llmModel}</span>
        </p>
        {provider === 'ollama' && (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onOllamaPull()}
                disabled={!hasModelName || isBusy}
                className={actionButtonClassName}
              >
                {ollamaActionLoading === 'pull'
                  ? fallbackText(t, 'settings.llm.ollamaPulling', 'Pull en cours...')
                  : fallbackText(t, 'settings.llm.ollamaPull', 'Pull du modele')}
              </button>
              <button
                type="button"
                onClick={() => void onOllamaRun()}
                disabled={!hasModelName || isBusy}
                className={actionButtonClassName}
              >
                {ollamaActionLoading === 'run'
                  ? fallbackText(t, 'settings.llm.ollamaStarting', 'Chargement...')
                  : fallbackText(t, 'settings.llm.ollamaRun', 'Lancer le modele')}
              </button>
              <button
                type="button"
                onClick={() => void onOllamaStop()}
                disabled={!hasModelName || isBusy}
                className={actionButtonClassName}
              >
                {ollamaActionLoading === 'stop'
                  ? fallbackText(t, 'settings.llm.ollamaStopping', 'Arret...')
                  : fallbackText(t, 'settings.llm.ollamaStop', 'Arreter le modele')}
              </button>
              <button
                type="button"
                onClick={() => void onOllamaRefreshModels()}
                disabled={isBusy}
                className={actionButtonClassName}
              >
                {ollamaActionLoading === 'refresh'
                  ? fallbackText(t, 'settings.llm.ollamaRefreshingModels', 'Actualisation...')
                  : fallbackText(t, 'settings.llm.ollamaRefreshModels', 'Rafraichir les modeles')}
              </button>
            </div>
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {fallbackText(t, 'settings.llm.ollamaRuntimeStatus', 'Etat runtime Ollama')}
                  </p>
                  <p className={`mt-1 text-sm ${ollamaRuntimeStatus.running ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                    {ollamaRuntimeStatus.running
                      ? `${fallbackText(t, 'settings.llm.ollamaRuntimeRunning', 'Modele actif')} : ${ollamaRuntimeStatus.activeModel || fallbackText(t, 'settings.llm.ollamaUnknownModel', 'Inconnu')}`
                      : fallbackText(t, 'settings.llm.ollamaRuntimeStopped', 'Aucun modele Ollama n est actuellement charge.')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onOllamaRefreshStatus()}
                  disabled={isBusy}
                  className={actionButtonClassName}
                >
                  {ollamaActionLoading === 'status'
                    ? fallbackText(t, 'settings.llm.ollamaRefreshingStatus', 'Actualisation...')
                    : fallbackText(t, 'settings.llm.ollamaRefreshStatus', 'Rafraichir l etat')}
                </button>
              </div>
              {hasRunningModels && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {runningModels.map((model) => (
                    <span
                      key={model.name}
                      className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                    >
                      {model.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 rounded-md border border-gray-200 bg-white/70 p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {fallbackText(t, 'settings.llm.ollamaAvailableModels', 'Modeles disponibles dans Ollama')}
              </p>
              {hasLoadedModelList ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {ollamaModels.map((model) => {
                    const isSelected = model.name === formData.llmModel;
                    return (
                      <button
                        key={model.name}
                        type="button"
                        onClick={() => onInputChange('llmModel', model.name)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-100 text-blue-700 dark:border-blue-400 dark:bg-blue-500/20 dark:text-blue-200'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-500'
                        }`}
                      >
                        {model.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {fallbackText(t, 'settings.llm.ollamaNoModelsLoaded', 'Aucun modele liste pour le moment. Utilisez le bouton de rafraichissement pour interroger Ollama.')}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {provider === 'ollama' && (
        <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {fallbackText(t, 'settings.llm.ollamaBaseUrl', 'URL Ollama')}
            </label>
            <input
              type="url"
              value={formData.ollamaBaseUrl || 'http://127.0.0.1:11434'}
              onChange={handleTextChange('ollamaBaseUrl')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              placeholder="http://127.0.0.1:11434"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {fallbackText(t, 'settings.llm.ollamaVisionModel', 'Modele vision Ollama')}
              </label>
              <input
                list="ollama-vision-model-suggestions"
                value={formData.ollamaVisionModel || ''}
                onChange={handleTextChange('ollamaVisionModel')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                placeholder={fallbackText(t, 'settings.llm.ollamaVisionModelPlaceholder', 'Laisser vide pour reutiliser le modele principal')}
              />
              <datalist id="ollama-vision-model-suggestions">
                {['llava', 'llava:13b', 'llama3.2-vision'].map(model => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {fallbackText(t, 'settings.llm.ollamaKeepAlive', 'Keep alive')}
              </label>
              <select
                value={formData.ollamaKeepAlive || '5m'}
                onChange={handleTextChange('ollamaKeepAlive')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              >
                {KEEP_ALIVE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {fallbackText(t, 'settings.llm.ollamaNumCtx', 'Contexte Ollama (tokens)')}
            </label>
            <input
              type="number"
              min={1024}
              step={1024}
              value={formData.ollamaNumCtx || 8192}
              onChange={handleNumericChange('ollamaNumCtx')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {fallbackText(t, 'settings.llm.ollamaHelp', 'Configurez ici l endpoint local, le modele principal, le modele vision optionnel et les options runtime Ollama utilisees par l application.')}
            </p>
          </div>
        </div>
      )}

      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {fallbackText(t, 'settings.llm.cvMode', 'Mode de generation du CV')}
        </label>
        <select
          value={formData.cvMode || 'nominative'}
          onChange={handleCvModeChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        >
          <option value="nominative">{fallbackText(t, 'settings.llm.cvModeNominative', 'Nominatif')}</option>
          <option value="anonymous">{fallbackText(t, 'settings.llm.cvModeAnonymous', 'Anonyme')}</option>
        </select>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {formData.cvMode === 'anonymous'
            ? fallbackText(t, 'settings.llm.cvModeAnonymousDescription', 'Le CV ameliore sera anonymise.')
            : fallbackText(t, 'settings.llm.cvModeNominativeDescription', 'Le CV ameliore conserve les informations nominatives.')}
        </p>
      </div>

      <div className="pt-6 pb-2 border-t border-gray-200 dark:border-gray-700">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.webglEnabled === 'on'}
            onChange={handleWebglToggle}
            className="mt-1 h-5 w-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
          />
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {fallbackText(t, 'settings.llm.webglEnabled', 'Activer les arriere-plans WebGL')}
            </span>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {fallbackText(t, 'settings.llm.webglEnabledDescription', 'Affiche les fonds visuels animes de l application quand le navigateur et l appareil le permettent.')}
            </p>
          </div>
        </label>
      </div>
    </div>
  );
};

export default LLMTab;
