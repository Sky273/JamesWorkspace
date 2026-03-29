import { ChangeEvent, useMemo } from 'react';

interface FormData {
  llmProvider: 'openai' | 'anthropic' | 'deepseek' | 'glm' | 'minimax' | 'ollama';
  llmModel: string;
  ollamaBaseUrl?: string;
  cvMode?: 'nominative' | 'anonymous';
  webglEnabled?: 'on' | 'off';
  [key: string]: string | number | boolean | undefined;
}

interface LLMAvailability {
  [provider: string]: {
    highspeedEnabled?: boolean;
    runtimeUnavailableModels?: string[];
  };
}

interface LLMTabProps {
  formData: FormData;
  onInputChange: (key: string, value: string | number) => void;
  t: (key: string) => string;
  llmAvailability?: LLMAvailability;
}

const OPENAI_MODELS = [
  'gpt-5.4', 'gpt-5.4-pro', 'gpt-5.2', 'gpt-5.2-pro', 'gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano',
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'gpt-4o', 'gpt-4o-mini'
];

const ANTHROPIC_MODELS = [
  'claude-opus-4-1-20250805',
  'claude-opus-4-20250514',
  'claude-sonnet-4-20250514',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022'
];

const DEEPSEEK_MODELS = [
  { value: 'deepseek-chat', label: 'DeepSeek-V3.2 - Standard (API: deepseek-chat)' },
  { value: 'deepseek-reasoner', label: 'DeepSeek-V3.2 - Raisonnement (API: deepseek-reasoner)' }
];

const GLM_MODELS = [
  { value: 'glm-5.1', label: 'GLM-5.1' },
  { value: 'glm-5', label: 'GLM-5' }
];

const MINIMAX_STANDARD_MODELS = [
  'MiniMax-M2.7',
  'MiniMax-M2.5',
  'M2-her',
  'MiniMax-M2.1',
  'MiniMax-M2'
];

const MINIMAX_HIGHSPEED_MODELS = [
  'MiniMax-M2.7-highspeed',
  'MiniMax-M2.5-highspeed',
  'MiniMax-M2.1-highspeed'
];

const fallbackText = (t: (key: string) => string, key: string, fallback: string): string => {
  const translated = t(key);
  return translated === key ? fallback : translated;
};

const LLMTab = ({
  formData,
  onInputChange,
  t,
  llmAvailability
}: LLMTabProps): JSX.Element => {
  const provider = formData.llmProvider || 'openai';
  const minimaxHighspeedEnabled = llmAvailability?.minimax?.highspeedEnabled === true;
  const providerRuntimeUnavailableModels = llmAvailability?.[provider]?.runtimeUnavailableModels || [];
  const minimaxRuntimeUnavailableModels = llmAvailability?.minimax?.runtimeUnavailableModels || [];

  const providerOptions = useMemo(() => ([
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'glm', label: 'GLM (Z.AI)' },
    { value: 'minimax', label: 'MiniMax' },
    { value: 'ollama', label: 'Ollama' }
  ]), []);

  const minimaxModels = useMemo(() => {
    const availableStandardModels = MINIMAX_STANDARD_MODELS.filter(model => !minimaxRuntimeUnavailableModels.includes(model));
    if (minimaxHighspeedEnabled) {
      return [
        ...availableStandardModels,
        ...MINIMAX_HIGHSPEED_MODELS.filter(model => !minimaxRuntimeUnavailableModels.includes(model))
      ];
    }
    return availableStandardModels;
  }, [minimaxHighspeedEnabled, minimaxRuntimeUnavailableModels]);

  const modelOptions = useMemo(() => {
    if (provider === 'anthropic') {
      return ANTHROPIC_MODELS.filter(model => !providerRuntimeUnavailableModels.includes(model));
    }
    if (provider === 'deepseek') {
      return DEEPSEEK_MODELS.filter(model => !providerRuntimeUnavailableModels.includes(model.value));
    }
    if (provider === 'glm') {
      return GLM_MODELS.filter(model => !providerRuntimeUnavailableModels.includes(model.value));
    }
    if (provider === 'minimax') {
      return minimaxModels;
    }
    return OPENAI_MODELS.filter(model => !providerRuntimeUnavailableModels.includes(model));
  }, [provider, minimaxModels, providerRuntimeUnavailableModels]);

  const handleProviderChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const nextProvider = e.target.value as 'openai' | 'anthropic' | 'deepseek' | 'glm' | 'minimax' | 'ollama';
    onInputChange('llmProvider', nextProvider);

    if (nextProvider === 'anthropic' && !ANTHROPIC_MODELS.includes(formData.llmModel)) {
      onInputChange('llmModel', 'claude-sonnet-4-20250514');
    }

    if (nextProvider === 'deepseek' && !DEEPSEEK_MODELS.some(model => model.value === formData.llmModel)) {
      onInputChange('llmModel', 'deepseek-chat');
    }

    if (nextProvider === 'glm' && !GLM_MODELS.some(model => model.value === formData.llmModel)) {
      onInputChange('llmModel', 'glm-5.1');
    }

    if (nextProvider === 'minimax' && !minimaxModels.includes(formData.llmModel)) {
      onInputChange('llmModel', 'MiniMax-M2.7');
    }

    if (nextProvider === 'openai' && !OPENAI_MODELS.includes(formData.llmModel)) {
      onInputChange('llmModel', 'gpt-4o');
    }

    if (nextProvider === 'ollama' && !formData.ollamaBaseUrl) {
      onInputChange('ollamaBaseUrl', '');
    }
  };

  const handleModelChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    onInputChange('llmModel', e.target.value);
  };

  const currentModelLabel = useMemo(() => {
    if (provider === 'deepseek') {
      return DEEPSEEK_MODELS.find(model => model.value === formData.llmModel)?.label || formData.llmModel;
    }
    if (provider === 'glm') {
      return GLM_MODELS.find(model => model.value === formData.llmModel)?.label || formData.llmModel;
    }
    return formData.llmModel;
  }, [provider, formData.llmModel]);

  const handleCvModeChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    onInputChange('cvMode', e.target.value);
  };

  const handleWebglToggle = (): void => {
    onInputChange('webglEnabled', formData.webglEnabled === 'on' ? 'off' : 'on');
  };

  const handleTextChange = (field: string) => (e: ChangeEvent<HTMLInputElement>): void => {
    onInputChange(field, e.target.value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {fallbackText(t, 'settings.llm.title', 'Modele LLM')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {provider === 'ollama'
            ? fallbackText(t, 'settings.llm.ollamaDescription', 'Configurez uniquement l adresse de votre hote Ollama. Le modele actif sera detecte automatiquement sur votre machine.')
            : provider === 'deepseek'
              ? fallbackText(t, 'settings.llm.deepseekDescription', 'Selectionnez le mode API DeepSeek a utiliser. Les identifiants appeles restent deepseek-chat et deepseek-reasoner, tous deux mappes sur DeepSeek-V3.2 cote API.')
              : provider === 'glm'
                ? fallbackText(t, 'settings.llm.glmDescription', 'Selectionnez un modele GLM. L application utilisera l API OpenAI-compatible de Z.AI cote serveur.')
              : provider === 'minimax'
                ? fallbackText(t, 'settings.llm.minimaxDescription', 'Selectionnez un modele MiniMax. L application utilisera l API MiniMax cote serveur.')
                : fallbackText(t, 'settings.llm.description', 'Selectionnez le provider et le modele LLM a utiliser pour l analyse et l amelioration des CV.')}
        </p>
        {provider === 'minimax' && !minimaxHighspeedEnabled && (
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
            {fallbackText(t, 'settings.llm.minimaxHighspeedDisabled', 'Les modeles MiniMax highspeed sont masques car cette instance n active pas le plan Highspeed.')}
          </p>
        )}
        {providerRuntimeUnavailableModels.length > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
            {provider === 'minimax'
              ? fallbackText(t, 'settings.llm.minimaxRuntimeUnavailable', 'Certains modeles MiniMax sont temporairement masques car l upstream les a refuses pour cette instance.')
              : fallbackText(t, 'settings.llm.runtimeUnavailable', 'Certains modeles de ce provider sont temporairement masques car l upstream les a refuses pour cette instance.')}{' '}
            <span className="font-medium">{providerRuntimeUnavailableModels.join(', ')}</span>
          </p>
        )}
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
            {modelOptions.map(model => {
              if (typeof model === 'string') {
                return <option key={model} value={model}>{model}</option>;
              }
              return <option key={model.value} value={model.value}>{model.label}</option>;
            })}
          </select>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {fallbackText(t, 'settings.currentModel', 'Modele actuel')} : <span className="font-semibold">{currentModelLabel}</span>
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
              value={formData.ollamaBaseUrl || ''}
              onChange={handleTextChange('ollamaBaseUrl')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              placeholder="https://ollama.example.com"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {fallbackText(t, 'settings.llm.ollamaHelp', 'Renseignez l URL complete de votre instance Ollama distante. Le modele actif sera utilise automatiquement.')}
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
