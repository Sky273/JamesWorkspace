/**
 * SettingsPage Component
 * TypeScript version
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Cog6ToothIcon, SparklesIcon, ScaleIcon, DocumentTextIcon, ChatBubbleLeftRightIcon, ShieldCheckIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuthFetch } from '../hooks/useAuthFetch';
import { useChatbot } from '../context/ChatbotContext';
import logger from '../utils/logger.frontend';

import { LLMTab, PromptsTab, WeightsTab, ChatbotTab, GdprTab, DpoTab } from '../components/SettingsPage';
import SettingsHeader from '../components/SettingsPage/SettingsHeader';
import SettingsTabsNav, { type SettingsTabItem } from '../components/SettingsPage/SettingsTabsNav';
import SettingsApiDocsPanel from '../components/SettingsPage/SettingsApiDocsPanel';
import SettingsActionsFooter from '../components/SettingsPage/SettingsActionsFooter';

type LLMProvider = 'openai' | 'anthropic' | 'deepseek' | 'glm' | 'minimax' | 'ollama';

interface Settings {
  id?: string;
  llmProvider?: LLMProvider;
  llmModel?: string;
  llmAvailability?: Record<string, { highspeedEnabled?: boolean; runtimeUnavailableModels?: string[] }>;
  ollamaBaseUrl?: string;
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

interface SettingsFormData {
  llmProvider: LLMProvider;
  llmModel: string;
  ollamaBaseUrl: string;
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


const defaultFormData: SettingsFormData = {
  llmProvider: 'openai',
  llmModel: 'gpt-4o',
  ollamaBaseUrl: '',
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

const getDefaultModelForProvider = (provider?: LLMProvider): string => {
  if (provider === 'anthropic') return 'claude-sonnet-4-20250514';
  if (provider === 'deepseek') return 'deepseek-chat';
  if (provider === 'glm') return 'glm-5.1';
  if (provider === 'minimax') return 'MiniMax-M2.7';
  return 'gpt-4o';
};

const SettingsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const { authGet, authPost, authPut } = useAuthFetch();
  const { setChatbotEnabled } = useChatbot();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('llm');
  const [formData, setFormData] = useState<SettingsFormData>(defaultFormData);

  const fetchSettings = useCallback(async (): Promise<void> => {
    try {
      const response = await authGet('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');

      const data: Settings = await response.json();
      setSettings(data);
      setFormData({
        llmProvider: data.llmProvider || 'openai',
        llmModel: data.llmModel || getDefaultModelForProvider(data.llmProvider),
        ollamaBaseUrl: data.ollamaBaseUrl || '',
        cvMode: data.cvMode || 'nominative',
        chatbotEnabled: data.chatbotEnabled || 'on',
        webglEnabled: data.webglEnabled || 'on',
        'Analysis Prompt': data['Analysis Prompt'] || '',
        'Improvement Prompt': data['Improvement Prompt'] || '',
        'Match Analysis Prompt': data['Match Analysis Prompt'] || '',
        'Adaptation Prompt': data['Adaptation Prompt'] || '',
        'Executive Summary Weight': data['Executive Summary Weight'] || 20,
        'Skills Weight': data['Skills Weight'] || 20,
        'Experience Weight': data['Experience Weight'] || 20,
        'Education Weight': data['Education Weight'] || 15,
        'ATS Weight': data['ATS Weight'] || 15,
        'Hobbies Languages Weight': data['Hobbies Languages Weight'] || 10,
        'Profile Matching Local Skill Weight': data['Profile Matching Local Skill Weight'] || 6,
        'Profile Matching Local Tool Weight': data['Profile Matching Local Tool Weight'] || 4,
        'Profile Matching Local Industry Weight': data['Profile Matching Local Industry Weight'] || 3,
        'Profile Matching Local Soft Skill Weight': data['Profile Matching Local Soft Skill Weight'] || 2,
        'Profile Matching Local Title Exact Weight': data['Profile Matching Local Title Exact Weight'] || 5,
        'Profile Matching Local Title Token Weight': data['Profile Matching Local Title Token Weight'] || 2,
        'Profile Matching Local Coverage Multiplier': data['Profile Matching Local Coverage Multiplier'] || 3,
        'DPO Name': data['DPO Name'] || '',
        'DPO Email': data['DPO Email'] || '',
        'DPO Phone': data['DPO Phone'] || ''
      });

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
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (): Promise<void> => {
    try {
      setSaving(true);

      const totalWeight =
        Number(formData['Executive Summary Weight']) +
        Number(formData['Skills Weight']) +
        Number(formData['Experience Weight']) +
        Number(formData['Education Weight']) +
        Number(formData['ATS Weight']) +
        Number(formData['Hobbies Languages Weight']);

      if (totalWeight !== 100) {
        toast.error(t('settings.weights.totalMustEqualCurrent', { total: totalWeight }));
        setSaving(false);
        return;
      }

      const chatbotValue = formData.chatbotEnabled;
      const dataToSave: Record<string, string | number> = {
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
        delete dataToSave.ollamaVisionModel;
        delete dataToSave.ollamaKeepAlive;
        delete dataToSave.ollamaNumCtx;
      }

      logger.log('[SettingsPage] Saving settings with data:', JSON.stringify(dataToSave, null, 2));

      let response: Response;
      if (settings?.id) {
        response = await authPut(`/api/settings/${settings.id}`, dataToSave);
      } else {
        response = await authPost('/api/settings', dataToSave);
      }

      if (!response.ok) throw new Error('Failed to save settings');

      const data = await response.json();
      setSettings(data);
      setChatbotEnabled(dataToSave.chatbotEnabled === 'on');
      toast.success(t('settings.saveSuccess'));
    } catch (error) {
      logger.error('Error saving settings:', error);
      toast.error(t('settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string | number | boolean): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetToDefaults = async (): Promise<void> => {
    if (!window.confirm(t('settings.resetConfirm'))) return;
    try {
      const response = await authGet('/api/settings/defaults');
      if (!response.ok) throw new Error('Failed to fetch defaults');
      const defaults: Settings = await response.json();
      setFormData({
        llmProvider: defaults.llmProvider || 'openai',
        llmModel: defaults.llmModel || getDefaultModelForProvider(defaults.llmProvider),
        ollamaBaseUrl: defaults.ollamaBaseUrl || '',
        cvMode: defaults.cvMode || 'nominative',
        chatbotEnabled: defaults.chatbotEnabled || 'on',
        webglEnabled: defaults.webglEnabled || 'on',
        'Analysis Prompt': defaults['Analysis Prompt'] || '',
        'Improvement Prompt': defaults['Improvement Prompt'] || '',
        'Match Analysis Prompt': defaults['Match Analysis Prompt'] || '',
        'Adaptation Prompt': defaults['Adaptation Prompt'] || '',
        'Executive Summary Weight': defaults['Executive Summary Weight'] ?? 20,
        'Skills Weight': defaults['Skills Weight'] ?? 20,
        'Experience Weight': defaults['Experience Weight'] ?? 20,
        'Education Weight': defaults['Education Weight'] ?? 15,
        'ATS Weight': defaults['ATS Weight'] ?? 15,
        'Hobbies Languages Weight': defaults['Hobbies Languages Weight'] ?? 10,
        'Profile Matching Local Skill Weight': defaults['Profile Matching Local Skill Weight'] ?? 6,
        'Profile Matching Local Tool Weight': defaults['Profile Matching Local Tool Weight'] ?? 4,
        'Profile Matching Local Industry Weight': defaults['Profile Matching Local Industry Weight'] ?? 3,
        'Profile Matching Local Soft Skill Weight': defaults['Profile Matching Local Soft Skill Weight'] ?? 2,
        'Profile Matching Local Title Exact Weight': defaults['Profile Matching Local Title Exact Weight'] ?? 5,
        'Profile Matching Local Title Token Weight': defaults['Profile Matching Local Title Token Weight'] ?? 2,
        'Profile Matching Local Coverage Multiplier': defaults['Profile Matching Local Coverage Multiplier'] ?? 3,
        'DPO Name': defaults['DPO Name'] || '',
        'DPO Email': defaults['DPO Email'] || '',
        'DPO Phone': defaults['DPO Phone'] || ''
      });
      toast.success(t('settings.resetSuccess'));
    } catch (error) {
      logger.error('Error fetching default settings:', error);
      toast.error(t('settings.loadError'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">{t('settings.loading')}</div>
      </div>
    );
  }

  const tabs: SettingsTabItem[] = [
    { id: 'llm', name: t('settings.tabs.llm'), icon: SparklesIcon },
    { id: 'prompts', name: t('settings.tabs.prompts'), icon: Cog6ToothIcon },
    { id: 'weights', name: t('settings.tabs.weights'), icon: ScaleIcon },
    { id: 'chatbot', name: t('settings.tabs.chatbot'), icon: ChatBubbleLeftRightIcon },
    { id: 'gdpr', name: t('settings.tabs.gdpr'), icon: ShieldCheckIcon },
    { id: 'dpo', name: t('settings.tabs.dpo'), icon: UserCircleIcon },
    { id: 'swagger', name: t('settings.tabs.apiDocs'), icon: DocumentTextIcon }
  ];

  const totalWeight =
    Number(formData['Executive Summary Weight']) +
    Number(formData['Skills Weight']) +
    Number(formData['Experience Weight']) +
    Number(formData['Education Weight']) +
    Number(formData['ATS Weight']) +
    Number(formData['Hobbies Languages Weight']);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-6 max-w-6xl mx-auto"
    >
      <SettingsHeader t={t} />

      <SettingsTabsNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 overflow-visible">
        {activeTab === 'llm' && (
          <LLMTab
            formData={formData}
            onInputChange={handleInputChange}
            t={t}
            llmAvailability={settings?.llmAvailability}
          />
        )}

        {activeTab === 'prompts' && (
          <PromptsTab formData={formData} onInputChange={handleInputChange} t={t} />
        )}

        {activeTab === 'weights' && (
          <WeightsTab
            formData={formData}
            onInputChange={handleInputChange}
            totalWeight={totalWeight}
            t={t}
          />
        )}

        {activeTab === 'chatbot' && (
          <ChatbotTab formData={formData} onInputChange={handleInputChange} t={t} />
        )}

        {activeTab === 'gdpr' && (
          <GdprTab t={t} />
        )}

        {activeTab === 'dpo' && (
          <DpoTab formData={formData} onInputChange={handleInputChange} t={t} />
        )}

        {activeTab === 'swagger' && (
          <SettingsApiDocsPanel t={t} />
        )}

        <SettingsActionsFooter
          saving={saving}
          onReset={resetToDefaults}
          onSave={handleSave}
          t={t}
        />
      </div>
    </motion.div>
  );
};

export default SettingsPage;




