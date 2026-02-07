/**
 * Adaptation Analysis View Component
 * TypeScript version
 */

import { CheckCircleIcon, ExclamationTriangleIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import logger from '../utils/logger.frontend';

interface MatchAnalysis {
  matchScore?: string | number;
  strengths?: string[];
  gaps?: string[];
  keywordMatches?: string[];
  missingKeywords?: string[];
}

interface Adaptation {
  matchAnalysis?: MatchAnalysis | string;
  'Match Analysis'?: MatchAnalysis | string;
  Strengths?: string | string[];
  Gaps?: string | string[];
  'Keyword Matches'?: string | string[];
  'Missing Keywords'?: string | string[];
  [key: string]: unknown;
}

interface AdaptationAnalysisViewProps {
  adaptation: Adaptation | null;
}

const AdaptationAnalysisView = ({ adaptation }: AdaptationAnalysisViewProps): JSX.Element | null => {
  if (!adaptation) return null;

  const matchAnalysisRaw: MatchAnalysis | string | null = (adaptation.matchAnalysis || adaptation['Match Analysis']) as MatchAnalysis | string | null;
  let matchAnalysis: MatchAnalysis | null = null;
  if (typeof matchAnalysisRaw === 'string') {
    try {
      matchAnalysis = JSON.parse(matchAnalysisRaw);
    } catch (e) {
      logger.error('Error parsing Match Analysis:', e);
      matchAnalysis = null;
    }
  } else {
    matchAnalysis = matchAnalysisRaw;
  }

  if (!matchAnalysis) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Aucune analyse d'adéquation disponible pour cette adaptation.</p>
      </div>
    );
  }

  const matchScore = parseInt(String(matchAnalysis.matchScore)) || 0;

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

  const parseArrayField = (field: string | string[] | undefined, fallback: string[] = []): string[] => {
    if (!field) return fallback;
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
      if (field.includes('\n')) return field.split('\n').filter(s => s.trim());
      if (field.includes(',')) return field.split(',').map(k => k.trim()).filter(k => k);
      return [field];
    }
    return fallback;
  };

  const strengths = parseArrayField(adaptation.Strengths, matchAnalysis.strengths || []);
  const gaps = parseArrayField(adaptation.Gaps, matchAnalysis.gaps || []);
  const keywordMatches = parseArrayField(adaptation['Keyword Matches'], matchAnalysis.keywordMatches || []);
  const missingKeywords = parseArrayField(adaptation['Missing Keywords'], matchAnalysis.missingKeywords || []);

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-lg ${getScoreBgColor(matchScore)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Score de Correspondance</h3>
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
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4"><CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" /><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Points Forts</h3></div>
          {strengths.length > 0 ? (
            <ul className="space-y-2">{strengths.map((strength, index) => (<li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"><span className="text-green-500 mt-1">✓</span><span>{strength}</span></li>))}</ul>
          ) : (<p className="text-sm text-gray-500 dark:text-gray-400">Aucun point fort identifié</p>)}
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4"><ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" /><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Lacunes Identifiées</h3></div>
          {gaps.length > 0 ? (
            <ul className="space-y-2">{gaps.map((gap, index) => (<li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"><span className="text-yellow-500 mt-1">⚠</span><span>{gap}</span></li>))}</ul>
          ) : (<p className="text-sm text-gray-500 dark:text-gray-400">Aucune lacune identifiée</p>)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4"><ChartBarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" /><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Mots-clés Présents</h3></div>
          {keywordMatches.length > 0 ? (
            <div className="flex flex-wrap gap-2">{keywordMatches.map((keyword, index) => (<span key={index} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">{keyword}</span>))}</div>
          ) : (<p className="text-sm text-gray-500 dark:text-gray-400">Aucun mot-clé identifié</p>)}
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4"><ChartBarIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" /><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Mots-clés Manquants</h3></div>
          {missingKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">{missingKeywords.map((keyword, index) => (<span key={index} className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">{keyword}</span>))}</div>
          ) : (<p className="text-sm text-gray-500 dark:text-gray-400">Aucun mot-clé manquant</p>)}
        </div>
      </div>
    </div>
  );
};

export default AdaptationAnalysisView;
