/**
 * ProfileMatchCard - Individual profile matching result card
 * Extracted from ProfileMatchingPage.tsx
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ChevronDownIcon,
  ChevronUpIcon,
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
import { asStringArray, getScoreBgColor, getScoreColor } from './profileMatchCard/helpers';
import ProfileMatchDetailedAnalysis from './profileMatchCard/ProfileMatchDetailedAnalysis';
import ProfileMatchTagGroups from './profileMatchCard/ProfileMatchTagGroups';

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
  const keyStrengths = asStringArray(profile.keyStrengths);
  const keyGaps = asStringArray(profile.keyGaps);

  const stripingClass = index % 2 === 1
    ? 'bg-gray-100 dark:bg-gray-700'
    : 'bg-white dark:bg-gray-800';

  return (
    <motion.div
      key={profile.resumeId}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`${stripingClass} rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden`}
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

        <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getScoreBgColor(profile.matchScore)} transition-all duration-500`}
            style={{ width: `${profile.matchScore}%` }}
          />
        </div>

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

        {profile.llmScored && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  profile.confidence === 'high'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                    : profile.confidence === 'medium'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
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
            <div className="flex flex-wrap gap-2 mt-1">
              {keyStrengths.map((strength, idx) => (
                <span key={`strength-${idx}`} className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  ✓ {strength}
                </span>
              ))}
              {keyGaps.map((gap, idx) => (
                <span key={`gap-${idx}`} className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  ✗ {gap}
                </span>
              ))}
            </div>
          </div>
        )}

        {!profile.llmScored && profile.titleAdjustment !== undefined && profile.titleAdjustment !== 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span
              className={`px-2 py-0.5 rounded-full ${
                profile.titleAdjustment > 0
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
              }`}
            >
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

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-200 dark:border-gray-700"
          >
            <div className="p-4 space-y-4">
              {profile.matchedTags && (
                <ProfileMatchTagGroups
                  title={t('profileMatching.matchedTags')}
                  icon="matched"
                  tags={profile.matchedTags}
                  t={t}
                />
              )}

              {profile.missingTags && (
                <ProfileMatchTagGroups
                  title={t('profileMatching.missingTags')}
                  icon="missing"
                  tags={profile.missingTags}
                  t={t}
                />
              )}

              {detailedAnalysis && (
                <ProfileMatchDetailedAnalysis analysis={detailedAnalysis.analysis} t={t} />
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {!detailedAnalysis && (
                  <button
                    onClick={() => onDetailedAnalysis(profile.resumeId)}
                    disabled={analyzingProfile === profile.resumeId}
                    className={`btn btn-primary flex items-center gap-2 px-4 py-2 text-sm ${analyzingProfile === profile.resumeId ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                  className="btn btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
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
