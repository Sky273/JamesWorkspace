import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownTrayIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
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
  draggableEnabled?: boolean;
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
  draggableEnabled = true,
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

  const rating = resume.improved_global_rating ?? resume.global_rating;
  const scoreValue = rating == null || Number.isNaN(Number(rating))
    ? null
    : Math.max(0, Math.min(Number(rating), 100));
  const normalizedStatus = (resume.status || 'new').toLowerCase();
  const statusMeta = RESUME_STATUS_META[normalizedStatus] || RESUME_STATUS_META.new;
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      draggable={draggableEnabled && !dropping}
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, resume.id, sourceDealId)}
      onDragEnd={(e) => onDragEnd(e as unknown as React.DragEvent)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(resume.id); } }}
      className={`cv-resume-row overflow-hidden rounded-[0.95rem] transition-all duration-200 ${
        draggableEnabled ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${isDragging ? 'opacity-50 ring-2 ring-[var(--cv-primary)]' : ''}`}
      data-row-index={index}
      onClick={() => onClick(resume.id)}
    >
      <div className="grid gap-4 px-[18px] py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="cv-library-candidate-name cv-display min-w-0 flex-1 text-[15px] font-semibold text-[var(--cv-text)]">
                <span className="block truncate">{resume.name || t('resumes.untitled')}</span>
              </h4>
              <span className={`cv-status-pill rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${statusMeta.badge}`}>
                {t(`resumes.status.${resume.status || 'new'}`)}
              </span>
            </div>

            {resume.title ? (
              <p className="mt-px truncate text-[12.5px] text-[var(--cv-muted)]">{resume.title}</p>
            ) : null}

            <div className="mt-1.5 flex flex-wrap items-center gap-[9px] text-[11px] text-[var(--cv-subtle)]">
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="h-[11px] w-[11px]" />
                {formatDate(resume.created_at, 'medium')}
              </span>
              {resume.firm_name ? (
                <span className="inline-flex items-center gap-1">
                  <BuildingOfficeIcon className="h-[11px] w-[11px]" />
                  <span className="max-w-[180px] truncate">{resume.firm_name}</span>
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

            <div className="mt-3">
              <TagsWithTooltip
                skills={skills}
                industries={industries}
                resumeTags={resumeTags}
                hasAnyTags={hasAnyTags}
                tagColorMap={TAG_COLOR_MAP}
                t={t}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          <div className="cv-resume-score flex items-center gap-2 px-2 py-0">
            <span
              className="cv-resume-score-ring"
              style={{
                background: `conic-gradient(var(--cv-score-fill-solid) ${scoreValue ?? 0}%, var(--cv-score-track-bg) 0)`,
              }}
              aria-hidden="true"
            >
              <span className="cv-resume-score-core" />
            </span>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.03em] text-[var(--cv-subtle)]">
                {t('resumes.score', { defaultValue: 'Score' })}
              </div>
              <div className="cv-display text-[13px] font-bold text-[var(--cv-text)]">
                {scoreValue != null ? `${scoreValue}%` : '-'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowPreview((prev) => !prev)}
              aria-pressed={showPreview}
              className={`inline-flex h-[30px] items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors ${
                showPreview
                  ? 'cv-preview-button-active text-[var(--cv-secondary)]'
                  : 'cv-ghost-button'
              }`}
              title={showPreview ? t('resumes.preview.close', { defaultValue: 'Fermer l aperçu' }) : t('resumes.preview.open', { defaultValue: 'Apercu rapide' })}
            >
              {showPreview ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              <span className="hidden sm:inline">{showPreview ? t('common.close') : t('resumes.preview.title')}</span>
            </button>
            <button
              type="button"
              onClick={(e) => onDownload(resume, e)}
              className="cv-ghost-button inline-flex h-[30px] items-center gap-1.5 rounded-lg px-3 text-xs font-medium"
              title={getDownloadTitle(resume)}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t('common.download', { defaultValue: 'Telecharger' })}</span>
            </button>
            <ManageResumeDealsModal resumeId={resume.id} onSuccess={onDealChange} />
            <button
              type="button"
              onClick={(e) => onDelete(resume, e)}
              className="cv-danger-action inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-[color:color-mix(in_srgb,var(--cv-danger)_22%,transparent)] px-3 text-xs font-medium text-[var(--cv-danger)] transition-colors hover:brightness-105"
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
