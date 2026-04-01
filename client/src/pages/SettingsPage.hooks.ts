import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  Cog6ToothIcon,
  SparklesIcon,
  ScaleIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { useAuthFetch } from '../hooks/useAuthFetch';
import { useChatbot } from '../context/ChatbotContext';
import logger from '../utils/logger.frontend';
import type { SettingsTabItem } from '../components/SettingsPage/SettingsTabsNav';

type LLMProvider = 'openai' | 'anthropic' | 'deepseek' | 'glm' | 'minimax' | 'ollama';
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

interface Settings {
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
  'DPO Phone': ''
};

export const getDefaultModelForProvider = (provider?: LLMProvider): string => {
  if (provider === 'anthropic') return 'claude-sonnet-4-20250514';
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
  'DPO Phone': settings?.['DPO Phone'] || ''
});

export const createSavePayload = (
  formData: SettingsFormData
): Record<string, string | number | LLMModelParameters> => {
  const chatbotValue = formData.chatbotEnabled;
  const llmModelParameters = parseLlmModelParametersJson(formData.llmModelParametersJson);
  const dataToSave: Record<string, string | number | LLMModelParameters> = {
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
    'Profile Matching Local Coverage Multiplier': Number(formData['Profile Matching Local Coverage Multiplier'])
  };
  delete dataToSave.llmModelParametersJson;

  return dataToSave;
};

export const getTotalWeight = (formData: SettingsFormData): number =>
  Number(formData['Executive Summary Weight']) +
  Number(formData['Skills Weight']) +
  Number(formData['Experience Weight']) +
  Number(formData['Education Weight']) +
  Number(formData['ATS Weight']) +
  Number(formData['Hobbies Languages Weight']);

export function useSettingsPage() {
  const { t } = useTranslation();
  const { authGet, authPost, authPut } = useAuthFetch();
  const { setChatbotEnabled } = useChatbot();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ollamaDiscoveryLoading, setOllamaDiscoveryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('llm');
  const [formData, setFormData] = useState<SettingsFormData>(defaultFormData);
  const [ollamaModelCatalog, setOllamaModelCatalog] = useState<Array<{ value: string; label: string }>>([]);
  const [ollamaModelCapabilities, setOllamaModelCapabilities] = useState<Record<string, OllamaModelCapability>>({});

  const fetchOllamaModels = useCallback(async (baseUrl: string, selectedModel?: string): Promise<void> => {
    if (!baseUrl.trim()) {
      setOllamaModelCatalog([]);
      setOllamaModelCapabilities({});
      return;
    }

    try {
      setOllamaDiscoveryLoading(true);
      const params = new URLSearchParams({ baseUrl });
      if (selectedModel) {
        params.set('model', selectedModel);
      }
      const response = await authGet(`/api/settings/ollama/models?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to discover Ollama models');
      }

      const data = await response.json() as {
        models: Array<{ value: string; label: string }>;
        capabilitiesByModel: Record<string, OllamaModelCapability>;
        selectedModelExists: boolean;
      };

      setOllamaModelCatalog(data.models || []);
      setOllamaModelCapabilities(data.capabilitiesByModel || {});

      if (formData.llmProvider === 'ollama') {
        const nextModel = selectedModel || formData.llmModel;
        const stillExists = data.models.some((entry) => entry.value === nextModel);
        if (!stillExists && data.models[0]) {
          setFormData((prev) => ({
            ...prev,
            llmModel: data.models[0].value
          }));
        }
      }
    } catch (error) {
      logger.error('Error discovering Ollama models:', error);
      setOllamaModelCatalog([]);
      setOllamaModelCapabilities({});
    } finally {
      setOllamaDiscoveryLoading(false);
    }
  }, [authGet, formData.llmModel, formData.llmProvider]);

  const fetchSettings = useCallback(async (): Promise<void> => {
    try {
      const response = await authGet('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');

      const data: Settings = await response.json();
      setSettings(data);
      setFormData(toFormData(data));
      setOllamaModelCatalog(data.ollamaDiscoveredModels || []);
      setOllamaModelCapabilities(data.ollamaModelCapabilities || {});

      logger.log('[Settings] Prompts loaded:', {
        analysisPromptLength: data.analysisPrompt?.length || 0,
        improvementPromptLength: data.improvementPrompt?.length || 0
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching settings:', error);
        toast.error(t('settings.loadError'));
      }
    } finally {
      setLoading(false);
    }
  }, [authGet, t]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (formData.llmProvider !== 'ollama') {
      return;
    }

    const baseUrl = formData.ollamaBaseUrl.trim();
    if (!baseUrl) {
      setOllamaModelCatalog([]);
      setOllamaModelCapabilities({});
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchOllamaModels(baseUrl, formData.llmModel);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [fetchOllamaModels, formData.llmModel, formData.llmProvider, formData.ollamaBaseUrl]);

  const handleSave = useCallback(async (): Promise<void> => {
    try {
      setSaving(true);

      const totalWeight = getTotalWeight(formData);
      if (totalWeight !== 100) {
        toast.error(t('settings.weights.totalMustEqualCurrent', { total: totalWeight }));
        setSaving(false);
        return;
      }

      if (formData.llmProvider === 'ollama' && !formData.llmModel.trim()) {
        toast.error('Selectionnez un modele Ollama distant');
        setSaving(false);
        return;
      }

      let dataToSave: Record<string, string | number | LLMModelParameters>;
      try {
        dataToSave = createSavePayload(formData);
      } catch (error) {
        logger.error('Invalid LLM parameters JSON:', error);
        toast.error('JSON invalide dans les parametres LLM');
        setSaving(false);
        return;
      }
      logger.log('[SettingsPage] Saving settings with data:', JSON.stringify(dataToSave, null, 2));

      const response = settings?.id
        ? await authPut(`/api/settings/${settings.id}`, dataToSave)
        : await authPost('/api/settings', dataToSave);

      if (!response.ok) throw new Error('Failed to save settings');

      const data = await response.json();
      setSettings(data);
      setFormData(toFormData(data));
      setChatbotEnabled(dataToSave.chatbotEnabled === 'on');
      toast.success(t('settings.saveSuccess'));
    } catch (error) {
      logger.error('Error saving settings:', error);
      toast.error(t('settings.saveError'));
    } finally {
      setSaving(false);
    }
  }, [authPost, authPut, formData, setChatbotEnabled, settings?.id, t]);

  const handleInputChange = useCallback((
    field: string,
    value: string | number | boolean
  ): void => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const resetToDefaults = useCallback(async (): Promise<void> => {
    if (!window.confirm(t('settings.resetConfirm'))) return;

    try {
      const response = await authGet('/api/settings/defaults');
      if (!response.ok) throw new Error('Failed to fetch defaults');

      const defaults: Settings = await response.json();
      setFormData(toFormData(defaults));
      toast.success(t('settings.resetSuccess'));
    } catch (error) {
      logger.error('Error fetching default settings:', error);
      toast.error(t('settings.loadError'));
    }
  }, [authGet, t]);

  const totalWeight = useMemo(() => getTotalWeight(formData), [formData]);

  const tabs = useMemo<SettingsTabItem[]>(() => ([
    { id: 'llm', name: t('settings.tabs.llm'), icon: SparklesIcon },
    { id: 'prompts', name: t('settings.tabs.prompts'), icon: Cog6ToothIcon },
    { id: 'weights', name: t('settings.tabs.weights'), icon: ScaleIcon },
    { id: 'chatbot', name: t('settings.tabs.chatbot'), icon: ChatBubbleLeftRightIcon },
    { id: 'gdpr', name: t('settings.tabs.gdpr'), icon: ShieldCheckIcon },
    { id: 'dpo', name: t('settings.tabs.dpo'), icon: UserCircleIcon },
    { id: 'swagger', name: t('settings.tabs.apiDocs'), icon: DocumentTextIcon }
  ]), [t]);

  return {
    t,
    settings,
    loading,
    saving,
    ollamaDiscoveryLoading,
    ollamaModelCatalog,
    ollamaModelCapabilities,
    activeTab,
    setActiveTab,
    formData,
    tabs,
    totalWeight,
    handleSave,
    handleInputChange,
    resetToDefaults,
    fetchOllamaModels
  };
}
