import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  Cog6ToothIcon,
  SparklesIcon,
  ScaleIcon,
  BanknotesIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { useAuthFetch } from '../hooks/useAuthFetch';
import { useChatbot } from '../context/ChatbotContext';
import logger from '../utils/logger.frontend';
import { getResponseErrorMessage } from '../utils/apiInterceptor';
import type { ResponsivePageTabOption } from '../components/page/ResponsivePageTabs';
import {
  defaultFormData,
  getTotalWeight as getSettingsTotalWeight,
  toFormData,
  type OllamaModelCapability,
  type Settings,
  type SettingsFormData,
} from './SettingsPage.utils';
import { setPublicHomeEnabledRuntimeValue } from '../app/publicHomeSetting';
import {
  applyDiscoveredOllamaModel,
  buildSettingsSavePayload,
  discoverOllamaModels,
  validateSettingsBeforeSave,
} from './SettingsPage.hookUtils';

export {
  createSavePayload,
  defaultFormData,
  getDefaultModelForProvider,
  getTotalWeight,
  toFormData,
} from './SettingsPage.utils';

export function useSettingsPage() {
  const { t } = useTranslation();
  const getFallbackText = useCallback((key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  }, [t]);
  const { authGet, authPost, authPut } = useAuthFetch();
  const { setChatbotEnabled } = useChatbot();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
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
      const data = await discoverOllamaModels(authGet, baseUrl, selectedModel);

      setOllamaModelCatalog(data.models || []);
      setOllamaModelCapabilities(data.capabilitiesByModel || {});

      if (formData.llmProvider === 'ollama') {
        const nextModel = selectedModel || formData.llmModel;
        const discoveredModel = applyDiscoveredOllamaModel(nextModel, data.models || []);
        if (discoveredModel) {
          setFormData((prev) => ({
            ...prev,
            llmModel: discoveredModel
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

      const validation = validateSettingsBeforeSave(formData, t);
      if (!validation.valid) {
        toast.error(validation.message);
        return;
      }

      const payloadResult = buildSettingsSavePayload(formData);
      if ('error' in payloadResult) {
        toast.error(payloadResult.error);
        return;
      }
      const dataToSave = payloadResult.payload;
      logger.log('[SettingsPage] Saving settings with data:', JSON.stringify(dataToSave, null, 2));

      const response = settings?.id
        ? await authPut(`/api/settings/${settings.id}`, dataToSave)
        : await authPost('/api/settings', dataToSave);

      if (!response.ok) throw new Error('Failed to save settings');

      const data = await response.json();
      setSettings(data);
      setFormData(toFormData(data));
      setChatbotEnabled(dataToSave.chatbotEnabled === 'on');
      if (typeof data.publicHomeEnabled === 'boolean') {
        setPublicHomeEnabledRuntimeValue(data.publicHomeEnabled);
      } else {
        setPublicHomeEnabledRuntimeValue(Boolean(formData.publicHomeEnabled));
      }
      toast.success(t('settings.saveSuccess'));
    } catch (error) {
      logger.error('Error saving settings:', error);
      toast.error(t('settings.saveError'));
    } finally {
      setSaving(false);
    }
  }, [authPost, authPut, formData, setChatbotEnabled, settings?.id, t]);

  const handleTestConnection = useCallback(async (): Promise<void> => {
    try {
      setTestingConnection(true);

      const payloadResult = buildSettingsSavePayload(formData);
      if ('error' in payloadResult) {
        toast.error(payloadResult.error);
        return;
      }

      const response = await authPost('/api/settings/test-llm', payloadResult.payload);
      if (!response.ok) {
        const errorMessage = await getResponseErrorMessage(response, 'Failed to test LLM settings');
        throw new Error(errorMessage);
      }

      const data = await response.json() as { provider?: string; model?: string; contentPreview?: string };
      const summary = [data.provider, data.model].filter(Boolean).join(' / ');
      toast.success(data.contentPreview
        ? `Test OK: ${summary} - ${data.contentPreview}`
        : `Test OK: ${summary}`);
    } catch (error) {
      logger.error('Error testing LLM settings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to test LLM settings');
    } finally {
      setTestingConnection(false);
    }
  }, [authPost, formData]);

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

  const totalWeight = useMemo(() => getSettingsTotalWeight(formData), [formData]);

  const tabs = useMemo<ResponsivePageTabOption<string>[]>(() => ([
    { value: 'llm', label: getFallbackText('settings.tabs.llm', 'Modèle LLM'), icon: SparklesIcon },
    { value: 'prompts', label: getFallbackText('settings.tabs.prompts', 'Prompts'), icon: Cog6ToothIcon },
    { value: 'weights', label: getFallbackText('settings.tabs.weights', 'Poids'), icon: ScaleIcon },
    { value: 'credits', label: getFallbackText('settings.tabs.credits', 'Crédits IA'), icon: BanknotesIcon },
    { value: 'chatbot', label: getFallbackText('settings.tabs.chatbot', 'Chatbot'), icon: ChatBubbleLeftRightIcon },
    { value: 'gdpr', label: getFallbackText('settings.tabs.gdpr', 'RGPD'), icon: ShieldCheckIcon },
    { value: 'dpo', label: getFallbackText('settings.tabs.dpo', 'Contact DPO'), icon: UserCircleIcon },
    { value: 'swagger', label: getFallbackText('settings.tabs.apiDocs', 'Documentation API'), icon: DocumentTextIcon }
  ]), [getFallbackText]);

  return {
    t,
    settings,
    loading,
    saving,
    testingConnection,
    ollamaDiscoveryLoading,
    ollamaModelCatalog,
    ollamaModelCapabilities,
    activeTab,
    setActiveTab,
    formData,
    tabs,
    totalWeight,
    handleSave,
    handleTestConnection,
    handleInputChange,
    resetToDefaults,
    fetchOllamaModels
  };
}
