import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckCircleIcon, ShareIcon, SparklesIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import ConsentBadge, { ConsentStatus } from '../ConsentBadge';
import type { Resume } from '../../types/entities';

interface ResumeAnalysisHeaderProps {
  resume: Resume;
  resumeName: string;
  resumeId: string;
  hasImprovedText: boolean;
  onShare: () => void;
  onImprove: () => void;
  onDelete: () => void;
  deleting: boolean;
  t: TFunction;
}

export default function ResumeAnalysisHeader({
  resume,
  resumeName,
  resumeId,
  hasImprovedText,
  onShare,
  onImprove,
  onDelete,
  deleting,
  t
}: ResumeAnalysisHeaderProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="glass-panel-strong overflow-hidden rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="cv-display max-w-full truncate text-2xl font-bold text-slate-950 dark:text-[var(--cv-text)] sm:text-3xl">
                {resumeName}
              </h1>
              {resume?.consent_status && (
                <ConsentBadge
                  status={resume.consent_status as ConsentStatus}
                  candidateName={resume?.candidate_name as string | undefined}
                  candidateEmail={resume?.candidate_email as string | undefined}
                  consentTokenExpiresAt={resume?.consent_token_expires_at as string | null | undefined}
                  retentionUntil={resume?.retention_until as string | null | undefined}
                  compact={true}
                />
              )}
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-[var(--cv-muted)] sm:text-base">
              {t('resume.analysis.title')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={onDelete}
              disabled={deleting}
              className={`inline-flex min-h-12 items-center gap-2 rounded-2xl border border-red-200/70 bg-red-50/90 px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200 dark:hover:border-red-400/30 dark:hover:bg-red-500/15 sm:text-base ${deleting ? 'cursor-not-allowed opacity-60' : ''}`}
              title={t('resumes.deleteResume')}
              type="button"
            >
              <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{t('resumes.deleteResume')}</span>
            </button>

            <button
              onClick={onShare}
              className="cv-ghost-button inline-flex min-h-12 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold sm:text-base"
              title={t('share.button')}
              type="button"
            >
              <ShareIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">{t('share.button')}</span>
            </button>

            {hasImprovedText ? (
              <Link
                to={`/resumes/${resumeId}/improve`}
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15 sm:text-base"
              >
                <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden xs:inline">{t('resume.actions.viewImproved')}</span>
                <span className="xs:hidden">{t('resume.actions.view')}</span>
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            ) : (
              <button
                onClick={onImprove}
                className="cv-gradient-button inline-flex min-h-12 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold sm:text-base"
                type="button"
              >
                <SparklesIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                {t('resume.actions.improve')}
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            )}

            <Link
              to={`/resumes/${resumeId}/export`}
              className="cv-ghost-button inline-flex min-h-12 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold sm:text-base"
            >
              {t('resume.actions.export')}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
