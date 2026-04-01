/**
 * SettingsPage Component
 * TypeScript version
 */

import { motion } from 'framer-motion';
import { LLMTab, PromptsTab, WeightsTab, ChatbotTab, GdprTab, DpoTab } from '../components/SettingsPage';
import SettingsHeader from '../components/SettingsPage/SettingsHeader';
import SettingsTabsNav from '../components/SettingsPage/SettingsTabsNav';
import SettingsApiDocsPanel from '../components/SettingsPage/SettingsApiDocsPanel';
import SettingsActionsFooter from '../components/SettingsPage/SettingsActionsFooter';
import { useSettingsPage } from './SettingsPage.hooks';

const SettingsPage = (): JSX.Element => {
  const {
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
  } = useSettingsPage();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">{t('settings.loading')}</div>
      </div>
    );
  }

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
