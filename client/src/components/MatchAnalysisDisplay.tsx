/**
 * Match Analysis Display Component
 * TypeScript version
 */

import { motion } from 'framer-motion';
import { CheckCircleIcon, ExclamationTriangleIcon, SparklesIcon, ChartBarIcon } from '@heroicons/react/24/outline';

interface Recommendations {
  executiveSummary?: string[];
  skills?: string[];
  experience?: string[];
  education?: string[];
  atsOptimization?: string[];
  [key: string]: string[] | undefined;
}

interface Analysis {
  matchScore?: string | number;
  score?: number;
  strengths?: string[];
  gaps?: string[];
  keywordMatches?: string[];
  missingKeywords?: string[];
  recommendations?: Recommendations | string[];
}

interface MatchAnalysisDisplayProps {
  analysis: Analysis | null;
  onContinue?: () => void;
  onCancel?: () => void;
  hideActions?: boolean;
}

const MatchAnalysisDisplay = ({ analysis, onContinue, onCancel, hideActions = false }: MatchAnalysisDisplayProps): JSX.Element | null => {
  if (!analysis) return null;

  const matchScore = parseInt(String(analysis.matchScore)) || 0;

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/20';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  const sectionTitles: Record<string, string> = {
    executiveSummary: 'Résumé Exécutif',
    skills: 'Compétences',
    experience: 'Expérience',
    education: 'Formation',
    atsOptimization: 'Optimisation ATS'
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className={`p-6 rounded-lg ${getScoreBgColor(matchScore)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Score de Correspondance</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Analyse de l'adéquation CV-Mission</p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${getScoreColor(matchScore)}`}>{matchScore}%</div>
            <div className="flex items-center justify-end mt-1">
              <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full transition-all ${matchScore >= 80 ? 'bg-green-500' : matchScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${matchScore}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {analysis.strengths && analysis.strengths.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4"><CheckCircleIcon className="w-6 h-6 text-green-500" /><h4 className="font-semibold text-gray-900 dark:text-gray-100">Points Forts</h4></div>
            <ul className="space-y-2">{analysis.strengths.map((strength, index) => (<li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"><span className="text-green-500 mt-0.5">✓</span><span>{strength}</span></li>))}</ul>
          </div>
        )}
        {analysis.gaps && analysis.gaps.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4"><ExclamationTriangleIcon className="w-6 h-6 text-yellow-500" /><h4 className="font-semibold text-gray-900 dark:text-gray-100">Lacunes Identifiées</h4></div>
            <ul className="space-y-2">{analysis.gaps.map((gap, index) => (<li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"><span className="text-yellow-500 mt-0.5">⚠</span><span>{gap}</span></li>))}</ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {analysis.keywordMatches && analysis.keywordMatches.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4"><ChartBarIcon className="w-6 h-6 text-blue-500" /><h4 className="font-semibold text-gray-900 dark:text-gray-100">Mots-clés Présents</h4></div>
            <div className="flex flex-wrap gap-2">{analysis.keywordMatches.map((keyword, index) => (<span key={index} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">{keyword}</span>))}</div>
          </div>
        )}
        {analysis.missingKeywords && analysis.missingKeywords.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4"><SparklesIcon className="w-6 h-6 text-purple-500" /><h4 className="font-semibold text-gray-900 dark:text-gray-100">Mots-clés Manquants</h4></div>
            <div className="flex flex-wrap gap-2">{analysis.missingKeywords.map((keyword, index) => (<span key={index} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm">{keyword}</span>))}</div>
          </div>
        )}
      </div>

      {analysis.recommendations && (Array.isArray(analysis.recommendations) ? analysis.recommendations.length > 0 : Object.keys(analysis.recommendations).length > 0) && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">💡 Recommandations d'Adaptation</h4>
          <div className="space-y-4">
            {Array.isArray(analysis.recommendations) ? (
              <ul className="space-y-1 ml-4">
                {analysis.recommendations.map((rec: string, index: number) => (
                  <li key={index} className="text-sm text-gray-600 dark:text-gray-400 list-disc">{rec}</li>
                ))}
              </ul>
            ) : (
              Object.entries(analysis.recommendations).map(([section, recommendations]) => {
                if (!recommendations || recommendations.length === 0) return null;
                return (
                  <div key={section}>
                    <h5 className="font-medium text-gray-800 dark:text-gray-200 mb-2">{sectionTitles[section] || section}</h5>
                    <ul className="space-y-1 ml-4">{recommendations.map((rec: string, index: number) => (<li key={index} className="text-sm text-gray-600 dark:text-gray-400 list-disc">{rec}</li>))}</ul>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {!hideActions && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onCancel} className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Annuler</button>
          <button onClick={onContinue} className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"><SparklesIcon className="w-5 h-5" />Générer CV Adapté</button>
        </div>
      )}
    </motion.div>
  );
};

export default MatchAnalysisDisplay;
