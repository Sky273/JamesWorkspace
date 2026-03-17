/**
 * ProfileMatchCard - Individual profile matching result card
 * Extracted from ProfileMatchingPage.tsx
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  EyeIcon,
  SparklesIcon,
  AcademicCapIcon,
  WrenchScrewdriverIcon,
  HeartIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import type { 
  ProfileMatchResult,
  DetailedProfileAnalysisResponse
} from '../types/entities';

interface ProfileMatchCardProps {
  profile: ProfileMatchResult;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (resumeId: string | null) => void;
  detailedAnalysis?: DetailedProfileAnalysisResponse;
  analyzingProfile: string | null;
  onDetailedAnalysis: (resumeId: string) => void;
  onViewResume: (resumeId: string) => void;
}

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

const getScoreBgColor = (score: number): string => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
};

export default function ProfileMatchCard({
  profile,
  index,
  isExpanded,
  onToggleExpand,
  detailedAnalysis,
  analyzingProfile,
  onDetailedAnalysis,
  onViewResume
}: ProfileMatchCardProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      key={profile.resumeId}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <div 
        className="p-4 cursor-pointer"
        onClick={() => onToggleExpand(isExpanded ? null : profile.resumeId)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm">
                #{index + 1}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{profile.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{profile.title || t('profileMatching.noTitle')}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={`text-2xl font-bold ${getScoreColor(profile.matchScore)}`}>
                {profile.matchScore}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('profileMatching.matchScore')}
              </div>
            </div>
            
            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full ${getScoreBgColor(profile.matchScore)} transition-all duration-500`}
            style={{ width: `${profile.matchScore}%` }}
          />
        </div>

        {/* Category scores summary - only shown if available (legacy text-based mode) */}
        {profile.categoryScores && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1">
              <AcademicCapIcon className="w-3 h-3 text-blue-500" />
              <span className="text-gray-600 dark:text-gray-400">{t('profileMatching.categories.skills')}:</span>
              <span className={getScoreColor(profile.categoryScores.skills)}>{profile.categoryScores.skills}%</span>
            </span>
            <span className="flex items-center gap-1">
              <WrenchScrewdriverIcon className="w-3 h-3 text-green-500" />
              <span className="text-gray-600 dark:text-gray-400">{t('profileMatching.categories.tools')}:</span>
              <span className={getScoreColor(profile.categoryScores.tools)}>{profile.categoryScores.tools}%</span>
            </span>
            <span className="flex items-center gap-1">
              <BuildingOfficeIcon className="w-3 h-3 text-purple-500" />
              <span className="text-gray-600 dark:text-gray-400">{t('profileMatching.categories.industries')}:</span>
              <span className={getScoreColor(profile.categoryScores.industries)}>{profile.categoryScores.industries}%</span>
            </span>
            <span className="flex items-center gap-1">
              <HeartIcon className="w-3 h-3 text-yellow-500" />
              <span className="text-gray-600 dark:text-gray-400">{t('profileMatching.categories.softSkills')}:</span>
              <span className={getScoreColor(profile.categoryScores.softSkills)}>{profile.categoryScores.softSkills}%</span>
            </span>
          </div>
        )}

        {/* LLM Scoring indicator and reason */}
        {profile.llmScored && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${
                profile.confidence === 'high' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                  : profile.confidence === 'medium'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                <SparklesIcon className="w-3 h-3" />
                {t('profileMatching.llmScored')}
                {profile.confidence && ` (${t(`profileMatching.confidence.${profile.confidence}`)})`}
              </span>
            </div>
            {profile.reason && (
              <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                {profile.reason}
              </p>
            )}
            {/* Key strengths and gaps */}
            <div className="flex flex-wrap gap-2 mt-1">
              {profile.keyStrengths?.map((strength, idx) => (
                <span key={`strength-${idx}`} className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  ✓ {strength}
                </span>
              ))}
              {profile.keyGaps?.map((gap, idx) => (
                <span key={`gap-${idx}`} className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  ✗ {gap}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Legacy: Title adjustment indicator (fallback mode) */}
        {!profile.llmScored && profile.titleAdjustment !== undefined && profile.titleAdjustment !== 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded-full ${
              profile.titleAdjustment > 0 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
            }`}>
              {t('profileMatching.titleAdjustment')}: {profile.titleAdjustment > 0 ? '+' : ''}{profile.titleAdjustment}
            </span>
            {profile.titleReason && (
              <span className="text-gray-500 dark:text-gray-400 italic truncate max-w-xs" title={profile.titleReason}>
                {profile.titleReason}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-200 dark:border-gray-700"
          >
            <div className="p-4 space-y-4">
              {/* Matched tags by category - only shown in legacy text-based mode */}
              {profile.matchedTags && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-green-500" />
                    {t('profileMatching.matchedTags')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Skills */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <AcademicCapIcon className="w-3 h-3" />
                        {t('profileMatching.categories.skills')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.matchedTags.skills.length > 0 ? profile.matchedTags.skills.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                    {/* Tools */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                        <WrenchScrewdriverIcon className="w-3 h-3" />
                        {t('profileMatching.categories.tools')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.matchedTags.tools.length > 0 ? profile.matchedTags.tools.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                    {/* Industries */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <BuildingOfficeIcon className="w-3 h-3" />
                        {t('profileMatching.categories.industries')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.matchedTags.industries.length > 0 ? profile.matchedTags.industries.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                    {/* Soft Skills */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                        <HeartIcon className="w-3 h-3" />
                        {t('profileMatching.categories.softSkills')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.matchedTags.softSkills.length > 0 ? profile.matchedTags.softSkills.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Missing tags by category - only shown in legacy text-based mode */}
              {profile.missingTags && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <XCircleIcon className="w-4 h-4 text-red-500" />
                    {t('profileMatching.missingTags')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Skills */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <AcademicCapIcon className="w-3 h-3" />
                        {t('profileMatching.categories.skills')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.missingTags.skills.length > 0 ? profile.missingTags.skills.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                    {/* Tools */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                        <WrenchScrewdriverIcon className="w-3 h-3" />
                        {t('profileMatching.categories.tools')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.missingTags.tools.length > 0 ? profile.missingTags.tools.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                    {/* Industries */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <BuildingOfficeIcon className="w-3 h-3" />
                        {t('profileMatching.categories.industries')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.missingTags.industries.length > 0 ? profile.missingTags.industries.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                    {/* Soft Skills */}
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                        <HeartIcon className="w-3 h-3" />
                        {t('profileMatching.categories.softSkills')}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {profile.missingTags.softSkills.length > 0 ? profile.missingTags.softSkills.map((tag, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">{tag}</span>
                        )) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Analysis Results */}
              {detailedAnalysis && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <SparklesIcon className="w-4 h-4 text-purple-500" />
                      {t('profileMatching.detailedAnalysis.title')}
                    </h4>
                    <span className={`text-lg font-bold ${getScoreColor(detailedAnalysis.analysis.overallScore)}`}>
                      {detailedAnalysis.analysis.overallScore}%
                    </span>
                  </div>
                  
                  {/* Verdict */}
                  <div className="text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t('profileMatching.detailedAnalysis.verdict')}: </span>
                    <span className="text-gray-900 dark:text-gray-100">{detailedAnalysis.analysis.verdict}</span>
                  </div>
                  
                  {/* Summary */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                    {detailedAnalysis.analysis.summary}
                  </p>
                  
                  {/* Strengths */}
                  {detailedAnalysis.analysis.strengths?.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">
                        {t('profileMatching.detailedAnalysis.strengths')}
                      </h5>
                      <div className="space-y-1">
                        {detailedAnalysis.analysis.strengths.map((s, idx) => (
                          <div key={idx} className="text-xs bg-green-100 dark:bg-green-900/30 rounded p-2">
                            <span className="font-medium text-green-800 dark:text-green-300">{s.item}</span>
                            <span className="text-green-700 dark:text-green-400"> - {s.explanation}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Gaps */}
                  {detailedAnalysis.analysis.gaps?.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">
                        {t('profileMatching.detailedAnalysis.gaps')}
                      </h5>
                      <div className="space-y-1">
                        {detailedAnalysis.analysis.gaps.map((g, idx) => (
                          <div key={idx} className={`text-xs rounded p-2 ${
                            g.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' :
                            g.severity === 'important' ? 'bg-orange-100 dark:bg-orange-900/30' :
                            'bg-yellow-100 dark:bg-yellow-900/30'
                          }`}>
                            <span className={`font-medium ${
                              g.severity === 'critical' ? 'text-red-800 dark:text-red-300' :
                              g.severity === 'important' ? 'text-orange-800 dark:text-orange-300' :
                              'text-yellow-800 dark:text-yellow-300'
                            }`}>{g.item}</span>
                            <span className={`${
                              g.severity === 'critical' ? 'text-red-700 dark:text-red-400' :
                              g.severity === 'important' ? 'text-orange-700 dark:text-orange-400' :
                              'text-yellow-700 dark:text-yellow-400'
                            }`}> - {g.explanation}</span>
                            <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                              g.severity === 'critical' ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200' :
                              g.severity === 'important' ? 'bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200' :
                              'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200'
                            }`}>{g.severity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Recommendations */}
                  {detailedAnalysis.analysis.recommendations?.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">
                        {t('profileMatching.detailedAnalysis.recommendations')}
                      </h5>
                      <ul className="space-y-1">
                        {detailedAnalysis.analysis.recommendations.map((r, idx) => (
                          <li key={idx} className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              r.type === 'highlight' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                              r.type === 'develop' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                              'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                            }`}>{r.type}</span>
                            <span>{r.suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Interview Questions */}
                  {detailedAnalysis.analysis.interviewQuestions?.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-2">
                        {t('profileMatching.detailedAnalysis.interviewQuestions')}
                      </h5>
                      <ul className="list-disc list-inside space-y-1">
                        {detailedAnalysis.analysis.interviewQuestions.map((q, idx) => (
                          <li key={idx} className="text-xs text-gray-700 dark:text-gray-300">{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Risk Assessment */}
                  {detailedAnalysis.analysis.riskAssessment && (
                    <div className={`text-xs rounded p-2 ${
                      detailedAnalysis.analysis.riskAssessment.level === 'high' ? 'bg-red-100 dark:bg-red-900/30' :
                      detailedAnalysis.analysis.riskAssessment.level === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                      'bg-green-100 dark:bg-green-900/30'
                    }`}>
                      <span className="font-medium">{t('profileMatching.detailedAnalysis.riskLevel')}: </span>
                      <span className={`font-bold ${
                        detailedAnalysis.analysis.riskAssessment.level === 'high' ? 'text-red-700 dark:text-red-400' :
                        detailedAnalysis.analysis.riskAssessment.level === 'medium' ? 'text-yellow-700 dark:text-yellow-400' :
                        'text-green-700 dark:text-green-400'
                      }`}>{detailedAnalysis.analysis.riskAssessment.level}</span>
                      {detailedAnalysis.analysis.riskAssessment.factors?.length > 0 && (
                        <span className="text-gray-600 dark:text-gray-400"> ({detailedAnalysis.analysis.riskAssessment.factors.join(', ')})</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {/* Only show analyze button if analysis not yet done */}
                {!detailedAnalysis && (
                  <button
                    onClick={() => onDetailedAnalysis(profile.resumeId)}
                    disabled={analyzingProfile === profile.resumeId}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    {analyzingProfile === profile.resumeId ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        {t('profileMatching.analyzing')}
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="w-4 h-4" />
                        {t('profileMatching.analyzeProfile')}
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => onViewResume(profile.resumeId)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <EyeIcon className="w-4 h-4" />
                  {t('profileMatching.viewResume')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
