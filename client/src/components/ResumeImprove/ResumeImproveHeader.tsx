import { motion } from 'framer-motion';
import { ShareIcon, RocketLaunchIcon, CheckIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import ConsentBadge, { ConsentStatus } from '../ConsentBadge';
import type { Resume } from '../../types/entities';

interface ResumeImproveHeaderProps {
  resume: Resume;
  resumeName: string;
  hasImprovedText: boolean;
  isSaving: boolean;
  editorReady: boolean;
  onSave: () => void;
  onShare: () => void;
  onAdapt: () => void;
  t: TFunction;
}

export default function ResumeImproveHeader({
  resume,
  resumeName,
  hasImprovedText,
  isSaving,
  editorReady,
  onSave,
  onShare,
  onAdapt,
  t
}: ResumeImproveHeaderProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
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
            {t('resume.improve.title')}
          </p>
        </div>
        {hasImprovedText && (
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={onAdapt}
              className="app-primary-action inline-flex items-center gap-2 px-4 py-2 text-sm sm:text-base"
            >
              <RocketLaunchIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">{t('resume.actions.adaptToMission')}</span>
              <span className="sm:hidden">{t('resume.actions.adapt')}</span>
            </button>

            <button
              onClick={onSave}
              disabled={isSaving || !editorReady}
              className={`btn btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm sm:text-base ${isSaving || !editorReady ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="hidden sm:inline">{t('resume.actions.saving')}</span>
                </>
              ) : (
                <>
                  <CheckIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">{t('resume.actions.saveChanges')}</span>
                  <span className="sm:hidden">{t('common.save')}</span>
                </>
              )}
            </button>

            <button
              onClick={onShare}
              className="btn btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm sm:text-base"
              title={t('share.button')}
            >
              <ShareIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">{t('share.button')}</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
