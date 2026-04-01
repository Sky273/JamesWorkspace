import type { JSX, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

export function AdaptationLoadingState(): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    </div>
  );
}

export function AdaptationErrorState({
  error,
  onBack,
  t,
}: {
  error: string;
  onBack: () => void;
  t: (key: string) => string;
}): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {t('errors.adaptationNotFound')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error || t('errors.adaptationNotFoundDescription')}
            </p>
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              {t('common.back')}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function AdaptationBackButton({
  onBack,
  t,
}: {
  onBack: () => void;
  t: (key: string) => string;
}): JSX.Element {
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        {t('common.back')}
      </button>
    </motion.div>
  );
}

export function AdaptationTabs({
  activeTab,
  onTabChange,
  t,
}: {
  activeTab: 'adapted' | 'analysis' | 'mission';
  onTabChange: (tab: 'adapted' | 'analysis' | 'mission') => void;
  t: (key: string) => string;
}): JSX.Element {
  const tabs = [
    { key: 'adapted' as const, label: t('adaptations.tabs.adaptedCV') },
    { key: 'analysis' as const, label: t('adaptations.tabs.analysis') },
    { key: 'mission' as const, label: t('adaptations.tabs.mission') },
  ];

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <nav className="flex -mb-px">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function AdaptationPanel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
    >
      {children}
    </motion.div>
  );
}
