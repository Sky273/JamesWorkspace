import { AnimatePresence, motion } from 'framer-motion';
import { SparklesIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import MatchAnalysisDisplay from '../MatchAnalysisDisplay';
import AdaptationComparison from '../AdaptationComparison';
import type { MatchAnalysis } from '../../utils/resumeAdaptationService';

interface Resume {
  Name?: string;
  Title?: string;
  'Original Text'?: string;
  'Improved Text'?: string;
}

interface Mission {
  Title?: string;
}

interface Adaptation {
  adaptedText?: string;
  'Adapted Text'?: string;
  matchScore?: string | number;
  'Match Score'?: string | number;
  adaptationId?: string;
}

interface AdaptResultPanelProps {
  resume: Resume;
  mission: Mission | null;
  adaptation: Adaptation;
  analysis: MatchAnalysis | null;
  activeTab: 'analysis' | 'adapted';
  onTabChange: (tab: 'analysis' | 'adapted') => void;
  onNewAdaptation: () => void;
  onViewAdaptation: () => void;
  t: TFunction;
}

export default function AdaptResultPanel({
  resume,
  mission,
  adaptation,
  analysis,
  activeTab,
  onTabChange,
  onNewAdaptation,
  onViewAdaptation,
  t
}: AdaptResultPanelProps): JSX.Element {
  return (
    <motion.div
      key="show-result"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-6"
    >
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-green-500" />
          {t('adaptation.result', "Résultat de l'adaptation")}
        </h3>
        <span className="text-sm text-gray-500">
          Mission: {mission?.Title}
        </span>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-8">
          <button
            onClick={() => onTabChange('analysis')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'analysis'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {t('adaptation.tabs.analysis', "Analyse d'adéquation")}
          </button>
          <button
            onClick={() => onTabChange('adapted')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'adapted'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {t('adaptation.tabs.adapted')}
          </button>
        </nav>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'analysis' && analysis && (
          <motion.div
            key="analysis-tab"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <MatchAnalysisDisplay analysis={analysis} hideActions={true} />
          </motion.div>
        )}
        {activeTab === 'adapted' && (
          <motion.div
            key="adapted-tab"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <AdaptationComparison
              originalText={resume['Original Text'] || resume['Improved Text'] || ''}
              adaptedText={adaptation.adaptedText || adaptation['Adapted Text'] || ''}
              matchScore={adaptation.matchScore || adaptation['Match Score']}
              candidateName={resume.Name || 'Candidat'}
              candidateTitle={resume.Title || 'Titre professionnel'}
              simplified={true}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onNewAdaptation}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          {t('adaptation.newAdaptation')}
        </button>
        <button
          onClick={onViewAdaptation}
          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          {t('adaptation.viewAdaptation', "Voir l'adaptation")}
        </button>
      </div>
    </motion.div>
  );
}
