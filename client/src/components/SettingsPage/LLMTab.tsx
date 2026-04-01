import { ChangeEvent, useMemo } from 'react';
import LLMProviderModelSection from './LLMProviderModelSection';
import LLMModelParametersSection from './LLMModelParametersSection';
import LLMPresentationPreferences from './LLMPresentationPreferences';

interface ParameterOption {
  value: string;
  label: string;
}

interface ParameterDefinition {
  key: string;
  type: 'integer' | 'number' | 'string' | 'enum';
  label: string;
  min?: number;
  max?: number;
  maxInclusive?: number;
  maxExclusive?: number;
  step?: number;
  defaultValue?: string | number;
  helpText?: string;
  options?: ParameterOption[];
}

interface FormData {
  llmProvider: 'openai' | 'anthropic' | 'deepseek' | 'glm' | 'minimax' | 'ollama';
  llmModel: string;
  ollamaBaseUrl?: string;
  llmModelParameters?: Record<string, Record<string, Record<string, string | number>>>;
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

interface LLMTabProps {
  formData: FormData;
  onInputChange: (
    key: string,
    value:
      | string
      | number
      | Record<string, Record<string, Record<string, string | number>>>
  ) => void;
  t: (key: string) => string;
  llmAvailability?: LLMAvailability;
  llmModelCatalog?: Record<string, ModelOption[]>;
  llmParameterDefinitions?: Record<string, Record<string, Record<string, ParameterDefinition>>>;
}

const LLMTab = ({
  formData,
  onInputChange,
  t,
  llmAvailability,
  llmModelCatalog,
  llmParameterDefinitions,
}: LLMTabProps): JSX.Element => {
  const provider = formData.llmProvider || 'openai';
  const minimaxHighspeedEnabled = llmAvailability?.minimax?.highspeedEnabled === true;
  const providerRuntimeUnavailableModels = useMemo(
    () => llmAvailability?.[provider]?.runtimeUnavailableModels || [],
    [llmAvailability, provider]
  );
  const providerCatalog = useMemo(() => llmModelCatalog || {}, [llmModelCatalog]);

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
    if (nextProvider !== 'ollama' && !isCurrentModelAvailable && nextProviderModels[0]) {
      onInputChange('llmModel', nextProviderModels[0].value);
    }

    if (nextProvider === 'ollama' && !formData.ollamaBaseUrl) {
      onInputChange('ollamaBaseUrl', '');
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

  const selectedModelKey = provider === 'ollama' ? '__default__' : formData.llmModel;
  const selectedParameterDefinitions = useMemo(
    () => llmParameterDefinitions?.[provider]?.[selectedModelKey] || {},
    [llmParameterDefinitions, provider, selectedModelKey]
  );
  const selectedParameterValues = useMemo(
    () => formData.llmModelParameters?.[provider]?.[selectedModelKey] || {},
    [formData.llmModelParameters, provider, selectedModelKey]
  );

  const handleParameterChange = (parameterKey: string, value: string | number): void => {
    const nextParameters = {
      ...(formData.llmModelParameters || {}),
      [provider]: {
        ...((formData.llmModelParameters || {})[provider] || {}),
        [selectedModelKey]: {
          ...selectedParameterValues,
          [parameterKey]: value,
        },
      },
    };
    onInputChange('llmModelParameters', nextParameters);
  };

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
        t={t}
      />

      <LLMModelParametersSection
        modelLabel={provider === 'ollama' ? 'Ollama runtime defaults' : (currentModelLabel || formData.llmModel)}
        parameterDefinitions={selectedParameterDefinitions}
        values={selectedParameterValues}
        onParameterChange={handleParameterChange}
      />

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
