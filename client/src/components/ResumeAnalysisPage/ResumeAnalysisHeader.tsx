import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckCircleIcon, ShareIcon, SparklesIcon } from '@heroicons/react/24/outline';
import ConsentBadge, { ConsentStatus } from '../ConsentBadge';
import type { Resume } from '../../types/entities';

interface ResumeAnalysisHeaderProps {
  resume: Resume;
  resumeName: string;
  resumeId: string;
  hasImprovedText: boolean;
  onShare: () => void;
  onImprove: () => void;
  t: any;
}

export default function ResumeAnalysisHeader({
  resume,
  resumeName,
  resumeId,
  hasImprovedText,
  onShare,
  onImprove,
  t
}: ResumeAnalysisHeaderProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate max-w-[250px] sm:max-w-none">
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('resume.analysis.title')}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={onShare}
            className="btn btn-secondary inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base"
            title={t('share.button')}
          >
            <ShareIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">{t('share.button')}</span>
          </button>

          {hasImprovedText ? (
            <Link
              to={`/resumes/${resumeId}/improve`}
              className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 border border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg font-medium transition-colors text-sm sm:text-base"
            >
              <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden xs:inline">{t('resume.actions.viewImproved')}</span>
              <span className="xs:hidden">{t('resume.actions.view')}</span>
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          ) : (
            <button
              onClick={onImprove}
              className="btn btn-primary inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base"
            >
              <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              {t('resume.actions.improve')}
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          )}

          <Link
            to={`/resumes/${resumeId}/export`}
            className="btn btn-secondary inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base"
          >
            {t('resume.actions.export')}
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
