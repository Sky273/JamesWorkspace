import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  FolderPlusIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import DealResumeCard from './DealResumeCard';
import type { ResumeBasic, DealGroup } from './dealsGrouped.types';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  PRIORITY_ICONS,
  INITIAL_RESUMES_LIMIT,
  MISSION_STATUS_COLORS,
  ADAPTATION_STATUS_COLORS,
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
  const adaptationCount = (deal.missions || []).reduce((sum, mission) => sum + (mission.adaptations?.length || 0), 0);
  const clientTypeLabel = deal.client_type
    ? deal.client_type === 'prospect'
      ? t('clients.prospect', 'Prospect')
      : t('clients.client', 'Client')
    : null;

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
      <div
        className={`group flex w-full flex-col items-start gap-4 px-4 py-4 text-left transition-colors sm:px-5 xl:flex-row xl:items-center xl:justify-between ${
          isDragOver
            ? 'bg-[var(--cv-primary-soft)]'
            : 'hover:bg-slate-50 dark:hover:bg-[color:color-mix(in_srgb,var(--cv-panel-end)_86%,black)]'
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={`deal-content-${deal.id}`}
          aria-label={`${isExpanded ? t('common.collapse') : t('common.expand')} ${deal.title}`}
          className="flex w-full min-w-0 items-start gap-3 text-left xl:flex-1"
        >
          {isExpanded ? (
            <ChevronDownIcon className="mt-2 h-5 w-5 flex-shrink-0 text-slate-400 dark:text-[#7f8ab0]" />
          ) : (
            <ChevronRightIcon className="mt-2 h-5 w-5 flex-shrink-0 text-slate-400 dark:text-[#7f8ab0]" />
          )}

          <span className="mt-0.5 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[1.25rem] bg-[var(--cv-primary-soft)] text-[var(--cv-primary)] transition-colors group-hover:bg-[color:color-mix(in_srgb,var(--cv-primary-soft)_84%,white)]">
            <BriefcaseIcon className="h-6 w-6" />
          </span>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="cv-display min-w-0 flex-1 text-lg font-bold text-slate-900 dark:text-[#dee5ff] xl:flex-none">
                <span className="block truncate">{deal.title}</span>
              </h3>
              <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${STATUS_COLORS[deal.status] || STATUS_COLORS.open}`}>
                {t(`crm.deals.statuses.${deal.status}`, STATUS_LABELS[deal.status] || deal.status)}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:text-[#a3aac4] ${priorityInfo.color}`}>
                <span aria-hidden="true">{priorityInfo.icon}</span>
                {priorityInfo.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 dark:text-[#8f99b8]">
              {deal.client_name ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1.5 dark:bg-white/[0.04]">
                  <BuildingOfficeIcon className="h-3.5 w-3.5" />
                  <span className="max-w-[220px] truncate">{deal.client_name}</span>
                  {clientTypeLabel ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:bg-white/8 dark:text-[#a3aac4]">
                      {clientTypeLabel}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {deal.contact_name ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1.5 dark:bg-white/[0.04]">
                  <UserIcon className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[200px]">{deal.contact_name}</span>
                </span>
              ) : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-3 xl:max-w-[560px]">
              <div className="rounded-[1rem] border border-slate-200/70 bg-white/70 px-3 py-2.5 dark:border-white/6 dark:bg-white/[0.03]">
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[#8f99b8]">{t('resumes.groupedView.cvs')}</div>
                <div className="mt-1 text-base font-semibold text-slate-950 dark:text-[#dee5ff]">
                  {hasActiveFilters && deal.resumes.length !== originalDeal.resumes.length
                    ? `${deal.resumes.length} / ${originalDeal.resumes.length}`
                    : deal.resumes.length}
                </div>
              </div>
              <div className="rounded-[1rem] border border-slate-200/70 bg-white/70 px-3 py-2.5 dark:border-white/6 dark:bg-white/[0.03]">
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[#8f99b8]">{t('resumes.groupedView.missions')}</div>
                <div className="mt-1 text-base font-semibold text-slate-950 dark:text-[#dee5ff]">{deal.missions?.length || 0}</div>
              </div>
              <div className="rounded-[1rem] border border-slate-200/70 bg-white/70 px-3 py-2.5 dark:border-white/6 dark:bg-white/[0.03]">
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[#8f99b8]">{t('resumes.groupedView.adaptations')}</div>
                <div className="mt-1 text-base font-semibold text-slate-950 dark:text-[#dee5ff]">{adaptationCount}</div>
              </div>
            </div>
          </div>
        </button>

        <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              saveViewState();
              navigate(`/deals/${deal.id}`);
            }}
            className="cv-ghost-button inline-flex min-h-11 items-center gap-2 rounded-[1rem] px-4 py-2 text-sm font-medium"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            {t('common.open', { defaultValue: 'Ouvrir' })}
          </button>
          <button
            type="button"
            title={t('dealExport.buttonTitle')}
            onClick={(e) => {
              e.stopPropagation();
              onExportDeal(originalDeal);
            }}
            className="cv-inline-action inline-flex min-h-11 items-center gap-2 rounded-[1rem] px-4 py-2 text-sm font-medium text-slate-700 transition-colors dark:text-[#dee5ff]"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {t('dealExport.title')}
          </button>
        </div>
      </div>

      {isDragOver && !isExpanded ? (
        <div className="border-t border-[color:color-mix(in_srgb,var(--cv-primary)_20%,transparent)] bg-[var(--cv-primary-soft)] px-4 py-3">
          <p className="text-center text-sm font-medium text-[var(--cv-primary)]">↓ {t('resumes.groupedView.dropHere')}</p>
        </div>
      ) : null}

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
            <div className={`border-t px-4 py-5 sm:px-5 ${isDragOver ? 'border-[color:color-mix(in_srgb,var(--cv-primary)_20%,transparent)]' : 'border-slate-200/70 dark:border-white/6'}`}>
              {isDragOver ? (
                <div className="mb-4 rounded-[1.2rem] border-2 border-dashed border-[color:color-mix(in_srgb,var(--cv-primary)_35%,transparent)] bg-[var(--cv-primary-soft)] px-4 py-4">
                  <p className="text-center text-sm font-medium text-[var(--cv-primary)]">↓ {t('resumes.groupedView.dropHere')}</p>
                </div>
              ) : null}

              {deal.missions && deal.missions.length > 0 ? (
                <section>
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h4 className="cv-subsection-title mb-1 flex items-center gap-1.5">
                        <BriefcaseIcon className="h-4 w-4" />
                        {t('resumes.groupedView.missions')} ({deal.missions.length})
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-[#8f99b8]">
                        {t('resumes.groupedView.missionsHint', { defaultValue: 'Les missions et adaptations associées à cette affaire restent accessibles en un coup d’œil.' })}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {deal.missions.map((mission) => (
                      <div key={mission.id} className="overflow-hidden rounded-[1.5rem] border border-slate-200/70 bg-white/70 dark:border-white/6 dark:bg-white/[0.03]">
                        <button
                          type="button"
                          onClick={() => navigate(`/missions/${mission.id}`)}
                          className="flex w-full flex-col items-start justify-between gap-3 bg-[var(--cv-primary-soft)]/40 px-4 py-4 text-left transition-colors hover:bg-[var(--cv-primary-soft)]/70 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/70 text-[var(--cv-primary)] dark:bg-white/[0.05]">
                                <BriefcaseIcon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-900 dark:text-[#dee5ff]">{mission.title}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${MISSION_STATUS_COLORS[mission.status] || MISSION_STATUS_COLORS.active}`}>
                                    {t(`missions.status.${mission.status || 'active'}`, mission.status)}
                                  </span>
                                  <span className="text-xs text-slate-500 dark:text-[#8f99b8]">
                                    {mission.adaptations_count || 0} {t('resumes.groupedView.adaptations')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </button>

                        {mission.adaptations && mission.adaptations.length > 0 ? (
                          <div className="space-y-2 border-t border-slate-200/70 px-4 py-4 dark:border-white/6">
                            {mission.adaptations.map((adaptation) => {
                              const matchScore = adaptation.match_score || 0;
                              const scoreTone = matchScore >= 80
                                ? 'text-[var(--cv-tertiary)] bg-[var(--cv-tertiary-soft)]'
                                : matchScore >= 60
                                  ? 'text-[var(--cv-warning)] bg-[var(--cv-warning-soft)]'
                                  : 'text-[var(--cv-danger)] bg-[var(--cv-danger-soft)]';

                              return (
                                <button
                                  key={adaptation.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    saveViewState();
                                    navigate(`/adaptations/${adaptation.id}`, { state: { from: 'dealsGroupedView' } });
                                  }}
                                  className="flex w-full flex-col items-start justify-between gap-3 rounded-[1rem] border border-slate-200/70 bg-slate-50/90 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:border-white/6 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] sm:flex-row sm:items-center"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <DocumentTextIcon className="h-4 w-4 flex-shrink-0 text-[var(--cv-secondary)]" />
                                      <span className="truncate text-sm font-medium text-slate-900 dark:text-[#dee5ff]">
                                        {adaptation.resume_name || adaptation.candidate_name || t('adaptations.card.noName')}
                                      </span>
                                    </div>
                                    {adaptation.adapted_title ? (
                                      <p className="mt-1 truncate pl-6 text-xs italic text-slate-500 dark:text-[#8f99b8]">{adaptation.adapted_title}</p>
                                    ) : null}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                    {adaptation.match_score != null ? (
                                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${scoreTone}`}>
                                        <ChartBarIcon className="h-3.5 w-3.5" />
                                        {adaptation.match_score}%
                                      </span>
                                    ) : null}
                                    <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${ADAPTATION_STATUS_COLORS[adaptation.status] || ADAPTATION_STATUS_COLORS.default}`}>
                                      {t(`adaptations.status.${adaptation.status || 'completed'}`, adaptation.status)}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {deal.resumes.length === 0 && !isDragOver && (!deal.missions || deal.missions.length === 0) ? (
                <div className="rounded-[1.4rem] border border-dashed border-slate-300 px-4 py-10 text-center dark:border-white/10">
                  <FolderPlusIcon className="mx-auto mb-3 h-10 w-10 text-slate-400 dark:text-[#7f8ab0]" />
                  <p className="text-sm text-slate-500 dark:text-[#a3aac4]">{t('resumes.groupedView.noResumes')}</p>
                </div>
              ) : deal.resumes.length > 0 ? (
                <section className={`${deal.missions && deal.missions.length > 0 ? 'mt-6' : ''}`}>
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h4 className="cv-subsection-title cv-subsection-title-secondary mb-1 flex items-center gap-1.5">
                        <DocumentTextIcon className="h-4 w-4" />
                        {t('resumes.groupedView.cvs')} ({deal.resumes.length})
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-[#8f99b8]">
                        {t('resumes.groupedView.resumeHint', { defaultValue: 'Les profils rattachés à cette affaire restent manipulables, téléchargeables et prévisualisables sans quitter la vue.' })}
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const isFullyExpanded = expandedResumeSections.has(deal.id);
                    const displayedResumes = isFullyExpanded ? deal.resumes : deal.resumes.slice(0, INITIAL_RESUMES_LIMIT);
                    const hiddenCount = deal.resumes.length - INITIAL_RESUMES_LIMIT;
                    return (
                      <div className="space-y-3">
                        {displayedResumes.map((resume, index) => renderResumeCard(resume, index))}
                        {!isFullyExpanded && hiddenCount > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedResumeSections((prev) => new Set([...prev, deal.id]));
                            }}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-[1.1rem] border border-slate-200 bg-white/70 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/8 dark:bg-white/[0.03] dark:text-[#dee5ff] dark:hover:bg-white/[0.05]"
                          >
                            {t('resumes.groupedView.showMore', { count: hiddenCount })}
                          </button>
                        ) : null}
                        {isFullyExpanded && deal.resumes.length > INITIAL_RESUMES_LIMIT ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedResumeSections((prev) => {
                                const next = new Set(prev);
                                next.delete(deal.id);
                                return next;
                              });
                            }}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-[1.1rem] border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-white/10 dark:text-[#a3aac4] dark:hover:bg-white/[0.05] dark:hover:text-[#dee5ff]"
                          >
                            {t('resumes.groupedView.showLess')}
                          </button>
                        ) : null}
                      </div>
                    );
                  })()}
                </section>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DealSection;
