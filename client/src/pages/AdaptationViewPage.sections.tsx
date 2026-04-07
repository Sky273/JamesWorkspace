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
    <div className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="cv-surface mx-auto max-w-5xl rounded-[2.5rem] p-6 sm:p-8">
        <div className="cv-panel flex h-64 items-center justify-center rounded-[2rem]">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--cv-primary)]"></div>
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
    <div className="editorial-migrated-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="cv-surface mx-auto max-w-5xl rounded-[2.5rem] p-6 sm:p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="cv-panel rounded-[2rem] p-8 sm:p-12">
            <DocumentTextIcon className="mx-auto mb-4 h-16 w-16 text-slate-400" />
            <h2 className="cv-display mb-4 text-2xl font-bold text-slate-950 dark:text-[var(--cv-text)]">
              {t('errors.adaptationNotFound')}
            </h2>
            <p className="mb-6 text-slate-600 dark:text-[var(--cv-muted)]">
              {error || t('errors.adaptationNotFoundDescription')}
            </p>
            <button
              onClick={onBack}
              className="cv-ghost-button inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold"
            >
              <ArrowLeftIcon className="h-5 w-5" />
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
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-4">
      <button
        onClick={onBack}
        className="cv-ghost-button inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium"
      >
        <ArrowLeftIcon className="h-5 w-5" />
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
    <div className="border-b border-slate-200 dark:border-white/10">
      <nav className="flex flex-wrap gap-2 px-6 py-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-[var(--cv-muted)] dark:hover:bg-white/[0.04] dark:hover:text-[var(--cv-text)]'
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
      className="glass-panel-strong overflow-hidden rounded-[2rem]"
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
    <div className="flex flex-wrap justify-end gap-3">
      <button
        onClick={onExport}
        className="btn btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
      >
        <ArrowDownTrayIcon className="h-4 w-4" />
        {t('adaptations.exportPDF')}
      </button>
      <button
        onClick={onSendEmail}
        className="btn btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
      >
        <EnvelopeIcon className="h-4 w-4" />
        {t('adaptations.sendEmail', 'Envoyer par email')}
      </button>
      <button
        onClick={onSave}
        disabled={!hasChanges || saving}
        className={`btn btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm ${
          !hasChanges || saving ? 'cursor-not-allowed opacity-50' : ''
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
          <p className="italic text-slate-500 dark:text-[var(--cv-muted)]">{t('adaptations.noAdaptedText')}</p>
        )}
      </div>
    );
  }

  if (activeTab === 'analysis') {
    return adaptation['Match Analysis'] ? (
      <AdaptationAnalysisView adaptation={adaptation} />
    ) : (
      <p className="italic text-slate-500 dark:text-[var(--cv-muted)]">{t('adaptations.noAnalysis')}</p>
    );
  }

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
        {adaptation['Mission Title'] || t('adaptations.card.unknownMission')}
      </h3>
      {adaptation['Mission Content'] ? (
        <div
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={createSafeHtml(adaptation['Mission Content'])}
        />
      ) : (
        <p className="italic text-slate-500 dark:text-[var(--cv-muted)]">{t('missions.noDescription')}</p>
      )}
    </div>
  );
}
