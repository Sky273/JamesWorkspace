import { ChangeEvent, useMemo, useState } from 'react';
import LLMProviderModelSection from './LLMProviderModelSection';
import LLMPresentationPreferences from './LLMPresentationPreferences';
import { AdvancedJsonEditorSection, OllamaParametersSection } from './LLMTab.sections';
import { OLLAMA_GLOBAL_KEY, type FormData, type JsonRecord, type JsonValue, type LLMTabProps } from './LLMTab.types';
import {
  fallbackText,
  getExampleJson,
  getJsonObjectSection,
  getJsonPlaceholder,
  getParsedJsonStatus,
  getProviderDescription,
  parseJsonRecord,
  updateProviderSection,
} from './LLMTab.utils';

const LLMTab = ({
  formData,
  onInputChange,
  onTestConnection,
  testingConnection,
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
      { value: 'huggingface', label: 'Hugging Face' },
      { value: 'gemma', label: 'Gemma Cloud' },
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

  const handleModelTextChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onInputChange('llmModel', event.target.value);
  };

  const handleCvModeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    onInputChange('cvMode', event.target.value);
  };

  const handleWebglToggle = (): void => {
    onInputChange('webglEnabled', formData.webglEnabled === 'on' ? 'off' : 'on');
  };

  const handleRegistrationApprovalToggle = (): void => {
    onInputChange(
      'allowUserRegistrationWithoutApproval',
      formData.allowUserRegistrationWithoutApproval !== true
    );
  };

  const handleTextChange = (field: string) => (event: ChangeEvent<HTMLInputElement>): void => {
    onInputChange(field, event.target.value);
  };

  const currentModelLabel = useMemo(() => {
    return modelOptions.find((model) => model.value === formData.llmModel)?.label || formData.llmModel;
  }, [formData.llmModel, modelOptions]);

  const providerDescription = getProviderDescription(provider, t);
  const getFallbackText = (key: string, fallback: string): string => fallbackText(t, key, fallback);
  const jsonPlaceholder = useMemo(() => getJsonPlaceholder(provider, formData.llmModel), [formData.llmModel, provider]);
  const exampleJson = useMemo(() => getExampleJson(provider, formData.llmModel), [formData.llmModel, provider]);
  const jsonValue = formData.llmModelParametersJson || '{}';
  const parsedJsonObject = useMemo(() => parseJsonRecord(jsonValue), [jsonValue]);
  const parsedJsonStatus = useMemo(() => getParsedJsonStatus(jsonValue), [jsonValue]);

  const ollamaGlobalDefinitions = useMemo(
    () => parameterDefinitions.ollama?.[OLLAMA_GLOBAL_KEY] || {},
    [parameterDefinitions]
  );
  const ollamaModelDefinitions = useMemo(
    () => parameterDefinitions.ollama?.[formData.llmModel] || {},
    [formData.llmModel, parameterDefinitions]
  );

  const ollamaGlobalParameters = useMemo(() => {
    return getJsonObjectSection(parsedJsonObject, 'ollama', OLLAMA_GLOBAL_KEY);
  }, [parsedJsonObject]);

  const ollamaModelParameters = useMemo(() => {
    return formData.llmModel ? getJsonObjectSection(parsedJsonObject, 'ollama', formData.llmModel) : {};
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
      return updateProviderSection(current, 'ollama', sectionKey, fieldKey, nextValue);
    });
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
        onModelTextChange={handleModelTextChange}
        onOllamaUrlChange={handleTextChange('ollamaBaseUrl')}
        onTestConnection={onTestConnection}
        testingConnection={testingConnection}
        ollamaDiscoveryLoading={ollamaDiscoveryLoading}
        ollamaModelCapabilities={ollamaModelCapabilities}
        t={t}
      />

      {provider === 'ollama' && (
        <OllamaParametersSection
          currentModel={formData.llmModel}
          globalDefinitions={ollamaGlobalDefinitions}
          modelDefinitions={ollamaModelDefinitions}
          globalParameters={ollamaGlobalParameters}
          modelParameters={ollamaModelParameters}
          onFieldChange={updateOllamaSectionField}
        />
      )}

      <AdvancedJsonEditorSection
        advancedJsonOpen={advancedJsonOpen}
        jsonPlaceholder={jsonPlaceholder}
        jsonValidationState={jsonValidationState}
        jsonValue={jsonValue}
        onFormatJson={handleFormatJson}
        onInjectExample={handleInjectExample}
        onResetJson={handleResetJson}
        onToggleOpen={() => setAdvancedJsonOpen((current) => !current)}
        onValidateJson={handleValidateJson}
        onValueChange={handleJsonChange}
      />

      <LLMPresentationPreferences
        cvMode={formData.cvMode}
        webglEnabled={formData.webglEnabled}
        onCvModeChange={handleCvModeChange}
        onWebglToggle={handleWebglToggle}
        t={t}
        fallbackText={getFallbackText}
      />

      <section className="rounded-3xl border border-white/10 bg-slate-950/10 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">
              {getFallbackText(
                'settings.llm.allowUserRegistrationWithoutApprovalLabel',
                "Autoriser l'enregistrement des utilisateurs sans validation préalable"
              )}
            </h3>
            <p className="max-w-3xl text-sm text-slate-300">
              {getFallbackText(
                'settings.llm.allowUserRegistrationWithoutApprovalDescription',
                "Quand cette option est active, chaque nouvel utilisateur inscrit obtient directement un cabinet de test dédié, un compte actif et un email de confirmation."
              )}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={formData.allowUserRegistrationWithoutApproval === true}
            aria-label={getFallbackText(
              'settings.llm.allowUserRegistrationWithoutApprovalLabel',
              "Autoriser l'enregistrement des utilisateurs sans validation préalable"
            )}
            onClick={handleRegistrationApprovalToggle}
            className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full border transition-colors ${
              formData.allowUserRegistrationWithoutApproval === true
                ? 'border-primary-400 bg-primary-500/40'
                : 'border-white/10 bg-slate-900/80'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                formData.allowUserRegistrationWithoutApproval === true ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>
    </div>
  );
};

export default LLMTab;
