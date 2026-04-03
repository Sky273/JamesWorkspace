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
      <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setActiveSubTab('initial')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeSubTab === 'initial'
              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-500'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {t('resume.analysis.tabs.initialAnalysis') || 'Analyse initiale'}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('postImprovement')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeSubTab === 'postImprovement'
              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-500'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
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
