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
      aria-label={`${t('resumes.groupedView.deal', 'Affaire')}: ${deal.title}`}
      className={`rounded-xl shadow-sm border overflow-hidden transition-all duration-200 ${
        isDragOver
          ? 'bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-400 dark:ring-purple-500 ring-offset-1 border-purple-300 dark:border-purple-600'
          : isSourceDeal && isDragging
            ? 'bg-white dark:bg-gray-800 opacity-60 border-gray-100 dark:border-gray-700/60'
            : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/60'
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
        aria-label={`${isExpanded ? t('common.collapse', 'Réduire') : t('common.expand', 'Développer')} ${deal.title}`}
        className={`group w-full flex items-center justify-between px-4 py-3 transition-colors text-left ${
          isDragOver
            ? 'bg-purple-100/50 dark:bg-purple-900/30'
            : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isExpanded ? (
            <ChevronDownIcon className="icon-lg text-gray-400" />
          ) : (
            <ChevronRightIcon className="icon-lg text-gray-400" />
          )}
          <span className="p-1.5 rounded-lg transition-colors group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30">
            <BriefcaseIcon className="icon-lg text-purple-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-purple-700 dark:text-purple-300 truncate">{deal.title}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[deal.status] || STATUS_COLORS.open}`}>
                {t(`crm.deals.statuses.${deal.status}`, STATUS_LABELS[deal.status] || deal.status)}
              </span>
              <span className={`text-xs ${priorityInfo.color}`}>{priorityInfo.icon}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
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
        <div className="ml-4 flex items-center gap-2 flex-shrink-0">
          {deal.missions && deal.missions.length > 0 && (
            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full text-sm font-medium">
              {deal.missions.length} mission{deal.missions.length !== 1 ? 's' : ''}
            </span>
          )}
          <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full text-sm font-medium">
            {hasActiveFilters && deal.resumes.length !== originalDeal.resumes.length
              ? `${deal.resumes.length} / ${originalDeal.resumes.length} CV${originalDeal.resumes.length !== 1 ? 's' : ''}`
              : `${deal.resumes.length} CV${deal.resumes.length !== 1 ? 's' : ''}`}
          </span>
          {/* Export button */}
          <span
            role="button"
            tabIndex={0}
            title={t('dealExport.buttonTitle', 'Exporter cette affaire')}
            onClick={(e) => {
              e.stopPropagation();
              onExportDeal(originalDeal);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.currentTarget.click(); } }}
            className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowDownTrayIcon className="icon-md" />
          </span>
        </div>
      </button>

      {/* Drop indicator when dragging over collapsed deal */}
      {isDragOver && !isExpanded && (
        <div className="px-4 py-3 border-t border-purple-200 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/20">
          <p className="text-center text-sm text-purple-600 dark:text-purple-400 font-medium">
            ↓ {t('resumes.groupedView.dropHere', 'Déposer ici pour ajouter à cette affaire')}
          </p>
        </div>
      )}

      {/* Deal resumes */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            id={`deal-content-${deal.id}`}
            role="region"
            aria-label={t('resumes.groupedView.dealContent', 'Contenu de l\'affaire')}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`px-4 py-5 border-t ${isDragOver ? 'border-purple-200 dark:border-purple-700' : 'border-gray-100 dark:border-gray-700'}`}>
              {isDragOver && (
                <div className="mt-3 mb-2 py-2 border-2 border-dashed border-purple-300 dark:border-purple-600 rounded-lg bg-purple-50/50 dark:bg-purple-900/10">
                  <p className="text-center text-sm text-purple-500 dark:text-purple-400">
                    ↓ {t('resumes.groupedView.dropHere', 'Déposer ici pour ajouter à cette affaire')}
                  </p>
                </div>
              )}
              {/* Missions section */}
              {deal.missions && deal.missions.length > 0 && (
                <div className="pt-4 mb-4">
                  <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <BriefcaseIcon className="icon-sm" />
                    {t('resumes.groupedView.missions', 'Missions')} ({deal.missions.length})
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
                            {mission.adaptations_count || 0} {t('resumes.groupedView.adaptations', 'adaptation(s)')}
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
                                      {adaptation.resume_name || adaptation.candidate_name || t('adaptations.card.noName', 'Sans nom')}
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
                  {t('resumes.groupedView.noResumes', 'Aucun CV associé à cette affaire')}
                </p>
              ) : deal.resumes.length > 0 ? (
                <div className="space-y-3 pt-4">
                  {deal.resumes.length > 0 && deal.missions && deal.missions.length > 0 && (
                    <h4 className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <DocumentTextIcon className="icon-sm" />
                      {t('resumes.groupedView.cvs', 'CVs')} ({deal.resumes.length})
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
                            {t('resumes.groupedView.showMore', 'Voir {{count}} CV(s) supplémentaire(s)').replace('{{count}}', String(hiddenCount))}
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
                            {t('resumes.groupedView.showLess', 'Voir moins')}
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
