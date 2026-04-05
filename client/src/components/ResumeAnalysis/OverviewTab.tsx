/**
 * Overview Tab Component for Resume Analysis
 * TypeScript version
 */

import { useState } from 'react';
import { AnalysisPanel } from './OverviewTab.parts';
import {
  buildInitialSections,
  buildPostImprovementSections,
  buildScoreSet,
  hasResumeImprovement,
  parseImprovements,
  type ResumeAnalysisOverviewResume,
} from './OverviewTab.utils';

interface OverviewTabProps {
  resume: ResumeAnalysisOverviewResume;
  t: (key: string) => string;
}

const OverviewTab = ({ resume, t }: OverviewTabProps): JSX.Element => {
  const isImproved = hasResumeImprovement(resume);
  const [activeSubTab, setActiveSubTab] = useState<'initial' | 'postImprovement'>('postImprovement');

  const { bySection: initialSuggestions } = parseImprovements(resume['Key Improvements']);
  const { bySection: improvedSuggestions } = parseImprovements(resume['Improved Key Improvements']);

  const initialScores = buildScoreSet(resume, false);
  const improvedScores = buildScoreSet(resume, true);
  const initialSections = buildInitialSections(initialScores, initialSuggestions, t);
  const postImprovementSections = buildPostImprovementSections(initialScores, improvedScores, improvedSuggestions, t);

  if (!isImproved) {
    return (
      <AnalysisPanel
        globalScore={initialScores.global}
        sections={initialSections}
        t={t}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-[1.5rem] bg-slate-50/90 p-2 ring-1 ring-slate-200/80 dark:bg-white/[0.03] dark:ring-white/10">
        <button
          type="button"
          onClick={() => setActiveSubTab('initial')}
          className={`inline-flex min-h-11 items-center rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeSubTab === 'initial'
              ? 'bg-[var(--cv-primary-soft)] text-[var(--cv-primary)] ring-1 ring-[color:color-mix(in_srgb,var(--cv-primary)_16%,transparent)]'
              : 'text-slate-500 hover:bg-white hover:text-slate-900 dark:text-[var(--cv-muted)] dark:hover:bg-white/[0.06] dark:hover:text-[var(--cv-text)]'
          }`}
        >
          {t('resume.analysis.tabs.initialAnalysis') || 'Analyse initiale'}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('postImprovement')}
          className={`inline-flex min-h-11 items-center rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeSubTab === 'postImprovement'
              ? 'bg-[var(--cv-primary-soft)] text-[var(--cv-primary)] ring-1 ring-[color:color-mix(in_srgb,var(--cv-primary)_16%,transparent)]'
              : 'text-slate-500 hover:bg-white hover:text-slate-900 dark:text-[var(--cv-muted)] dark:hover:bg-white/[0.06] dark:hover:text-[var(--cv-text)]'
          }`}
        >
          {t('resume.analysis.tabs.postImprovementAnalysis') || 'Analyse post-amélioration'}
        </button>
      </div>

      {activeSubTab === 'initial' ? (
        <AnalysisPanel
          globalScore={initialScores.global}
          sections={initialSections}
          t={t}
        />
      ) : (
        <AnalysisPanel
          globalScore={improvedScores.global}
          sections={postImprovementSections}
          t={t}
          showComparison={true}
          comparisonScore={initialScores.global}
        />
      )}
    </div>
  );
};

export default OverviewTab;
