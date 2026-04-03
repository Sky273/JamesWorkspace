/**
 * DealResumeCard - Resume card for deals grouped view with drag & drop
 * Extracted from DealsGroupedView.tsx
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowDownTrayIcon,
  BuildingOfficeIcon,
  TrashIcon,
  ClockIcon,
  SparklesIcon,
  DocumentPlusIcon,
  ExclamationCircleIcon,
  PauseCircleIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { formatDate } from '../../utils/dateFormatter';
import ConsentBadge, { ConsentStatus } from '../ConsentBadge';
import ManageResumeDealsModal from './AddToDealMenu';
import TagsWithTooltip from './TagsWithTooltip';
import { TAG_COLOR_MAP, type ResumeBasic } from './dealsGrouped.types';
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
  index
}: DealResumeCardProps) {
  const { t } = useTranslation();
  const [showPreview, setShowPreview] = useState(false);

  const rating = resume.improved_global_rating || resume.global_rating;
  const normalizedStatus = (resume.status || 'new').toLowerCase();
  
  // Status badge colors for all possible statuses
  const statusClass =
    normalizedStatus === 'improved' ? 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)]' :
    normalizedStatus === 'analyzed' ? 'bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]' :
    normalizedStatus === 'processing' ? 'bg-[var(--cv-secondary-soft)] text-[var(--cv-secondary)]' :
    normalizedStatus === 'pending' ? 'bg-[var(--cv-warning-soft)] text-[var(--cv-warning)]' :
    normalizedStatus === 'error' || normalizedStatus === 'failed' ? 'bg-[var(--cv-danger-soft)] text-[var(--cv-danger)]' :
    'cv-pill text-[#dee5ff]';

  // Status icon for first column - covers all possible statuses
  const getStatusIcon = () => {
    switch (normalizedStatus) {
      case 'improved':
        return { Icon: CheckCircleSolidIcon, color: 'text-green-500' };
      case 'analyzed':
        return { Icon: SparklesIcon, color: 'text-blue-500' };
      case 'processing':
        return { Icon: ClockIcon, color: 'text-yellow-500' };
      case 'pending':
        return { Icon: PauseCircleIcon, color: 'text-orange-500' };
      case 'error':
      case 'failed':
        return { Icon: ExclamationCircleIcon, color: 'text-red-500' };
      case 'new':
      default:
        return { Icon: DocumentPlusIcon, color: 'text-gray-400' };
    }
  };
  const { Icon: StatusIcon, color: statusIconColor } = getStatusIcon();

  // Alternating row background (striping)
  const isEvenRow = index % 2 === 1;
  const stripingClass = isEvenRow ? 'bg-white/70 dark:bg-[color:color-mix(in_srgb,var(--cv-panel-end)_86%,black)]' : 'bg-white/90 dark:bg-[color:color-mix(in_srgb,var(--cv-panel-start)_90%,black)]';

  const resumeTags = getResumeTags(resume);
  const skills = (resumeTags.skills || []).slice(0, 2);
  const industries = (resumeTags.industries || []).slice(0, 2);

  // Check if there are any tags to show in tooltip
  const hasAnyTags = (resumeTags.skills?.length || 0) > 0 || 
                     (resumeTags.industries?.length || 0) > 0 || 
                     (resumeTags.tools?.length || 0) > 0 || 
                     (resumeTags.soft_skills?.length || 0) > 0;

  return (
    <motion.div
      key={resume.id}
      role="article"
      aria-label={`${t('resumes.cv', 'CV')}: ${resume.name || t('resumes.untitled')} - ${t(`resumes.status.${resume.status || 'new'}`)}`}
      tabIndex={0}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      draggable={!dropping}
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, resume.id, sourceDealId)}
      onDragEnd={(e) => onDragEnd(e as unknown as React.DragEvent)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(resume.id); } }}
      className={`rounded-[1.5rem] border border-slate-200/70 transition-all cursor-grab active:cursor-grabbing dark:border-white/6 ${
        isDragging
          ? 'border-[var(--cv-primary)] opacity-50 bg-white dark:bg-[color:color-mix(in_srgb,var(--cv-panel-end)_86%,black)]'
          : stripingClass
      }`}
      onClick={() => onClick(resume.id)}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <StatusIcon className={`icon-md ${statusIconColor}`} title={t(`resumes.status.${resume.status || 'new'}`)} />
              <h4 className="cv-display truncate text-base font-semibold text-slate-950 dark:text-[#dee5ff]">
                {resume.name || t('resumes.untitled')}
              </h4>
            </div>
            {resume.title && (
              <p className="mt-0.5 truncate pl-6 text-sm italic text-slate-600 dark:text-[var(--cv-primary)]">{resume.title}</p>
            )}
            {resume.firm_name && (
              <div className="mt-1 flex min-w-0 items-center gap-1 pl-6 text-xs text-slate-500 dark:text-[#8f99b8]">
                <BuildingOfficeIcon className="icon-sm" />
                <span className="truncate">{resume.firm_name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {rating != null && (
              <span className="cv-display text-sm font-bold text-slate-950 dark:text-[#dee5ff]">{rating}%</span>
            )}
            <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusClass}`}>
              {t(`resumes.status.${resume.status || 'new'}`)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-[#a3aac4]">
            <div className="flex items-center gap-1">
              <CalendarIcon className="icon-sm" />
              {formatDate(resume.created_at, 'medium')}
            </div>
            {resume.consent_status && (
              <ConsentBadge
                status={resume.consent_status as ConsentStatus}
                candidateName={resume.candidate_name}
                candidateEmail={resume.candidate_email}
                consentTokenExpiresAt={resume.consent_token_expires_at}
                retentionUntil={resume.retention_until}
                compact={true}
              />
            )}
          </div>
          <div className="flex items-center gap-1 overflow-visible">
            <TagsWithTooltip
              skills={skills}
              industries={industries}
              resumeTags={resumeTags}
              hasAnyTags={hasAnyTags}
              tagColorMap={TAG_COLOR_MAP}
              t={t}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowPreview(prev => !prev); }}
              aria-pressed={showPreview}
              className={`p-1.5 transition-colors rounded-lg cursor-pointer ${
                showPreview
                  ? 'bg-[var(--cv-secondary-soft)] text-[var(--cv-secondary)]'
                  : 'text-slate-400 hover:bg-[var(--cv-primary-soft)] hover:text-[var(--cv-primary)] dark:text-[#7f8ab0]'
              }`}
              title={showPreview ? t('resumes.preview.close', 'Fermer l\'aperçu') : t('resumes.preview.open', 'Aperçu rapide')}
            >
              {showPreview ? <EyeSlashIcon className="icon-lg" /> : <EyeIcon className="icon-lg" />}
            </button>
            <button
              type="button"
              onClick={(e) => onDownload(resume, e)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-[var(--cv-primary-soft)] hover:text-[var(--cv-primary)] dark:text-[#7f8ab0]"
              title={getDownloadTitle(resume)}
            >
              <ArrowDownTrayIcon className="icon-lg" />
            </button>
            <div onClick={(e) => e.stopPropagation()}>
              <ManageResumeDealsModal resumeId={resume.id} onSuccess={onDealChange} />
            </div>
            <button
              type="button"
              onClick={(e) => onDelete(resume, e)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-[var(--cv-danger-soft)] hover:text-[var(--cv-danger)] dark:text-[#7f8ab0]"
              title={t('resumes.deleteResume')}
            >
              <TrashIcon className="icon-lg" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPreview && (
          <ResumePreviewPanel
            resumeId={resume.id}
            onClose={() => setShowPreview(false)}
            onOpenFull={(id) => { setShowPreview(false); onClick(id); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
