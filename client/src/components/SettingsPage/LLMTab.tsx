import { ChangeEvent, useMemo } from 'react';

interface FormData {
  llmProvider: 'openai' | 'anthropic' | 'ollama';
  llmModel: string;
  ollamaBaseUrl?: string;
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
  onOllamaRefreshModels: () => Promise<void>;
  onOllamaRefreshStatus: () => Promise<void>;
  ollamaActionLoading?: 'refresh' | 'status' | null;
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

const fallbackText = (t: (key: string) => string, key: string, fallback: string): string => {
  const translated = t(key);
  return translated === key ? fallback : translated;
};

const actionButtonClassName = 'inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';

const LLMTab = ({
  formData,
  onInputChange,
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

    if (nextProvider === 'ollama' && !formData.ollamaBaseUrl) {
      onInputChange('ollamaBaseUrl', 'http://host.docker.internal:11434');
    }
  };

  const handleModelChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    onInputChange('llmModel', e.target.value);
  };

  const handleCvModeChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    onInputChange('cvMode', e.target.value);
  };

  const handleWebglToggle = (): void => {
    onInputChange('webglEnabled', formData.webglEnabled === 'on' ? 'off' : 'on');
  };

  const handleTextChange = (field: string) => (e: ChangeEvent<HTMLInputElement>): void => {
    onInputChange(field, e.target.value);
  };

  const runningModels = ollamaRuntimeStatus.runningModels || [];
  const hasLoadedModelList = ollamaModels.length > 0;
  const isBusy = Boolean(ollamaActionLoading);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {fallbackText(t, 'settings.llm.title', 'Modele LLM')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {provider === 'ollama'
            ? fallbackText(t, 'settings.llm.ollamaDescription', 'Configurez uniquement l adresse de votre hote Ollama. Le modele actif sera detecte automatiquement sur votre machine.')
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

      {provider !== 'ollama' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {fallbackText(t, 'settings.llm.model', 'Modele')}
          </label>
          <select
            value={formData.llmModel}
            onChange={handleModelChange}
            className="w-full px-4 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
          >
            {modelOptions.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {fallbackText(t, 'settings.currentModel', 'Modele actuel')} : <span className="font-semibold">{formData.llmModel}</span>
          </p>
        </div>
      )}

      {provider === 'ollama' && (
        <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {fallbackText(t, 'settings.llm.ollamaBaseUrl', 'URL Ollama')}
            </label>
            <input
              type="url"
              value={formData.ollamaBaseUrl || 'http://host.docker.internal:11434'}
              onChange={handleTextChange('ollamaBaseUrl')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              placeholder="http://host.docker.internal:11434"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {fallbackText(t, 'settings.llm.ollamaHelp', 'Si l application tourne en Docker et Ollama sur votre PC, utilisez http://host.docker.internal:11434. Le modele actif sera utilise automatiquement.')}
            </p>
          </div>

          <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
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
            {runningModels.length > 0 && (
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

          <div className="rounded-md border border-gray-200 bg-white/70 p-3 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {fallbackText(t, 'settings.llm.ollamaAvailableModels', 'Modeles disponibles dans Ollama')}
              </p>
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
            {hasLoadedModelList ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {ollamaModels.map((model) => (
                  <span
                    key={model.name}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${model.name === ollamaRuntimeStatus.activeModel ? 'border-blue-500 bg-blue-100 text-blue-700 dark:border-blue-400 dark:bg-blue-500/20 dark:text-blue-200' : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'}`}
                  >
                    {model.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {fallbackText(t, 'settings.llm.ollamaNoModelsLoaded', 'Aucun modele liste pour le moment. Utilisez le bouton de rafraichissement pour interroger Ollama.')}
              </p>
            )}
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
