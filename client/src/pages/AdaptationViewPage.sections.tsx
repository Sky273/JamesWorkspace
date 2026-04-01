import type { JSX, ReactNode, RefObject } from 'react';
import type { TFunction } from 'i18next';
import { motion } from 'framer-motion';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { DeferredTiptapEditor as TiptapEditor } from '../components/TiptapEditor';
import AdaptationAnalysisView from '../components/AdaptationAnalysisView';
import { createSafeHtml } from '../utils/sanitizer.frontend';
import type { TiptapEditorRef } from '../components/TiptapEditor';
import type { Adaptation, AdaptationViewTab } from './AdaptationViewPage.types';

type TranslateFn = TFunction<'translation', undefined>;

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
  t: TranslateFn;
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
  t: TranslateFn;
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
  activeTab: AdaptationViewTab;
  onTabChange: (tab: AdaptationViewTab) => void;
  t: TranslateFn;
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

export function AdaptationActionBar({
  hasChanges,
  saving,
  onExport,
  onSendEmail,
  onSave,
  t,
}: {
  hasChanges: boolean;
  saving: boolean;
  onExport: () => void;
  onSendEmail: () => void;
  onSave: () => void;
  t: TranslateFn;
}): JSX.Element {
  return (
    <div className="flex justify-end gap-3">
      <button
        onClick={onExport}
        className="btn btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
      >
        <ArrowDownTrayIcon className="w-4 h-4" />
        {t('adaptations.exportPDF')}
      </button>
      <button
        onClick={onSendEmail}
        className="btn btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
      >
        <EnvelopeIcon className="w-4 h-4" />
        {t('adaptations.sendEmail', 'Envoyer par email')}
      </button>
      <button
        onClick={onSave}
        disabled={!hasChanges || saving}
        className={`btn btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm ${
          !hasChanges || saving ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {saving ? t('common.saving') : t('common.save')}
      </button>
    </div>
  );
}

export function AdaptationTabContent({
  activeTab,
  adaptation,
  editorRef,
  hasChanges,
  saving,
  onEditorChange,
  onEditorReady,
  onExport,
  onSendEmail,
  onSave,
  t,
}: {
  activeTab: AdaptationViewTab;
  adaptation: Adaptation;
  editorRef: RefObject<TiptapEditorRef | null>;
  hasChanges: boolean;
  saving: boolean;
  onEditorChange: () => void;
  onEditorReady: () => void;
  onExport: () => void;
  onSendEmail: () => void;
  onSave: () => void;
  t: TranslateFn;
}): JSX.Element {
  if (activeTab === 'adapted') {
    return (
      <div className="space-y-4">
        {adaptation['Adapted Text'] ? (
          <>
            <AdaptationActionBar
              hasChanges={hasChanges}
              saving={saving}
              onExport={onExport}
              onSendEmail={onSendEmail}
              onSave={onSave}
              t={t}
            />
            <TiptapEditor
              ref={editorRef}
              content={adaptation['Adapted Text']}
              onChange={onEditorChange}
              onReady={onEditorReady}
              height={500}
            />
          </>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 italic">{t('adaptations.noAdaptedText')}</p>
        )}
      </div>
    );
  }

  if (activeTab === 'analysis') {
    return adaptation['Match Analysis'] ? (
      <AdaptationAnalysisView adaptation={adaptation} />
    ) : (
      <p className="text-gray-500 dark:text-gray-400 italic">{t('adaptations.noAnalysis')}</p>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {adaptation['Mission Title'] || t('adaptations.card.unknownMission')}
      </h3>
      {adaptation['Mission Content'] ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={createSafeHtml(adaptation['Mission Content'])}
        />
      ) : (
        <p className="text-gray-500 dark:text-gray-400 italic">{t('missions.noDescription')}</p>
      )}
    </div>
  );
}
