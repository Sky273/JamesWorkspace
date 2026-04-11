/**
 * SettingsPage Component
 * TypeScript version
 */

import { motion } from 'framer-motion';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { LLMTab, PromptsTab, WeightsTab, ChatbotTab, GdprTab, DpoTab } from '../components/SettingsPage';
import SettingsHeader from '../components/SettingsPage/SettingsHeader';
import SettingsTabsNav from '../components/SettingsPage/SettingsTabsNav';
import SettingsApiDocsPanel from '../components/SettingsPage/SettingsApiDocsPanel';
import SettingsActionsFooter from '../components/SettingsPage/SettingsActionsFooter';
import { useSettingsPage } from './SettingsPage.hooks';

const SettingsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const {
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
  } = useSettingsPage();

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="cv-surface app-page-shell max-w-6xl"
      >
        <div className="section-shell rounded-[2rem] p-8">
          <div className="flex items-start gap-4">
            <ArrowPathIcon className="mt-1 h-6 w-6 animate-spin text-primary-500" />
            <div className="flex-1 space-y-4">
              <div>
                <div className="h-8 w-72 max-w-full rounded-full bg-gray-200/80 dark:bg-gray-700/70 animate-pulse" />
                <div className="mt-3 h-4 w-[32rem] max-w-full rounded-full bg-gray-200/70 dark:bg-gray-700/60 animate-pulse" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="h-24 rounded-3xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                <div className="h-24 rounded-3xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                <div className="h-24 rounded-3xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.loading')}</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!settings) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="cv-surface app-page-shell max-w-6xl"
      >
        <div className="section-shell rounded-[2rem] p-8">
          <div className="flex items-start gap-4">
            <ExclamationTriangleIcon className="mt-1 h-6 w-6 text-amber-500" />
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Unable to load settings
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                  The settings data could not be loaded. Reload the page to try again.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="cv-gradient-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="cv-surface app-page-shell max-w-6xl"
    >
      <SettingsHeader t={t} />

      <div className="section-shell rounded-[2rem] p-4 mb-6">
        <SettingsTabsNav
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      <div className="section-shell rounded-[2rem] p-6 overflow-visible">
        {activeTab === 'llm' && (
          <LLMTab
            formData={formData}
            onInputChange={handleInputChange}
            onTestConnection={handleTestConnection}
            testingConnection={testingConnection}
            t={t}
            llmAvailability={settings?.llmAvailability}
            llmModelCatalog={{
              ...(settings?.llmModelCatalog || {}),
              ollama: ollamaModelCatalog
            }}
            llmParameterDefinitions={settings?.llmParameterDefinitions}
            ollamaDiscoveryLoading={ollamaDiscoveryLoading}
            ollamaModelCapabilities={ollamaModelCapabilities}
          />
        )}

        {activeTab === 'prompts' && (
          <PromptsTab
            formData={formData}
            onInputChange={handleInputChange}
            t={t}
            promptGovernance={settings?.promptGovernance}
            promptVersionState={settings?.promptVersionState}
          />
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
