import { SparklesIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { DetailedProfileAnalysisResponse } from '../../types/entities';
import { getScoreColor } from './helpers';

interface ProfileMatchDetailedAnalysisProps {
  analysis: DetailedProfileAnalysisResponse['analysis'];
  t: TFunction;
}

export default function ProfileMatchDetailedAnalysis({ analysis, t }: ProfileMatchDetailedAnalysisProps) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-purple-500" />
          {t('profileMatching.detailedAnalysis.title')}
        </h4>
        <span className={`text-lg font-bold ${getScoreColor(analysis.overallScore)}`}>
          {analysis.overallScore}%
        </span>
      </div>

      <div className="text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">{t('profileMatching.detailedAnalysis.verdict')}: </span>
        <span className="text-gray-900 dark:text-gray-100">{analysis.verdict}</span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 italic">{analysis.summary}</p>

      {analysis.strengths?.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">
            {t('profileMatching.detailedAnalysis.strengths')}
          </h5>
          <div className="space-y-1">
            {analysis.strengths.map((strength, idx) => (
              <div key={idx} className="text-xs bg-green-100 dark:bg-green-900/30 rounded p-2">
                <span className="font-medium text-green-800 dark:text-green-300">{strength.item}</span>
                <span className="text-green-700 dark:text-green-400"> - {strength.explanation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.gaps?.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">
            {t('profileMatching.detailedAnalysis.gaps')}
          </h5>
          <div className="space-y-1">
            {analysis.gaps.map((gap, idx) => {
              const severityClass =
                gap.severity === 'critical'
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : gap.severity === 'important'
                  ? 'bg-orange-100 dark:bg-orange-900/30'
                  : 'bg-yellow-100 dark:bg-yellow-900/30';
              const textClass =
                gap.severity === 'critical'
                  ? 'text-red-800 dark:text-red-300'
                  : gap.severity === 'important'
                  ? 'text-orange-800 dark:text-orange-300'
                  : 'text-yellow-800 dark:text-yellow-300';
              const secondaryTextClass =
                gap.severity === 'critical'
                  ? 'text-red-700 dark:text-red-400'
                  : gap.severity === 'important'
                  ? 'text-orange-700 dark:text-orange-400'
                  : 'text-yellow-700 dark:text-yellow-400';
              const badgeClass =
                gap.severity === 'critical'
                  ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                  : gap.severity === 'important'
                  ? 'bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200'
                  : 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200';

              return (
                <div key={idx} className={`text-xs rounded p-2 ${severityClass}`}>
                  <span className={`font-medium ${textClass}`}>{gap.item}</span>
                  <span className={secondaryTextClass}> - {gap.explanation}</span>
                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${badgeClass}`}>{gap.severity}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {analysis.recommendations?.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">
            {t('profileMatching.detailedAnalysis.recommendations')}
          </h5>
          <ul className="space-y-1">
            {analysis.recommendations.map((recommendation, idx) => (
              <li key={idx} className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    recommendation.type === 'highlight'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      : recommendation.type === 'develop'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                  }`}
                >
                  {recommendation.type}
                </span>
                <span>{recommendation.suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.interviewQuestions?.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-2">
            {t('profileMatching.detailedAnalysis.interviewQuestions')}
          </h5>
          <ul className="list-disc list-inside space-y-1">
            {analysis.interviewQuestions.map((question, idx) => (
              <li key={idx} className="text-xs text-gray-700 dark:text-gray-300">
                {question}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.riskAssessment && (
        <div
          className={`text-xs rounded p-2 ${
            analysis.riskAssessment.level === 'high'
              ? 'bg-red-100 dark:bg-red-900/30'
              : analysis.riskAssessment.level === 'medium'
              ? 'bg-yellow-100 dark:bg-yellow-900/30'
              : 'bg-green-100 dark:bg-green-900/30'
          }`}
        >
          <span className="font-medium">{t('profileMatching.detailedAnalysis.riskLevel')}: </span>
          <span
            className={`font-bold ${
              analysis.riskAssessment.level === 'high'
                ? 'text-red-700 dark:text-red-400'
                : analysis.riskAssessment.level === 'medium'
                ? 'text-yellow-700 dark:text-yellow-400'
                : 'text-green-700 dark:text-green-400'
            }`}
          >
            {analysis.riskAssessment.level}
          </span>
          {analysis.riskAssessment.factors?.length > 0 && (
            <span className="text-gray-600 dark:text-gray-400"> ({analysis.riskAssessment.factors.join(', ')})</span>
          )}
        </div>
      )}
    </div>
  );
}
