type LLMProvider = 'openai' | 'anthropic' | 'huggingface' | 'gemma' | 'deepseek' | 'glm' | 'minimax' | 'ollama';
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type LLMModelParameters = Record<string, Record<string, Record<string, JsonValue>>>;
type LLMModelCatalog = Record<string, Array<{ value: string; label: string }>>;
type ParameterDefinition = {
  key: string;
  type: 'number' | 'integer' | 'string' | 'boolean' | 'enum' | 'object' | 'array' | 'union';
  label: string;
  min?: number;
  max?: number;
  maxInclusive?: number;
  maxExclusive?: number;
  step?: number;
  defaultValue?: JsonValue;
  options?: Array<{ value: string; label: string }>;
  itemType?: string;
};

type OllamaModelCapability = {
  name: string;
  size: number | null;
  modifiedAt: string | null;
  family: string | null;
  format: string | null;
  parameterSize: string | null;
  quantizationLevel: string | null;
  contextLength: number | null;
  architecture: string | null;
};

export interface Settings {
  id?: string;
  llmProvider?: LLMProvider;
  llmModel?: string;
  llmAvailability?: Record<string, { highspeedEnabled?: boolean; runtimeUnavailableModels?: string[] }>;
  ollamaBaseUrl?: string;
  ollamaVisionModel?: string;
  ollamaKeepAlive?: string;
  ollamaNumCtx?: number;
  llmModelParameters?: LLMModelParameters;
  llmModelCatalog?: LLMModelCatalog;
  llmParameterDefinitions?: Record<string, Record<string, Record<string, ParameterDefinition>>>;
  ollamaDiscoveredModels?: Array<{ value: string; label: string }>;
  ollamaModelCapabilities?: Record<string, OllamaModelCapability>;
  promptGovernance?: Record<string, {
    settingKey: string;
    promptKey: string;
    promptId: string | null;
    promptVersion: string | null;
    promptDomain: string | null;
    promptOperation: string | null;
    contractId: string | null;
    contractVersion: string | null;
    sourceModule: string | null;
    defaultText: string;
  }>;
  promptVersionState?: Record<string, {
    currentRevision: number;
    activeSource: 'default' | 'custom';
    activeTextHash: string;
    isModified: boolean;
    lastChangedAt: string | null;
    history: Array<{
      revision: number;
      source: 'default' | 'custom';
      reason: string;
      text: string;
      textHash: string;
      changedAt: string | null;
      changedByUserId: string | null;
      changedByEmail: string | null;
      promptId: string | null;
      promptVersion: string | null;
      contractId: string | null;
      contractVersion: string | null;
    }>;
  }>;
  cvMode?: 'nominative' | 'anonymous';
  chatbotEnabled?: 'on' | 'off';
  webglEnabled?: 'on' | 'off';
  preAnalysisEnabled?: boolean;
  'Pre Analysis Prompt'?: string;
  'Analysis Prompt'?: string;
  'Improvement Prompt'?: string;
  'Match Analysis Prompt'?: string;
  'Adaptation Prompt'?: string;
  'Executive Summary Weight'?: number;
  'Skills Weight'?: number;
  'Experience Weight'?: number;
  'Education Weight'?: number;
  'ATS Weight'?: number;
  'Hobbies Languages Weight'?: number;
  'Profile Matching Local Skill Weight'?: number;
  'Profile Matching Local Tool Weight'?: number;
  'Profile Matching Local Industry Weight'?: number;
  'Profile Matching Local Soft Skill Weight'?: number;
  'Profile Matching Local Title Exact Weight'?: number;
  'Profile Matching Local Title Token Weight'?: number;
  'Profile Matching Local Coverage Multiplier'?: number;
  'DPO Name'?: string;
  'DPO Email'?: string;
  'DPO Phone'?: string;
  analysisPrompt?: string;
  improvementPrompt?: string;
}

export interface SettingsFormData {
  llmProvider: LLMProvider;
  llmModel: string;
  ollamaBaseUrl: string;
  ollamaVisionModel: string;
  ollamaKeepAlive: string;
  ollamaNumCtx: number;
  llmModelParametersJson: string;
  cvMode: 'nominative' | 'anonymous';
  chatbotEnabled: 'on' | 'off';
  webglEnabled: 'on' | 'off';
  preAnalysisEnabled: boolean;
  'Pre Analysis Prompt': string;
  'Analysis Prompt': string;
  'Improvement Prompt': string;
  'Match Analysis Prompt': string;
  'Adaptation Prompt': string;
  'Executive Summary Weight': number;
  'Skills Weight': number;
  'Experience Weight': number;
  'Education Weight': number;
  'ATS Weight': number;
  'Hobbies Languages Weight': number;
  'Profile Matching Local Skill Weight': number;
  'Profile Matching Local Tool Weight': number;
  'Profile Matching Local Industry Weight': number;
  'Profile Matching Local Soft Skill Weight': number;
  'Profile Matching Local Title Exact Weight': number;
  'Profile Matching Local Title Token Weight': number;
  'Profile Matching Local Coverage Multiplier': number;
  'DPO Name': string;
  'DPO Email': string;
  'DPO Phone': string;
  [key: string]: string | number | boolean;
}

export type {
  JsonValue,
  LLMModelParameters,
  LLMProvider,
  OllamaModelCapability,
};

function stringifyLlmModelParameters(value?: LLMModelParameters): string {
  return JSON.stringify(value || {}, null, 2);
}

function parseLlmModelParametersJson(value: string): LLMModelParameters {
  const parsed = JSON.parse(value || '{}') as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid_llm_model_parameters_json');
  }
  return parsed as LLMModelParameters;
}

export const defaultFormData: SettingsFormData = {
  llmProvider: 'openai',
  llmModel: 'gpt-4o',
  ollamaBaseUrl: '',
  ollamaVisionModel: '',
  ollamaKeepAlive: '5m',
  ollamaNumCtx: 8192,
  llmModelParametersJson: '{}',
  cvMode: 'nominative',
  chatbotEnabled: 'on',
  webglEnabled: 'on',
  preAnalysisEnabled: false,
  'Pre Analysis Prompt': '',
  'Analysis Prompt': '',
  'Improvement Prompt': '',
  'Match Analysis Prompt': '',
  'Adaptation Prompt': '',
  'Executive Summary Weight': 20,
  'Skills Weight': 20,
  'Experience Weight': 20,
  'Education Weight': 15,
  'ATS Weight': 15,
  'Hobbies Languages Weight': 10,
  'Profile Matching Local Skill Weight': 6,
  'Profile Matching Local Tool Weight': 4,
  'Profile Matching Local Industry Weight': 3,
  'Profile Matching Local Soft Skill Weight': 2,
  'Profile Matching Local Title Exact Weight': 5,
  'Profile Matching Local Title Token Weight': 2,
  'Profile Matching Local Coverage Multiplier': 3,
  'DPO Name': '',
  'DPO Email': '',
  'DPO Phone': '',
};

export const getDefaultModelForProvider = (provider?: LLMProvider): string => {
  if (provider === 'anthropic') return 'claude-sonnet-4-20250514';
  if (provider === 'huggingface') return 'MiniMaxAI/MiniMax-M2.7';
  if (provider === 'gemma') return 'gemma-4-31b-it';
  if (provider === 'deepseek') return 'deepseek-chat';
  if (provider === 'glm') return 'glm-5.1';
  if (provider === 'minimax') return 'MiniMax-M2.7';
  if (provider === 'ollama') return '';
  return 'gpt-4o';
};

export const toFormData = (settings?: Settings | null): SettingsFormData => ({
  llmProvider: settings?.llmProvider || 'openai',
  llmModel: settings?.llmModel || getDefaultModelForProvider(settings?.llmProvider),
  ollamaBaseUrl: settings?.ollamaBaseUrl || '',
  ollamaVisionModel: settings?.ollamaVisionModel || '',
  ollamaKeepAlive: settings?.ollamaKeepAlive || '5m',
  ollamaNumCtx: settings?.ollamaNumCtx || 8192,
  llmModelParametersJson: stringifyLlmModelParameters(settings?.llmModelParameters),
  cvMode: settings?.cvMode || 'nominative',
  chatbotEnabled: settings?.chatbotEnabled || 'on',
  webglEnabled: settings?.webglEnabled || 'on',
  preAnalysisEnabled: settings?.preAnalysisEnabled || false,
  'Pre Analysis Prompt': settings?.['Pre Analysis Prompt'] || '',
  'Analysis Prompt': settings?.['Analysis Prompt'] || '',
  'Improvement Prompt': settings?.['Improvement Prompt'] || '',
  'Match Analysis Prompt': settings?.['Match Analysis Prompt'] || '',
  'Adaptation Prompt': settings?.['Adaptation Prompt'] || '',
  'Executive Summary Weight': settings?.['Executive Summary Weight'] || 20,
  'Skills Weight': settings?.['Skills Weight'] || 20,
  'Experience Weight': settings?.['Experience Weight'] || 20,
  'Education Weight': settings?.['Education Weight'] || 15,
  'ATS Weight': settings?.['ATS Weight'] || 15,
  'Hobbies Languages Weight': settings?.['Hobbies Languages Weight'] || 10,
  'Profile Matching Local Skill Weight': settings?.['Profile Matching Local Skill Weight'] || 6,
  'Profile Matching Local Tool Weight': settings?.['Profile Matching Local Tool Weight'] || 4,
  'Profile Matching Local Industry Weight': settings?.['Profile Matching Local Industry Weight'] || 3,
  'Profile Matching Local Soft Skill Weight': settings?.['Profile Matching Local Soft Skill Weight'] || 2,
  'Profile Matching Local Title Exact Weight': settings?.['Profile Matching Local Title Exact Weight'] || 5,
  'Profile Matching Local Title Token Weight': settings?.['Profile Matching Local Title Token Weight'] || 2,
  'Profile Matching Local Coverage Multiplier': settings?.['Profile Matching Local Coverage Multiplier'] || 3,
  'DPO Name': settings?.['DPO Name'] || '',
  'DPO Email': settings?.['DPO Email'] || '',
  'DPO Phone': settings?.['DPO Phone'] || '',
});

export const createSavePayload = (
  formData: SettingsFormData
): Record<string, string | number | boolean | LLMModelParameters> => {
  const chatbotValue = formData.chatbotEnabled;
  const llmModelParameters = parseLlmModelParametersJson(formData.llmModelParametersJson);
  const dataToSave: Record<string, string | number | boolean | LLMModelParameters> = {
    ...formData,
    llmModelParameters,
    chatbotEnabled: chatbotValue === 'on' || (chatbotValue as unknown) === true ? 'on' : 'off',
    'Executive Summary Weight': Number(formData['Executive Summary Weight']),
    'Skills Weight': Number(formData['Skills Weight']),
    'Experience Weight': Number(formData['Experience Weight']),
    'Education Weight': Number(formData['Education Weight']),
    'ATS Weight': Number(formData['ATS Weight']),
    'Hobbies Languages Weight': Number(formData['Hobbies Languages Weight']),
    'Profile Matching Local Skill Weight': Number(formData['Profile Matching Local Skill Weight']),
    'Profile Matching Local Tool Weight': Number(formData['Profile Matching Local Tool Weight']),
    'Profile Matching Local Industry Weight': Number(formData['Profile Matching Local Industry Weight']),
    'Profile Matching Local Soft Skill Weight': Number(formData['Profile Matching Local Soft Skill Weight']),
    'Profile Matching Local Title Exact Weight': Number(formData['Profile Matching Local Title Exact Weight']),
    'Profile Matching Local Title Token Weight': Number(formData['Profile Matching Local Title Token Weight']),
    'Profile Matching Local Coverage Multiplier': Number(formData['Profile Matching Local Coverage Multiplier']),
  };
  delete dataToSave.llmModelParametersJson;

  if (formData.llmProvider !== 'ollama') {
    delete dataToSave.ollamaBaseUrl;
    delete dataToSave.ollamaVisionModel;
    delete dataToSave.ollamaKeepAlive;
    delete dataToSave.ollamaNumCtx;
  } else {
    if (!String(formData.ollamaBaseUrl || '').trim()) {
      delete dataToSave.ollamaBaseUrl;
    }
    if (!String(formData.ollamaVisionModel || '').trim()) {
      delete dataToSave.ollamaVisionModel;
    }
  }

  return dataToSave;
};

export const getTotalWeight = (formData: SettingsFormData): number =>
  Number(formData['Executive Summary Weight']) +
  Number(formData['Skills Weight']) +
  Number(formData['Experience Weight']) +
  Number(formData['Education Weight']) +
  Number(formData['ATS Weight']) +
  Number(formData['Hobbies Languages Weight']);
