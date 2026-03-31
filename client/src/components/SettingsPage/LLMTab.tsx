import { ChangeEvent, useMemo } from 'react';
import LLMProviderModelSection from './LLMProviderModelSection';
import LLMPresentationPreferences from './LLMPresentationPreferences';

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

  const minimaxModels = useMemo(() => {
    const availableStandardModels = MINIMAX_STANDARD_MODELS.filter(
      (model) => !minimaxRuntimeUnavailableModels.includes(model)
    );

    if (minimaxHighspeedEnabled) {
      return [
        ...availableStandardModels,
        ...MINIMAX_HIGHSPEED_MODELS.filter((model) => !minimaxRuntimeUnavailableModels.includes(model))
      ];
    }

    return availableStandardModels;
  }, [minimaxHighspeedEnabled, minimaxRuntimeUnavailableModels]);

  const modelOptions = useMemo(() => {
    if (provider === 'anthropic') {
      return ANTHROPIC_MODELS
        .filter((model) => !providerRuntimeUnavailableModels.includes(model))
        .map((model) => ({ value: model, label: model }));
    }

    if (provider === 'deepseek') {
      return DEEPSEEK_MODELS.filter((model) => !providerRuntimeUnavailableModels.includes(model.value));
    }

    if (provider === 'glm') {
      return GLM_MODELS.filter((model) => !providerRuntimeUnavailableModels.includes(model.value));
    }

    if (provider === 'minimax') {
      return minimaxModels.map((model) => ({ value: model, label: model }));
    }

    return OPENAI_MODELS
      .filter((model) => !providerRuntimeUnavailableModels.includes(model))
      .map((model) => ({ value: model, label: model }));
  }, [provider, minimaxModels, providerRuntimeUnavailableModels]);

  const handleProviderChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const nextProvider = event.target.value as FormData['llmProvider'];
    onInputChange('llmProvider', nextProvider);

    if (nextProvider === 'anthropic' && !ANTHROPIC_MODELS.includes(formData.llmModel)) {
      onInputChange('llmModel', 'claude-sonnet-4-20250514');
    }

    if (nextProvider === 'deepseek' && !DEEPSEEK_MODELS.some((model) => model.value === formData.llmModel)) {
      onInputChange('llmModel', 'deepseek-chat');
    }

    if (nextProvider === 'glm' && !GLM_MODELS.some((model) => model.value === formData.llmModel)) {
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
    if (provider === 'deepseek') {
      return DEEPSEEK_MODELS.find((model) => model.value === formData.llmModel)?.label || formData.llmModel;
    }
    if (provider === 'glm') {
      return GLM_MODELS.find((model) => model.value === formData.llmModel)?.label || formData.llmModel;
    }
    return formData.llmModel;
  }, [formData.llmModel, provider]);

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
