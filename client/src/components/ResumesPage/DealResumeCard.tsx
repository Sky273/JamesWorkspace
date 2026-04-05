import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownTrayIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ClockIcon,
  DocumentPlusIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  PauseCircleIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { formatDate } from '../../utils/dateFormatter';
import ConsentBadge, { ConsentStatus } from '../ConsentBadge';
import ManageResumeDealsModal from './AddToDealMenu';
import TagsWithTooltip from './TagsWithTooltip';
import { TAG_COLOR_MAP, type ResumeBasic, RESUME_STATUS_META } from './dealsGrouped.types';
import ResumePreviewPanel from './ResumePreviewPanel';

interface DealResumeCardProps {
  resume: ResumeBasic;
  sourceDealId: string | null;
  isDragging: boolean;
  dropping: boolean;
  onDragStart: (e: React.DragEvent, resumeId: string, sourceDealId: string | null) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onClick: (resumeId: string) => void;
  onDownload: (resume: ResumeBasic, e: React.MouseEvent) => void;
  onDelete: (resume: ResumeBasic, e: React.MouseEvent) => void;
  onDealChange: () => Promise<void>;
  getResumeTags: (resume: ResumeBasic) => Record<string, string[]>;
  getDownloadTitle: (resume: ResumeBasic) => string;
  index: number;
}

export default function DealResumeCard({
  resume,
  sourceDealId,
  isDragging,
  dropping,
  onDragStart,
  onDragEnd,
  onClick,
  onDownload,
  onDelete,
  onDealChange,
  getResumeTags,
  getDownloadTitle,
  index,
}: DealResumeCardProps) {
  const { t } = useTranslation();
  const [showPreview, setShowPreview] = useState(false);

  const rating = resume.improved_global_rating || resume.global_rating;
  const normalizedStatus = (resume.status || 'new').toLowerCase();
  const statusMeta = RESUME_STATUS_META[normalizedStatus] || RESUME_STATUS_META.new;

  const getStatusIcon = () => {
    switch (normalizedStatus) {
      case 'improved':
        return { Icon: CheckCircleSolidIcon, color: 'text-[var(--cv-tertiary)]' };
      case 'analyzed':
        return { Icon: SparklesIcon, color: 'text-[var(--cv-primary)]' };
      case 'processing':
        return { Icon: ClockIcon, color: 'text-[var(--cv-warning)]' };
      case 'pending':
        return { Icon: PauseCircleIcon, color: 'text-[var(--cv-secondary)]' };
      case 'error':
      case 'failed':
        return { Icon: ExclamationCircleIcon, color: 'text-[var(--cv-danger)]' };
      case 'new':
      default:
        return { Icon: DocumentPlusIcon, color: 'text-slate-400' };
    }
  };

  const { Icon: StatusIcon, color: statusIconColor } = getStatusIcon();
  const stripingClass = index % 2 === 1
    ? 'bg-white/70 dark:bg-[color:color-mix(in_srgb,var(--cv-panel-end)_86%,black)]'
    : 'bg-white/90 dark:bg-[color:color-mix(in_srgb,var(--cv-panel-start)_90%,black)]';

  const resumeTags = getResumeTags(resume);
  const skills = (resumeTags.skills || []).slice(0, 2);
  const industries = (resumeTags.industries || []).slice(0, 2);
  const hasAnyTags = (resumeTags.skills?.length || 0) > 0 ||
    (resumeTags.industries?.length || 0) > 0 ||
    (resumeTags.tools?.length || 0) > 0 ||
    (resumeTags.soft_skills?.length || 0) > 0;

  return (
    <motion.div
      key={resume.id}
      role="article"
      aria-label={`${t('resumes.cv', { defaultValue: 'CV' })}: ${resume.name || t('resumes.untitled')} - ${t(`resumes.status.${resume.status || 'new'}`)}`}
      tabIndex={0}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      draggable={!dropping}
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, resume.id, sourceDealId)}
      onDragEnd={(e) => onDragEnd(e as unknown as React.DragEvent)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(resume.id); } }}
      className={`overflow-hidden rounded-[1.6rem] border border-slate-200/70 transition-all duration-200 cursor-grab active:cursor-grabbing dark:border-white/6 ${
        isDragging
          ? 'border-[var(--cv-primary)] opacity-50 bg-white dark:bg-[color:color-mix(in_srgb,var(--cv-panel-end)_86%,black)]'
          : stripingClass
      }`}
      onClick={() => onClick(resume.id)}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${statusMeta.shell}`}>
                <StatusIcon className={`h-5 w-5 ${statusIconColor}`} title={t(`resumes.status.${resume.status || 'new'}`)} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="cv-display min-w-0 flex-1 text-base font-semibold text-slate-950 dark:text-[#dee5ff]">
                    <span className="block truncate">{resume.name || t('resumes.untitled')}</span>
                  </h4>
                  <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${statusMeta.badge}`}>
                    {t(`resumes.status.${resume.status || 'new'}`)}
                  </span>
                </div>
                {resume.title ? (
                  <p className="mt-1 truncate text-sm italic text-slate-600 dark:text-[#a3aac4]">{resume.title}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs text-slate-500 dark:text-[#8f99b8]">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1.5 dark:bg-white/[0.04]">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {formatDate(resume.created_at, 'medium')}
                  </span>
                  {resume.firm_name ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1.5 dark:bg-white/[0.04]">
                      <BuildingOfficeIcon className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[180px]">{resume.firm_name}</span>
                    </span>
                  ) : null}
                  {resume.consent_status ? (
                    <ConsentBadge
                      status={resume.consent_status as ConsentStatus}
                      candidateName={resume.candidate_name}
                      candidateEmail={resume.candidate_email}
                      consentTokenExpiresAt={resume.consent_token_expires_at}
                      retentionUntil={resume.retention_until}
                      compact={true}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-[220px] lg:items-end">
            <div className="rounded-[1.2rem] border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-white/6 dark:bg-white/[0.03] lg:w-full">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[#8f99b8]">{t('resumes.score', { defaultValue: 'Score' })}</div>
                  <div className="cv-display mt-1 text-2xl font-bold text-slate-950 dark:text-[#dee5ff]">{rating != null ? `${rating}%` : '—'}</div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusMeta.scorePill}`}>
                  {statusMeta.label}
                </span>
              </div>
              <div className="cv-score-track mt-3 h-2.5 rounded-full">
                <div className="cv-score-fill h-2.5 rounded-full transition-all" style={{ width: `${Math.max(6, Math.min(rating ?? 0, 100))}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <TagsWithTooltip
              skills={skills}
              industries={industries}
              resumeTags={resumeTags}
              hasAnyTags={hasAnyTags}
              tagColorMap={TAG_COLOR_MAP}
              t={t}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowPreview((prev) => !prev)}
              aria-pressed={showPreview}
              className={`inline-flex min-h-10 items-center gap-2 rounded-[0.95rem] px-3 py-2 text-sm font-medium transition-colors ${
                showPreview
                  ? 'bg-[var(--cv-secondary-soft)] text-[var(--cv-secondary)]'
                  : 'cv-ghost-button'
              }`}
              title={showPreview ? t('resumes.preview.close', { defaultValue: 'Fermer l\'aperçu' }) : t('resumes.preview.open', { defaultValue: 'Aperçu rapide' })}
            >
              {showPreview ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              <span className="hidden sm:inline">{showPreview ? t('common.close') : t('resumes.preview.title')}</span>
            </button>
            <button
              type="button"
              onClick={(e) => onDownload(resume, e)}
              className="cv-ghost-button inline-flex min-h-10 items-center gap-2 rounded-[0.95rem] px-3 py-2 text-sm font-medium"
              title={getDownloadTitle(resume)}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t('common.download', { defaultValue: 'Télécharger' })}</span>
            </button>
            <ManageResumeDealsModal resumeId={resume.id} onSuccess={onDealChange} />
            <button
              type="button"
              onClick={(e) => onDelete(resume, e)}
              className="inline-flex min-h-10 items-center gap-2 rounded-[0.95rem] border border-[color:color-mix(in_srgb,var(--cv-danger)_20%,transparent)] bg-[var(--cv-danger-soft)] px-3 py-2 text-sm font-medium text-[var(--cv-danger)] transition-colors hover:brightness-105"
              title={t('resumes.deleteResume')}
            >
              <TrashIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t('common.delete')}</span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPreview ? (
          <ResumePreviewPanel
            resumeId={resume.id}
            onClose={() => setShowPreview(false)}
            onOpenFull={(id) => { setShowPreview(false); onClick(id); }}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
