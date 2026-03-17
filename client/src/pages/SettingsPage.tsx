/**
 * SettingsPage Component
 * TypeScript version
 */

import { useState, useEffect, ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Cog6ToothIcon, SparklesIcon, ScaleIcon, DocumentTextIcon, ChatBubbleLeftRightIcon, ShieldCheckIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuthFetch } from '../hooks/useAuthFetch';
import { useChatbot } from '../context/ChatbotContext';
import logger from '../utils/logger.frontend';

import { LLMTab, PromptsTab, WeightsTab, ChatbotTab, GdprTab, DpoTab } from '../components/SettingsPage';
import Breadcrumbs from '../components/Breadcrumbs';

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

interface Settings {
  id?: string;
  llmModel?: string;
  cvMode?: 'nominative' | 'anonymous';
  chatbotEnabled?: 'on' | 'off';
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
  'DPO Name'?: string;
  'DPO Email'?: string;
  'DPO Phone'?: string;
  analysisPrompt?: string;
  improvementPrompt?: string;
}

interface SettingsFormData {
  llmModel: string;
  cvMode: 'nominative' | 'anonymous';
  chatbotEnabled: 'on' | 'off';
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
  'DPO Name': string;
  'DPO Email': string;
  'DPO Phone': string;
  [key: string]: string | number | boolean;
}

interface Tab {
  id: string;
  name: string;
  icon: HeroIcon;
}

const SettingsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const { authGet, authPost, authPut } = useAuthFetch();
  const { setChatbotEnabled } = useChatbot();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('llm');

  const [formData, setFormData] = useState<SettingsFormData>({
    llmModel: 'chatgpt-4o-latest',
    cvMode: 'nominative',
    chatbotEnabled: 'on',
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
    'DPO Name': '',
    'DPO Email': '',
    'DPO Phone': ''
  });

  useEffect(() => {
    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettings = async (): Promise<void> => {
    try {
      const response = await authGet('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');

      const data: Settings = await response.json();
      setSettings(data);
      setFormData({
        llmModel: data.llmModel || 'chatgpt-4o-latest',
        cvMode: data.cvMode || 'nominative',
        chatbotEnabled: data.chatbotEnabled || 'on',
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
  };

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
        toast.error(`La somme des poids doit être égale à 100% (actuellement: ${totalWeight}%)`);
        setSaving(false);
        return;
      }

      // Ensure chatbotEnabled is 'on' or 'off' string (not boolean)
      const chatbotValue = formData.chatbotEnabled;
      const dataToSave = {
        ...formData,
        chatbotEnabled: chatbotValue === 'on' || (chatbotValue as unknown) === true ? 'on' : 'off'
      };

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
      
      // Update chatbot state in context immediately
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

  const resetToDefaults = (): void => {
    if (window.confirm(t('settings.resetConfirm'))) {
      setFormData({
        llmModel: 'chatgpt-4o-latest',
        cvMode: 'nominative',
        chatbotEnabled: 'on',
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
        'DPO Name': '',
        'DPO Email': '',
        'DPO Phone': ''
      });
      toast.success(t('settings.resetSuccess'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">{t('settings.loading')}</div>
      </div>
    );
  }

  const tabs: Tab[] = [
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
      <Breadcrumbs className="mb-4" />
      
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-8 rounded-full bg-primary-500" />
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
            {t('settings.title')}
          </h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">
          {t('settings.subtitle')}
        </p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <IconComponent className="w-5 h-5 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {activeTab === 'llm' && (
          <LLMTab formData={formData} onInputChange={handleInputChange} t={t} />
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
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {t('settings.apiDocs.title')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {t('settings.apiDocs.description')}
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">{t('settings.apiDocs.swaggerUi')}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('settings.apiDocs.swaggerUiDescription')}
                  </p>
                </div>
                <button
                  onClick={() => window.open(`/api/docs/ui?v=${Date.now()}`, '_blank')}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm"
                >
                  <DocumentTextIcon className="w-5 h-5 mr-2" />
                  {t('settings.apiDocs.openSwagger')}
                </button>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">{t('settings.apiDocs.openApiJson')}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('settings.apiDocs.openApiJsonDescription')}
                  </p>
                </div>
                <button
                  onClick={() => window.open(`/api/docs?v=${Date.now()}`, '_blank')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 font-medium text-sm"
                >
                  {t('settings.apiDocs.viewJson')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            {t('settings.reset')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {saving ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default SettingsPage;
