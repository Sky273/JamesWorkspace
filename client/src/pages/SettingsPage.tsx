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

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;
type LLMProvider = 'openai' | 'anthropic' | 'ollama';
type OllamaAction = 'pull' | 'run' | 'stop' | 'refresh' | 'status';

interface OllamaModelInfo {
  name: string;
  size?: number | null;
  modifiedAt?: string | null;
}

interface OllamaRuntimeStatus {
  running: boolean;
  activeModel: string | null;
  runningModels: OllamaModelInfo[];
}

interface Settings {
  id?: string;
  llmProvider?: LLMProvider;
  llmModel?: string;
  ollamaBaseUrl?: string;
  ollamaVisionModel?: string;
  ollamaKeepAlive?: string;
  ollamaNumCtx?: number;
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
  ollamaVisionModel: string;
  ollamaKeepAlive: string;
  ollamaNumCtx: number;
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

const defaultFormData: SettingsFormData = {
  llmProvider: 'openai',
  llmModel: 'gpt-4o',
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  ollamaVisionModel: '',
  ollamaKeepAlive: '5m',
  ollamaNumCtx: 8192,
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
  'DPO Name': '',
  'DPO Email': '',
  'DPO Phone': ''
};

const SettingsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const { authGet, authPost, authPut } = useAuthFetch();
  const { setChatbotEnabled } = useChatbot();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [ollamaActionLoading, setOllamaActionLoading] = useState<OllamaAction | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModelInfo[]>([]);
  const [ollamaRuntimeStatus, setOllamaRuntimeStatus] = useState<OllamaRuntimeStatus>({ running: false, activeModel: null, runningModels: [] });
  const [activeTab, setActiveTab] = useState<string>('llm');
  const [formData, setFormData] = useState<SettingsFormData>(defaultFormData);

  useEffect(() => {
    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistCurrentLlmSettings = async (): Promise<void> => {
    const payload = {
      llmProvider: formData.llmProvider,
      llmModel: formData.llmModel,
      ollamaBaseUrl: formData.ollamaBaseUrl,
      ollamaVisionModel: formData.ollamaVisionModel,
      ollamaKeepAlive: formData.ollamaKeepAlive,
      ollamaNumCtx: Number(formData.ollamaNumCtx)
    };

    let response: Response;
    if (settings?.id) {
      response = await authPut(`/api/settings/${settings.id}`, payload);
    } else {
      response = await authPost('/api/settings', payload);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Failed to save LLM settings');
    }

    setSettings(data);
  };

  const fetchOllamaStatus = async (): Promise<void> => {
    try {
      setOllamaActionLoading('status');
      const baseUrl = encodeURIComponent(formData.ollamaBaseUrl || 'http://127.0.0.1:11434');
      const response = await authGet('/api/llm/ollama/status?baseUrl=' + baseUrl);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to get Ollama runtime status');
      }

      setOllamaRuntimeStatus({
        running: Boolean(payload.running),
        activeModel: payload.activeModel || null,
        runningModels: Array.isArray(payload.runningModels) ? payload.runningModels : []
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get Ollama runtime status';
      logger.error('Error fetching Ollama runtime status:', error);
      toast.error(message);
    } finally {
      setOllamaActionLoading(current => (current === 'status' ? null : current));
    }
  };
  const fetchOllamaModels = async (): Promise<void> => {
    try {
      setOllamaActionLoading('refresh');
      const baseUrl = encodeURIComponent(formData.ollamaBaseUrl || 'http://127.0.0.1:11434');
      const response = await authGet(`/api/llm/ollama/models?baseUrl=${baseUrl}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to list Ollama models');
      }

      setOllamaModels(Array.isArray(payload.models) ? payload.models : []);
      toast.success('Liste des modeles Ollama actualisee.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list Ollama models';
      logger.error('Error refreshing Ollama models:', error);
      toast.error(message);
    } finally {
      setOllamaActionLoading(null);
    }
  };

  useEffect(() => {
    if (formData.llmProvider === 'ollama') {
      void fetchOllamaStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.llmProvider, formData.ollamaBaseUrl]);
  const fetchSettings = async (): Promise<void> => {
    try {
      const response = await authGet('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');

      const data: Settings = await response.json();
      setSettings(data);
      setFormData({
        llmProvider: data.llmProvider || 'openai',
        llmModel: data.llmModel || 'gpt-4o',
        ollamaBaseUrl: data.ollamaBaseUrl || 'http://127.0.0.1:11434',
        ollamaVisionModel: data.ollamaVisionModel || '',
        ollamaKeepAlive: data.ollamaKeepAlive || '5m',
        ollamaNumCtx: data.ollamaNumCtx || 8192,
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

  const runOllamaAction = async (action: Exclude<OllamaAction, 'refresh'>): Promise<void> => {
    const model = String(formData.llmModel || '').trim();
    if (!model) {
      toast.error('Veuillez renseigner un modele Ollama.');
      return;
    }

    try {
      setOllamaActionLoading(action);
      await persistCurrentLlmSettings();
      const response = await authPost(`/api/llm/ollama/${action}`, {
        model,
        baseUrl: formData.ollamaBaseUrl,
        keepAlive: formData.ollamaKeepAlive,
        numCtx: formData.ollamaNumCtx
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Failed to ${action} Ollama model`);
      }

      await fetchOllamaStatus();

      if (action === 'pull') {
        toast.success(`Modele ${model} telecharge avec succes.`);
      } else if (action === 'run') {
        toast.success(`Modele ${model} charge dans Ollama.`);
      } else {
        toast.success(`Modele ${model} arrete dans Ollama.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${action} Ollama model`;
      logger.error(`Error during Ollama ${action}:`, error);
      toast.error(message);
    } finally {
      setOllamaActionLoading(null);
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
        toast.error(`La somme des poids doit etre egale a 100% (actuellement: ${totalWeight}%)`);
        setSaving(false);
        return;
      }

      const chatbotValue = formData.chatbotEnabled;
      const dataToSave = {
        ...formData,
        chatbotEnabled: chatbotValue === 'on' || (chatbotValue as unknown) === true ? 'on' : 'off',
        ollamaNumCtx: Number(formData.ollamaNumCtx),
        'Executive Summary Weight': Number(formData['Executive Summary Weight']),
        'Skills Weight': Number(formData['Skills Weight']),
        'Experience Weight': Number(formData['Experience Weight']),
        'Education Weight': Number(formData['Education Weight']),
        'ATS Weight': Number(formData['ATS Weight']),
        'Hobbies Languages Weight': Number(formData['Hobbies Languages Weight'])
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
        llmModel: defaults.llmModel || 'gpt-4o',
        ollamaBaseUrl: defaults.ollamaBaseUrl || 'http://127.0.0.1:11434',
        ollamaVisionModel: defaults.ollamaVisionModel || '',
        ollamaKeepAlive: defaults.ollamaKeepAlive || '5m',
        ollamaNumCtx: defaults.ollamaNumCtx || 8192,
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
        <nav className="-mb-px flex flex-wrap gap-x-1 gap-y-1">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={
                  `flex items-center py-2 px-1.5 border-b-2 font-medium text-[11px] leading-tight ${isActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`
                }
              >
                <IconComponent className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 overflow-visible">
        {activeTab === 'llm' && (
          <LLMTab
            formData={formData}
            onInputChange={handleInputChange}
            onOllamaPull={() => runOllamaAction('pull')}
            onOllamaRun={() => runOllamaAction('run')}
            onOllamaStop={() => runOllamaAction('stop')}
            onOllamaRefreshModels={fetchOllamaModels}
            onOllamaRefreshStatus={fetchOllamaStatus}
            ollamaActionLoading={ollamaActionLoading}
            ollamaModels={ollamaModels}
            ollamaRuntimeStatus={ollamaRuntimeStatus}
            t={t}
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
            className={`btn btn-primary px-6 py-2 font-medium ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {saving ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default SettingsPage;

