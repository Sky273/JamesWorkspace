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
type LLMModelParameters = Record<string, Record<string, Record<string, string | number>>>;
type LLMModelCatalog = Record<string, Array<{ value: string; label: string }>>;
type LLMParameterDefinitions = Record<string, Record<string, Record<string, {
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
  options?: Array<{ value: string; label: string }>;
}>>>;

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
  llmParameterDefinitions?: LLMParameterDefinitions;
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
  llmModelParameters: LLMModelParameters;
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
  [key: string]: string | number | boolean | LLMModelParameters;
}

export const defaultFormData: SettingsFormData = {
  llmProvider: 'openai',
  llmModel: 'gpt-4o',
  ollamaBaseUrl: '',
  ollamaVisionModel: '',
  ollamaKeepAlive: '5m',
  ollamaNumCtx: 8192,
  llmModelParameters: {},
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
  return 'gpt-4o';
};

export const toFormData = (settings?: Settings | null): SettingsFormData => ({
  llmProvider: settings?.llmProvider || 'openai',
  llmModel: settings?.llmModel || getDefaultModelForProvider(settings?.llmProvider),
  ollamaBaseUrl: settings?.ollamaBaseUrl || '',
  ollamaVisionModel: settings?.ollamaVisionModel || '',
  ollamaKeepAlive: settings?.ollamaKeepAlive || '5m',
  ollamaNumCtx: settings?.ollamaNumCtx || 8192,
  llmModelParameters: settings?.llmModelParameters || {},
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
  const dataToSave: Record<string, string | number | LLMModelParameters> = {
    ...formData,
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

  if (formData.llmProvider === 'ollama') {
    dataToSave.llmModel = '';
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

export function useSettingsPage() {
  const { t } = useTranslation();
  const { authGet, authPost, authPut } = useAuthFetch();
  const { setChatbotEnabled } = useChatbot();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('llm');
  const [formData, setFormData] = useState<SettingsFormData>(defaultFormData);

  const fetchSettings = useCallback(async (): Promise<void> => {
    try {
      const response = await authGet('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');

      const data: Settings = await response.json();
      setSettings(data);
      setFormData(toFormData(data));

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

  const handleSave = useCallback(async (): Promise<void> => {
    try {
      setSaving(true);

      const totalWeight = getTotalWeight(formData);
      if (totalWeight !== 100) {
        toast.error(t('settings.weights.totalMustEqualCurrent', { total: totalWeight }));
        setSaving(false);
        return;
      }

      const dataToSave = createSavePayload(formData);
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
    value: string | number | boolean | LLMModelParameters
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
    activeTab,
    setActiveTab,
    formData,
    tabs,
    totalWeight,
    handleSave,
    handleInputChange,
    resetToDefaults,
  };
}
