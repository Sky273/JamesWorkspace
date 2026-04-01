import { ChangeEvent, useMemo, useState } from 'react';
import LLMProviderModelSection from './LLMProviderModelSection';
import LLMPresentationPreferences from './LLMPresentationPreferences';

interface FormData {
  llmProvider: 'openai' | 'anthropic' | 'deepseek' | 'glm' | 'minimax' | 'ollama';
  llmModel: string;
  ollamaBaseUrl?: string;
  llmModelParametersJson?: string;
  cvMode?: 'nominative' | 'anonymous';
  webglEnabled?: 'on' | 'off';
}

interface LLMAvailability {
  [provider: string]: {
    highspeedEnabled?: boolean;
    runtimeUnavailableModels?: string[];
  };
}

interface ModelOption {
  value: string;
  label: string;
}

interface ParameterDefinition {
  key: string;
  type: 'number' | 'integer' | 'string' | 'boolean' | 'enum' | 'object' | 'array' | 'union';
  label: string;
  min?: number;
  max?: number;
  maxInclusive?: number;
  maxExclusive?: number;
  step?: number;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>;
  itemType?: string;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;

const OLLAMA_GLOBAL_KEY = '__global__';

interface LLMTabProps {
  formData: FormData;
  onInputChange: (key: string, value: string | number) => void;
  t: (key: string) => string;
  llmAvailability?: LLMAvailability;
  llmModelCatalog?: Record<string, ModelOption[]>;
  llmParameterDefinitions?: Record<string, Record<string, Record<string, ParameterDefinition>>>;
  ollamaDiscoveryLoading?: boolean;
  ollamaModelCapabilities?: Record<string, {
    family: string | null;
    format: string | null;
    parameterSize: string | null;
    quantizationLevel: string | null;
    contextLength: number | null;
    architecture: string | null;
  }>;
}

const LLMTab = ({
  formData,
  onInputChange,
  t,
  llmAvailability,
  llmModelCatalog,
  llmParameterDefinitions,
  ollamaDiscoveryLoading,
  ollamaModelCapabilities,
}: LLMTabProps): JSX.Element => {
  const [jsonValidationState, setJsonValidationState] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [advancedJsonOpen, setAdvancedJsonOpen] = useState(false);
  const provider = formData.llmProvider || 'openai';
  const minimaxHighspeedEnabled = llmAvailability?.minimax?.highspeedEnabled === true;
  const providerRuntimeUnavailableModels = useMemo(
    () => llmAvailability?.[provider]?.runtimeUnavailableModels || [],
    [llmAvailability, provider]
  );
  const providerCatalog = useMemo(() => llmModelCatalog || {}, [llmModelCatalog]);
  const parameterDefinitions = useMemo(() => llmParameterDefinitions || {}, [llmParameterDefinitions]);

  const providerOptions = useMemo(
    () => [
      { value: 'openai', label: 'OpenAI' },
      { value: 'anthropic', label: 'Anthropic' },
      { value: 'deepseek', label: 'DeepSeek' },
      { value: 'glm', label: 'GLM (Z.AI)' },
      { value: 'minimax', label: 'MiniMax' },
      { value: 'ollama', label: 'Ollama' }
    ],
    []
  );

  const modelOptions = useMemo(() => {
    const availableCatalog = providerCatalog[provider] || [];
    return availableCatalog.filter((model) => !providerRuntimeUnavailableModels.includes(model.value));
  }, [provider, providerCatalog, providerRuntimeUnavailableModels]);

  const handleProviderChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const nextProvider = event.target.value as FormData['llmProvider'];
    onInputChange('llmProvider', nextProvider);
    const nextProviderModels = providerCatalog[nextProvider] || [];
    const isCurrentModelAvailable = nextProviderModels.some((model) => model.value === formData.llmModel);
    if (!isCurrentModelAvailable && nextProviderModels[0]) {
      onInputChange('llmModel', nextProviderModels[0].value);
    }
  };

  const handleModelChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    onInputChange('llmModel', event.target.value);
  };

  const handleCvModeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    onInputChange('cvMode', event.target.value);
  };

  const handleWebglToggle = (): void => {
    onInputChange('webglEnabled', formData.webglEnabled === 'on' ? 'off' : 'on');
  };

  const handleTextChange = (field: string) => (event: ChangeEvent<HTMLInputElement>): void => {
    onInputChange(field, event.target.value);
  };

  const currentModelLabel = useMemo(() => {
    return modelOptions.find((model) => model.value === formData.llmModel)?.label || formData.llmModel;
  }, [formData.llmModel, modelOptions]);

  const providerDescription =
    provider === 'ollama'
      ? t('settings.llm.ollamaDescription')
      : provider === 'deepseek'
        ? t('settings.llm.deepseekDescription')
        : provider === 'glm'
          ? t('settings.llm.glmDescription')
          : provider === 'minimax'
            ? t('settings.llm.minimaxDescription')
            : t('settings.llm.description');

  const fallbackText = (key: string, fallback: string): string => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const jsonPlaceholder = useMemo(() => {
    const modelKey = formData.llmModel || (provider === 'ollama' ? 'remote-model' : 'model');
    return `{\n  "${provider}": {\n    "${modelKey}": {\n      "temperature": 0,\n      "top_p": 1\n    }\n  }\n}`;
  }, [formData.llmModel, provider]);
  const exampleJson = useMemo(() => {
    const modelKey = formData.llmModel || (provider === 'ollama' ? 'remote-model' : 'model');
    const examplePayload =
      provider === 'ollama'
        ? {
            [provider]: {
              __global__: {
                keep_alive: '5m'
              },
              [modelKey]: {
                num_ctx: 8192,
                temperature: 0.2,
                top_k: 40
              }
            }
          }
        : {
            [provider]: {
              [modelKey]: {
                temperature: 0,
                top_p: 1,
                max_tokens: 4096
              }
            }
          };

    return JSON.stringify(examplePayload, null, 2);
  }, [formData.llmModel, provider]);
  const jsonValue = formData.llmModelParametersJson || '{}';
  const parsedJsonObject = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonValue) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      return parsed as JsonRecord;
    } catch {
      return {};
    }
  }, [jsonValue]);
  const parsedJsonStatus = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonValue) as unknown;
      const isPlainObject = Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
      return {
        valid: isPlainObject,
        formatted: isPlainObject ? JSON.stringify(parsed, null, 2) : null,
      };
    } catch {
      return {
        valid: false,
        formatted: null,
      };
    }
  }, [jsonValue]);

  const ollamaGlobalDefinitions = useMemo(
    () => parameterDefinitions.ollama?.[OLLAMA_GLOBAL_KEY] || {},
    [parameterDefinitions]
  );
  const ollamaModelDefinitions = useMemo(
    () => parameterDefinitions.ollama?.[formData.llmModel] || {},
    [formData.llmModel, parameterDefinitions]
  );

  const ollamaGlobalParameters = useMemo(() => {
    const providerParams = parsedJsonObject.ollama;
    if (!providerParams || typeof providerParams !== 'object' || Array.isArray(providerParams)) {
      return {};
    }
    const value = (providerParams as JsonRecord)[OLLAMA_GLOBAL_KEY];
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
  }, [parsedJsonObject]);

  const ollamaModelParameters = useMemo(() => {
    const providerParams = parsedJsonObject.ollama;
    if (!providerParams || typeof providerParams !== 'object' || Array.isArray(providerParams)) {
      return {};
    }
    const value = formData.llmModel ? (providerParams as JsonRecord)[formData.llmModel] : undefined;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
  }, [formData.llmModel, parsedJsonObject]);

  const updateJsonObject = (updater: (current: JsonRecord) => JsonRecord): void => {
    const nextObject = updater(parsedJsonObject);
    handleJsonChange(JSON.stringify(nextObject, null, 2));
    setJsonValidationState('valid');
  };

  const updateOllamaSectionField = (
    sectionKey: string,
    fieldKey: string,
    nextValue: JsonValue | undefined
  ): void => {
    updateJsonObject((current) => {
      const currentProvider = current.ollama && typeof current.ollama === 'object' && !Array.isArray(current.ollama)
        ? { ...(current.ollama as JsonRecord) }
        : {};
      const currentSection = currentProvider[sectionKey] && typeof currentProvider[sectionKey] === 'object' && !Array.isArray(currentProvider[sectionKey])
        ? { ...(currentProvider[sectionKey] as JsonRecord) }
        : {};

      if (nextValue === undefined || nextValue === '' || nextValue === null) {
        delete currentSection[fieldKey];
      } else {
        currentSection[fieldKey] = nextValue;
      }

      if (Object.keys(currentSection).length === 0) {
        delete currentProvider[sectionKey];
      } else {
        currentProvider[sectionKey] = currentSection;
      }

      const nextRoot = { ...current };
      if (Object.keys(currentProvider).length === 0) {
        delete nextRoot.ollama;
      } else {
        nextRoot.ollama = currentProvider;
      }

      return nextRoot;
    });
  };

  const renderOllamaField = (
    scopeLabel: string,
    sectionKey: string,
    definition: ParameterDefinition,
    currentValue: JsonValue | undefined
  ): JSX.Element => {
    const inputId = `ollama-${scopeLabel}-${sectionKey}-${definition.key}`;

    if (definition.type === 'boolean') {
      return (
        <label key={inputId} htmlFor={inputId} className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
          <span className="font-medium text-gray-800 dark:text-gray-100">{definition.label}</span>
          <input
            id={inputId}
            type="checkbox"
            checked={currentValue === true}
            onChange={(event) => updateOllamaSectionField(sectionKey, definition.key, event.target.checked ? true : undefined)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </label>
      );
    }

    if (definition.type === 'enum' && definition.options) {
      return (
        <label key={inputId} htmlFor={inputId} className="block space-y-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{definition.label}</span>
          <select
            id={inputId}
            value={typeof currentValue === 'string' ? currentValue : ''}
            onChange={(event) => updateOllamaSectionField(sectionKey, definition.key, event.target.value || undefined)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">Utiliser la valeur par defaut</option>
            {definition.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      );
    }

    if (definition.type === 'array') {
      return (
        <label key={inputId} htmlFor={inputId} className="block space-y-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{definition.label}</span>
          <input
            id={inputId}
            type="text"
            value={Array.isArray(currentValue) ? currentValue.join(', ') : ''}
            onChange={(event) => {
              const values = event.target.value
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean);
              updateOllamaSectionField(sectionKey, definition.key, values.length > 0 ? values : undefined);
            }}
            placeholder="value1, value2"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </label>
      );
    }

    const inputType = definition.type === 'number' || definition.type === 'integer' ? 'number' : 'text';
    const inputValue = typeof currentValue === 'string' || typeof currentValue === 'number'
      ? String(currentValue)
      : '';

    return (
      <label key={inputId} htmlFor={inputId} className="block space-y-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{definition.label}</span>
        <input
          id={inputId}
          type={inputType}
          value={inputValue}
          min={definition.min}
          max={definition.max ?? definition.maxInclusive}
          step={definition.step ?? (definition.type === 'integer' ? 1 : 'any')}
          onChange={(event) => {
            const rawValue = event.target.value;
            if (!rawValue.trim()) {
              updateOllamaSectionField(sectionKey, definition.key, undefined);
              return;
            }

            if (definition.type === 'number' || definition.type === 'integer') {
              const numericValue = definition.type === 'integer' ? parseInt(rawValue, 10) : Number(rawValue);
              updateOllamaSectionField(sectionKey, definition.key, Number.isFinite(numericValue) ? numericValue : undefined);
              return;
            }

            updateOllamaSectionField(sectionKey, definition.key, rawValue);
          }}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </label>
    );
  };

  const handleJsonChange = (value: string): void => {
    setJsonValidationState('idle');
    onInputChange('llmModelParametersJson', value);
  };

  const handleFormatJson = (): void => {
    if (!parsedJsonStatus.valid || !parsedJsonStatus.formatted) {
      setJsonValidationState('invalid');
      return;
    }

    handleJsonChange(parsedJsonStatus.formatted);
    setJsonValidationState('valid');
  };

  const handleValidateJson = (): void => {
    setJsonValidationState(parsedJsonStatus.valid ? 'valid' : 'invalid');
  };

  const handleInjectExample = (): void => {
    handleJsonChange(exampleJson);
    setJsonValidationState('valid');
  };

  const handleResetJson = (): void => {
    handleJsonChange('{}');
    setJsonValidationState('idle');
  };

  return (
    <div className="space-y-6">
      <LLMProviderModelSection
        provider={provider}
        providerDescription={providerDescription}
        providerOptions={providerOptions}
        providerRuntimeUnavailableModels={providerRuntimeUnavailableModels}
        minimaxHighspeedEnabled={minimaxHighspeedEnabled}
        modelValue={formData.llmModel}
        modelOptions={modelOptions}
        currentModelLabel={currentModelLabel}
        ollamaBaseUrl={formData.ollamaBaseUrl}
        onProviderChange={handleProviderChange}
        onModelChange={handleModelChange}
        onOllamaUrlChange={handleTextChange('ollamaBaseUrl')}
        ollamaDiscoveryLoading={ollamaDiscoveryLoading}
        ollamaModelCapabilities={ollamaModelCapabilities}
        t={t}
      />

      {provider === 'ollama' && (
        <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Parametres Ollama
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Cette vue pilote le JSON de configuration Ollama. Les valeurs globales s appliquent a tous les modeles,
              puis les valeurs du modele distant selectionne viennent les completer.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-md border border-emerald-200/80 bg-white/70 p-4 dark:border-emerald-900/70 dark:bg-gray-900/40">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Parametres globaux</h4>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Stockes sous `ollama.__global__`.</p>
              </div>
              <div className="grid gap-3">
                {Object.values(ollamaGlobalDefinitions).map((definition) => renderOllamaField('global', OLLAMA_GLOBAL_KEY, definition, ollamaGlobalParameters[definition.key]))}
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-emerald-200/80 bg-white/70 p-4 dark:border-emerald-900/70 dark:bg-gray-900/40">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Parametres du modele</h4>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {formData.llmModel
                    ? `Stockes sous \`ollama.${formData.llmModel}\`.`
                    : 'Selectionnez d abord un modele distant.'}
                </p>
              </div>
              {formData.llmModel ? (
                <div className="grid gap-3">
                  {Object.values(ollamaModelDefinitions).map((definition) => renderOllamaField('model', formData.llmModel, definition, ollamaModelParameters[definition.key]))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Aucun modele Ollama selectionne.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/40">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              JSON avance
            </h3>
            <button
              type="button"
              onClick={() => setAdvancedJsonOpen((current) => !current)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              {advancedJsonOpen ? 'Masquer le JSON' : 'Afficher le JSON'}
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Ce JSON definit les valeurs par defaut par provider et modele. Pour Ollama, utilisez `ollama.__global__`
            pour les defaults globaux et `ollama.nom-du-modele` pour les overrides par modele. Il est sanitize et
            normalise cote serveur avant persistance puis applique aux appels LLM.
          </p>
        </div>

        {advancedJsonOpen && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleFormatJson}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
              >
                Formatter
              </button>
              <button
                type="button"
                onClick={handleValidateJson}
                className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50"
              >
                Valider
              </button>
              <button
                type="button"
                onClick={handleInjectExample}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
              >
                Injecter un exemple
              </button>
              <button
                type="button"
                onClick={handleResetJson}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
              >
                Reinitialiser
              </button>
              <span
                className={`text-sm ${
                  jsonValidationState === 'valid'
                    ? 'text-green-700 dark:text-green-300'
                    : jsonValidationState === 'invalid'
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {jsonValidationState === 'valid'
                  ? 'JSON valide'
                  : jsonValidationState === 'invalid'
                    ? 'JSON invalide'
                    : 'Validation locale avant sauvegarde'}
              </span>
            </div>

            <textarea
              value={jsonValue}
              onChange={(event) => handleJsonChange(event.target.value)}
              rows={18}
              spellCheck={false}
              className="w-full rounded-md border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              placeholder={jsonPlaceholder}
            />
          </>
        )}
      </div>

      <LLMPresentationPreferences
        cvMode={formData.cvMode}
        webglEnabled={formData.webglEnabled}
        onCvModeChange={handleCvModeChange}
        onWebglToggle={handleWebglToggle}
        t={t}
        fallbackText={fallbackText}
      />
    </div>
  );
};

export default LLMTab;
