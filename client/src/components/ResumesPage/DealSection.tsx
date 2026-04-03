/**
 * DealSection Component
 * Renders a single deal accordion section with header, missions, and resumes
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BriefcaseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  BuildingOfficeIcon,
  UserIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import DealResumeCard from './DealResumeCard';
import type {
  ResumeBasic,
  DealGroup,
} from './dealsGrouped.types';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  PRIORITY_ICONS,
  INITIAL_RESUMES_LIMIT,
} from './dealsGrouped.types';

interface DealSectionProps {
  deal: DealGroup;
  originalDeal: DealGroup;
  isExpanded: boolean;
  hasActiveFilters: boolean;
  isDragOver: boolean;
  isSourceDeal: boolean;
  isDragging: boolean;
  draggedResumeId: string | null;
  dropping: boolean;
  onToggle: () => void;
  onDragEnter: (e: React.DragEvent, dealId: string) => void;
  onDragLeave: (e: React.DragEvent, dealId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, dealId: string) => void;
  onDragStart: (e: React.DragEvent, resumeId: string, sourceDealId: string | null) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onResumeClick: (resumeId: string) => void;
  onDownload: (resume: ResumeBasic, e: React.MouseEvent) => void;
  onDelete: (resume: ResumeBasic, e: React.MouseEvent) => void;
  onDealChange: () => Promise<void>;
  onExportDeal: (deal: DealGroup) => void;
  getResumeTags: (resume: ResumeBasic) => Record<string, string[]>;
  getDownloadTitle: (resume: ResumeBasic) => string;
  saveViewState: () => void;
}

const DealSection = ({
  deal,
  originalDeal,
  isExpanded,
  hasActiveFilters,
  isDragOver,
  isSourceDeal,
  isDragging,
  draggedResumeId,
  dropping,
  onToggle,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
  onResumeClick,
  onDownload,
  onDelete,
  onDealChange,
  onExportDeal,
  getResumeTags,
  getDownloadTitle,
  saveViewState,
}: DealSectionProps): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expandedResumeSections, setExpandedResumeSections] = useState<Set<string>>(new Set());

  const priorityInfo = PRIORITY_ICONS[deal.priority] || PRIORITY_ICONS.medium;

  const renderResumeCard = (resume: ResumeBasic, index: number) => (
    <DealResumeCard
      key={resume.id}
      resume={resume}
      sourceDealId={deal.id}
      isDragging={draggedResumeId === resume.id}
      dropping={dropping}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onResumeClick}
      onDownload={onDownload}
      onDelete={onDelete}
      onDealChange={onDealChange}
      getResumeTags={getResumeTags}
      getDownloadTitle={getDownloadTitle}
      index={index}
    />
  );

  return (
    <div
      role="region"
      aria-label={`${t('resumes.groupedView.deal')}: ${deal.title}`}
      className={`overflow-hidden rounded-[2rem] border transition-all duration-200 ${
        isDragOver
          ? 'cv-card ring-2 ring-[var(--cv-primary)] ring-offset-1 ring-offset-transparent border-[color:color-mix(in_srgb,var(--cv-primary)_40%,transparent)]'
          : isSourceDeal && isDragging
            ? 'cv-card opacity-60'
            : 'cv-card'
      }`}
      onDragEnter={(e) => onDragEnter(e, deal.id)}
      onDragLeave={(e) => onDragLeave(e, deal.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, deal.id)}
    >
      {/* Deal header */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={`deal-content-${deal.id}`}
        aria-label={`${isExpanded ? t('common.collapse') : t('common.expand')} ${deal.title}`}
        className={`group flex w-full flex-col items-start gap-4 px-5 py-4 text-left transition-colors sm:flex-row sm:items-center sm:justify-between ${
          isDragOver
            ? 'bg-[var(--cv-primary-soft)]'
            : 'hover:bg-slate-50 dark:hover:bg-[color:color-mix(in_srgb,var(--cv-panel-end)_86%,black)]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isExpanded ? (
            <ChevronDownIcon className="icon-lg text-slate-400 dark:text-[#7f8ab0]" />
          ) : (
            <ChevronRightIcon className="icon-lg text-slate-400 dark:text-[#7f8ab0]" />
          )}
          <span className="rounded-2xl bg-[var(--cv-primary-soft)] p-2 transition-colors group-hover:bg-[color:color-mix(in_srgb,var(--cv-primary-soft)_84%,white)]">
            <BriefcaseIcon className="icon-lg text-[var(--cv-primary)]" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="cv-display truncate text-lg font-bold text-slate-900 dark:text-[#dee5ff]">{deal.title}</h3>
              <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${STATUS_COLORS[deal.status] || STATUS_COLORS.open}`}>
                {t(`crm.deals.statuses.${deal.status}`, STATUS_LABELS[deal.status] || deal.status)}
              </span>
              <span className={`text-xs ${priorityInfo.color}`}>{priorityInfo.icon}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 dark:text-[#8f99b8]">
              {deal.client_name && (
                <span className="flex items-center gap-1">
                  <BuildingOfficeIcon className="icon-xs" />
                  {deal.client_name}
                  {deal.client_type && <span className="text-gray-400">({deal.client_type})</span>}
                </span>
              )}
              {deal.contact_name && (
                <span className="flex items-center gap-1">
                  <UserIcon className="icon-xs" />
                  {deal.contact_name}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-4 sm:flex-shrink-0 sm:justify-end">
          {deal.missions && deal.missions.length > 0 && (
            <span className="cv-count-pill cv-count-pill-primary rounded-full px-2.5 py-1 text-sm font-medium">
              {deal.missions.length} mission{deal.missions.length !== 1 ? 's' : ''}
            </span>
          )}
          <span className="cv-count-pill cv-count-pill-success rounded-full px-2.5 py-1 text-sm font-medium">
            {hasActiveFilters && deal.resumes.length !== originalDeal.resumes.length
              ? `${deal.resumes.length} / ${originalDeal.resumes.length} CV${originalDeal.resumes.length !== 1 ? 's' : ''}`
              : `${deal.resumes.length} CV${deal.resumes.length !== 1 ? 's' : ''}`}
          </span>
          {/* Export button */}
          <span
            role="button"
            tabIndex={0}
            title={t('dealExport.buttonTitle')}
            onClick={(e) => {
              e.stopPropagation();
              onExportDeal(originalDeal);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.currentTarget.click(); } }}
            className="cv-inline-action rounded-2xl p-2 text-slate-400 transition-colors cursor-pointer dark:text-[#7f8ab0]"
          >
            <ArrowDownTrayIcon className="icon-md" />
          </span>
        </div>
      </button>

      {/* Drop indicator when dragging over collapsed deal */}
      {isDragOver && !isExpanded && (
        <div className="border-t border-[color:color-mix(in_srgb,var(--cv-primary)_20%,transparent)] bg-[var(--cv-primary-soft)] px-4 py-3">
          <p className="text-center text-sm font-medium text-[var(--cv-primary)]">
            ↓ {t('resumes.groupedView.dropHere')}
          </p>
        </div>
      )}

      {/* Deal resumes */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            id={`deal-content-${deal.id}`}
            role="region"
            aria-label={t('resumes.groupedView.dealContent')}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`border-t px-4 py-5 ${isDragOver ? 'border-[color:color-mix(in_srgb,var(--cv-primary)_20%,transparent)]' : 'border-slate-200/70 dark:border-white/6'}`}>
              {isDragOver && (
                <div className="mb-2 mt-3 rounded-lg border-2 border-dashed border-[color:color-mix(in_srgb,var(--cv-primary)_35%,transparent)] bg-[var(--cv-primary-soft)] py-2">
                  <p className="text-center text-sm text-[var(--cv-primary)]">
                    ↓ {t('resumes.groupedView.dropHere')}
                  </p>
                </div>
              )}
              {/* Missions section */}
              {deal.missions && deal.missions.length > 0 && (
                <div className="pt-4 mb-4">
                  <h4 className="cv-subsection-title mb-3 flex items-center gap-1.5">
                    <BriefcaseIcon className="icon-sm" />
                    {t('resumes.groupedView.missions')} ({deal.missions.length})
                  </h4>
                  <div className="space-y-3">
                    {deal.missions.map((mission, missionIndex) => (
                      <div key={mission.id} className={`border border-indigo-100 dark:border-indigo-800/30 rounded-lg overflow-hidden ${
                        missionIndex % 2 === 1 ? 'bg-indigo-50/50 dark:bg-indigo-900/5' : ''
                      }`}>
                        {/* Mission header */}
                        <div
                          onClick={() => navigate(`/missions/${mission.id}`)}
                          className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-colors ${
                            missionIndex % 2 === 1 ? 'bg-indigo-100/70 dark:bg-indigo-900/15' : 'bg-indigo-50 dark:bg-indigo-900/10'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <BriefcaseIcon className="icon-md text-indigo-500" />
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{mission.title}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                              mission.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              mission.status === 'closed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                              {t(`missions.status.${mission.status || 'active'}`, mission.status)}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                            {mission.adaptations_count || 0} {t('resumes.groupedView.adaptations')}
                          </span>
                        </div>
                        {/* Adaptations under this mission */}
                        {mission.adaptations && mission.adaptations.length > 0 && (
                          <div className="px-4 py-3 bg-white dark:bg-gray-800/50 space-y-2">
                            {mission.adaptations.map((adaptation, adaptationIndex) => {
                              const scoreColor = (adaptation.match_score || 0) >= 80
                                ? 'text-green-600 dark:text-green-400'
                                : (adaptation.match_score || 0) >= 60
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-red-600 dark:text-red-400';
                              const scoreBg = (adaptation.match_score || 0) >= 80
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : (adaptation.match_score || 0) >= 60
                                ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                : 'bg-red-100 dark:bg-red-900/30';
                              const adaptationStriping = adaptationIndex % 2 === 1 
                                ? 'bg-gray-100 dark:bg-gray-700/50' 
                                : 'bg-gray-50 dark:bg-gray-700/30';
                              return (
                                <div
                                  key={adaptation.id}
                                  onClick={(e) => { e.stopPropagation(); saveViewState(); navigate(`/adaptations/${adaptation.id}`, { state: { from: 'dealsGroupedView' } }); }}
                                  className={`flex items-center justify-between px-4 py-3 ${adaptationStriping} border border-gray-100 dark:border-gray-700 rounded-md cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <DocumentTextIcon className="icon-sm text-blue-500" />
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                      {adaptation.resume_name || adaptation.candidate_name || t('adaptations.card.noName')}
                                    </span>
                                    {adaptation.adapted_title && (
                                      <span className="text-xs text-blue-600 dark:text-blue-400 italic truncate max-w-[200px]">
                                        {adaptation.adapted_title}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {adaptation.match_score != null && (
                                      <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold ${scoreBg} ${scoreColor}`}>
                                        <ChartBarIcon className="icon-xs" />
                                        {adaptation.match_score}%
                                      </span>
                                    )}
                                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                      adaptation.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                      adaptation.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                    }`}>
                                      {t(`adaptations.status.${adaptation.status || 'completed'}`, adaptation.status)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumes section */}
              {deal.resumes.length === 0 && !isDragOver && (!deal.missions || deal.missions.length === 0) ? (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-6">
                  {t('resumes.groupedView.noResumes')}
                </p>
              ) : deal.resumes.length > 0 ? (
                <div className="space-y-3 pt-4">
                  {deal.resumes.length > 0 && deal.missions && deal.missions.length > 0 && (
                    <h4 className="cv-subsection-title cv-subsection-title-secondary mb-2 flex items-center gap-1.5">
                      <DocumentTextIcon className="icon-sm" />
                      {t('resumes.groupedView.cvs')} ({deal.resumes.length})
                    </h4>
                  )}
                  {(() => {
                    const isFullyExpanded = expandedResumeSections.has(deal.id);
                    const displayedResumes = isFullyExpanded ? deal.resumes : deal.resumes.slice(0, INITIAL_RESUMES_LIMIT);
                    const hiddenCount = deal.resumes.length - INITIAL_RESUMES_LIMIT;
                    return (
                      <>
                        {displayedResumes.map((resume, index) => renderResumeCard(resume, index))}
                        {!isFullyExpanded && hiddenCount > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedResumeSections(prev => new Set([...prev, deal.id]));
                            }}
                            className="w-full py-3 mt-4 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors font-medium"
                          >
                            {t('resumes.groupedView.showMore', { count: hiddenCount })}
                          </button>
                        )}
                        {isFullyExpanded && deal.resumes.length > INITIAL_RESUMES_LIMIT && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedResumeSections(prev => {
                                const next = new Set(prev);
                                next.delete(deal.id);
                                return next;
                              });
                            }}
                            className="w-full py-3 mt-4 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors"
                          >
                            {t('resumes.groupedView.showLess')}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DealSection;
