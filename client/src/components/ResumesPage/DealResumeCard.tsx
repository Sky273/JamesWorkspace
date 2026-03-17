/**
 * DealResumeCard - Resume card for deals grouped view with drag & drop
 * Extracted from DealsGroupedView.tsx
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DocumentTextIcon,
  CalendarIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowDownTrayIcon,
  BuildingOfficeIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
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
  getDownloadTitle
}: DealResumeCardProps) {
  const { t } = useTranslation();
  const [showPreview, setShowPreview] = useState(false);

  const rating = resume.improved_global_rating || resume.global_rating;
  const statusClass =
    resume.status === 'improved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
    resume.status === 'analyzed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
    resume.status === 'processing' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';

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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      draggable={!dropping}
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, resume.id, sourceDealId)}
      onDragEnd={(e) => onDragEnd(e as unknown as React.DragEvent)}
      className={`bg-white dark:bg-gray-800 rounded-lg border hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
        isDragging
          ? 'border-purple-400 dark:border-purple-500 opacity-50'
          : 'border-gray-200 dark:border-gray-700'
      }`}
      onClick={() => onClick(resume.id)}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                {resume.name || t('resumes.untitled')}
              </h4>
            </div>
            {resume.title && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate pl-6">{resume.title}</p>
            )}
            {resume.firm_name && (
              <div className="flex items-center gap-1 pl-6 mt-1 text-xs text-gray-500 dark:text-gray-400 min-w-0">
                <BuildingOfficeIcon className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{resume.firm_name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {rating != null && (
              <span className="text-sm font-bold text-gray-900 dark:text-white">{rating}%</span>
            )}
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
              {t(`resumes.status.${resume.status || 'new'}`)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" />
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
              onClick={(e) => { e.stopPropagation(); setShowPreview(prev => !prev); }}
              className={`p-1 transition-colors rounded ${
                showPreview
                  ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20'
                  : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              title={showPreview ? t('resumes.preview.close', 'Fermer l\'aperçu') : t('resumes.preview.open', 'Aperçu rapide')}
            >
              {showPreview ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
            <button
              onClick={(e) => onDownload(resume, e)}
              className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded"
              title={getDownloadTitle(resume)}
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
            </button>
            <div onClick={(e) => e.stopPropagation()}>
              <ManageResumeDealsModal resumeId={resume.id} onSuccess={onDealChange} />
            </div>
            <button
              onClick={(e) => onDelete(resume, e)}
              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded"
              title={t('resumes.deleteResume')}
            >
              <TrashIcon className="w-4 h-4" />
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
