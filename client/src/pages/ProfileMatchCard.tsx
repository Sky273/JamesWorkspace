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
  CheckCircleIcon,
  EyeIcon,
  SparklesIcon,
  AcademicCapIcon,
  XCircleIcon,
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

  return (
    <motion.div
      key={profile.resumeId}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="cv-panel overflow-hidden rounded-[1.75rem] p-0"
    >
      <div
        className="cursor-pointer p-5"
        onClick={() => onToggleExpand(isExpanded ? null : profile.resumeId)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-1 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 dark:bg-white/[0.06] dark:text-[var(--cv-muted)]">
              #{index + 1}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-950 dark:text-[var(--cv-text)]">{profile.name}</h3>
              <p className="text-sm text-slate-500 dark:text-[var(--cv-muted)]">
                {profile.title || t('profileMatching.noTitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={`text-2xl font-bold ${getScoreColor(profile.matchScore)}`}>
                {profile.matchScore}%
              </div>
              <div className="text-xs text-slate-500 dark:text-[var(--cv-muted)]">
                {t('profileMatching.matchScore')}
              </div>
            </div>

            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-[var(--cv-text)]">
              {isExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.08]">
          <div
            className={`h-full ${getScoreBgColor(profile.matchScore)} transition-all duration-500`}
            style={{ width: `${profile.matchScore}%` }}
          />
        </div>

        {profile.categoryScores && (
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1">
              <AcademicCapIcon className="h-3 w-3 text-blue-500" />
              <span className="text-slate-600 dark:text-[var(--cv-muted)]">{t('profileMatching.categories.skills')}:</span>
              <span className={getScoreColor(profile.categoryScores.skills)}>{profile.categoryScores.skills}%</span>
            </span>
            <span className="flex items-center gap-1">
              <WrenchScrewdriverIcon className="h-3 w-3 text-green-500" />
              <span className="text-slate-600 dark:text-[var(--cv-muted)]">{t('profileMatching.categories.tools')}:</span>
              <span className={getScoreColor(profile.categoryScores.tools)}>{profile.categoryScores.tools}%</span>
            </span>
            <span className="flex items-center gap-1">
              <BuildingOfficeIcon className="h-3 w-3 text-purple-500" />
              <span className="text-slate-600 dark:text-[var(--cv-muted)]">{t('profileMatching.categories.industries')}:</span>
              <span className={getScoreColor(profile.categoryScores.industries)}>{profile.categoryScores.industries}%</span>
            </span>
            <span className="flex items-center gap-1">
              <HeartIcon className="h-3 w-3 text-yellow-500" />
              <span className="text-slate-600 dark:text-[var(--cv-muted)]">{t('profileMatching.categories.softSkills')}:</span>
              <span className={getScoreColor(profile.categoryScores.softSkills)}>{profile.categoryScores.softSkills}%</span>
            </span>
          </div>
        )}

        {profile.llmScored && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${
                  profile.confidence === 'high'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                    : profile.confidence === 'medium'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                <SparklesIcon className="h-3 w-3" />
                {t('profileMatching.llmScored')}
                {profile.confidence && ` (${t(`profileMatching.confidence.${profile.confidence}`)})`}
              </span>
            </div>
            {profile.reason ? (
              <p className="text-xs italic text-slate-600 dark:text-[var(--cv-muted)]">
                {profile.reason}
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap gap-2">
              {keyStrengths.map((strength, idx) => (
                <span key={`strength-${idx}`} className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  {strength}
                </span>
              ))}
              {keyGaps.map((gap, idx) => (
                <span key={`gap-${idx}`} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <XCircleIcon className="h-3.5 w-3.5" />
                  {gap}
                </span>
              ))}
            </div>
          </div>
        )}

        {!profile.llmScored && profile.titleAdjustment !== undefined && profile.titleAdjustment !== 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2 py-0.5 ${
                profile.titleAdjustment > 0
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
              }`}
            >
              {t('profileMatching.titleAdjustment')}: {profile.titleAdjustment > 0 ? '+' : ''}{profile.titleAdjustment}
            </span>
            {profile.titleReason ? (
              <span className="max-w-xs truncate italic text-slate-500 dark:text-[var(--cv-muted)]" title={profile.titleReason}>
                {profile.titleReason}
              </span>
            ) : null}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-200 dark:border-white/10"
          >
            <div className="space-y-4 p-5">
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
                    className={`app-primary-action flex items-center gap-2 px-4 py-2 text-sm ${analyzingProfile === profile.resumeId ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {analyzingProfile === profile.resumeId ? (
                      <>
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        {t('profileMatching.analyzing')}
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="h-4 w-4" />
                        {t('profileMatching.analyzeProfile')}
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => onViewResume(profile.resumeId)}
                  className="btn btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <EyeIcon className="h-4 w-4" />
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
