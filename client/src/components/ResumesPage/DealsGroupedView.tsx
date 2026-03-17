/**
 * DealsGroupedView - Display resumes grouped by deal
 * Collapsible accordion sections for each deal + unassigned resumes
 *
 * Structure:
 * - ./useDealsGroupedData.ts : Data fetching, filtering, tag helpers
 * - ./DealSection.tsx        : Per-deal expandable section with missions/resumes
 * - ./DealResumeCard.tsx     : Individual resume card within a deal
 * - ./dealsGrouped.types.ts  : Shared types and constants
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
  FolderOpenIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { useResume } from '../../context/ResumeContext';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import logger from '../../utils/logger.frontend';
import { SkeletonResumeList } from '../ui/Skeleton';
import SearchAndActions from './SearchAndActions';
import DealExportModal from './DealExportModal';
import DealResumeCard from './DealResumeCard';
import DealSection from './DealSection';
import { useDealDragDrop } from './useDealDragDrop';
import { useDealsGroupedData } from './useDealsGroupedData';
import {
  type ResumeBasic,
  type DealGroup,
  type DealsGroupedViewProps,
  TAG_FILTER_COLORS,
  CATEGORY_HEADER_COLORS,
  FILTER_CONTENT_VARIANTS,
  INITIAL_RESUMES_LIMIT
} from './dealsGrouped.types';

const DealsGroupedView = ({ allTags }: DealsGroupedViewProps): JSX.Element => {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const { deleteResume, deleting } = useResume();
  const { authGet } = useAuthFetch();
  const navigate = useNavigate();

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [resumeToDelete, setResumeToDelete] = useState<ResumeBasic | null>(null);
  const [exportingDeal, setExportingDeal] = useState<{ id: string; title: string; resumeCount: number; adaptationCount: number } | null>(null);
  const [expandedResumeSections, setExpandedResumeSections] = useState<Set<string>>(new Set());

  // Data fetching, filtering, tag helpers
  const {
    data,
    loading,
    expandedDeals,
    unassignedExpanded,
    setUnassignedExpanded,
    searchQuery,
    setSearchQuery,
    selectedTags,
    fetchGroupedData,
    clearFilters,
    toggleDeal,
    saveViewState,
    getResumeTags,
    getTagCategory,
    handleTagClick,
    hasActiveFilters,
    visibleData,
    autoExpandedDealIds,
  } = useDealsGroupedData({ allTags });

  // Drag & Drop (extracted hook)
  const {
    draggedResume,
    dragOverDealId,
    dropping,
    handleDragStart,
    handleDragEnd,
    handleDragEnterDeal,
    handleDragLeaveDeal,
    handleDragOverDeal,
    handleDropOnDeal
  } = useDealDragDrop({ data, fetchGroupedData });

  const handleResumeClick = (resumeId: string) => {
    saveViewState();
    navigate(`/resumes/${resumeId}/analysis`, { state: { from: 'dealsGroupedView' } });
  };

  const openDeleteConfirm = (resume: ResumeBasic, e: React.MouseEvent): void => {
    e.stopPropagation();
    setResumeToDelete(resume);
    setShowDeleteConfirm(true);
  };

  const closeDeleteConfirm = (): void => {
    setShowDeleteConfirm(false);
    setResumeToDelete(null);
  };

  const confirmDeleteResume = async (): Promise<void> => {
    if (!resumeToDelete) return;
    try {
      await deleteResume(resumeToDelete.id);
      await fetchGroupedData();
    } catch (error) {
      logger.error('Failed to delete resume from grouped view:', error);
    }
    closeDeleteConfirm();
  };

  const handleDownload = async (resume: ResumeBasic, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await authGet(`/api/resumes/${resume.id}/download`);
      if (!response.ok) return;
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resume.file_name || resume.name || 'resume';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Error downloading resume:', error);
    }
  };

  const getDownloadTitle = (resume: ResumeBasic): string => {
    const lines = [t('resumes.downloadResume')];
    if (resume.relative_path) {
      lines.push(resume.relative_path);
    } else if (resume.original_name) {
      lines.push(resume.original_name);
    }
    return lines.join('\n');
  };

  const handleExportDeal = (deal: DealGroup) => {
    const adaptationCount = (deal.missions || []).reduce(
      (sum, m) => sum + (m.adaptations?.length || 0), 0
    );
    setExportingDeal({
      id: deal.id,
      title: deal.title,
      resumeCount: deal.resumes.length,
      adaptationCount
    });
  };

  const renderResumeCard = (resume: ResumeBasic, sourceDealId: string | null) => (
    <DealResumeCard
      key={resume.id}
      resume={resume}
      sourceDealId={sourceDealId}
      isDragging={draggedResume?.resumeId === resume.id}
      dropping={dropping}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleResumeClick}
      onDownload={handleDownload}
      onDelete={openDeleteConfirm}
      onDealChange={fetchGroupedData}
      getResumeTags={getResumeTags}
      getDownloadTitle={getDownloadTitle}
    />
  );

  if (loading) {
    return <SkeletonResumeList count={6} />;
  }

  if (!data || !visibleData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-12 text-center">
        <BriefcaseIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">{t('resumes.groupedView.errorLoading', 'Erreur lors du chargement')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60">
        <SearchAndActions
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isFilterExpanded={isFilterExpanded}
          onToggleFilter={() => setIsFilterExpanded(!isFilterExpanded)}
          selectedTagsCount={selectedTags.length}
          onRefresh={fetchGroupedData}
          onUpload={() => navigate('/upload?new')}
          onBatchUpload={authUser?.role?.toLowerCase() === 'admin' ? () => navigate('/batch-upload') : undefined}
          onReset={clearFilters}
          t={t}
        />

        <AnimatePresence>
          {isFilterExpanded && (visibleData.totalAssigned > 0 || visibleData.totalUnassigned > 0 || Object.values(allTags).some(tags => tags.length > 0)) && (
            <motion.div
              variants={FILTER_CONTENT_VARIANTS}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="pt-4 space-y-4">
                {selectedTags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('resumes.activeFilters')}:</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map(tag => {
                        const category = getTagCategory(tag);
                        const colorClass = TAG_FILTER_COLORS[category]?.selected || 'bg-blue-500 text-white';
                        return (
                          <span key={tag} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${colorClass}`}>
                            {tag}
                            <button onClick={() => handleTagClick(tag)} className="hover:opacity-70">
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {Object.entries(allTags).map(([category, tags]) => {
                  const isExpandedCategory = expandedCategories[category];
                  const displayedTags = isExpandedCategory ? tags : tags.slice(0, 15);
                  const canExpand = tags.length > 15;

                  return tags.length > 0 ? (
                    <div key={category}>
                      <h3 className={`flex items-center gap-2 text-sm font-semibold mb-2.5 pl-2 border-l-2 ${CATEGORY_HEADER_COLORS[category]?.border || 'border-gray-400'} ${CATEGORY_HEADER_COLORS[category]?.text || 'text-gray-700 dark:text-gray-300'}`}>
                        <span className={`w-2 h-2 rounded-full ${CATEGORY_HEADER_COLORS[category]?.dot || 'bg-gray-400'}`} />
                        {t(`resumes.filters.${category.toLowerCase().replace(' ', '')}`)}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {displayedTags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => handleTagClick(tag)}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm transition-all ${
                              selectedTags.includes(tag)
                                ? TAG_FILTER_COLORS[category]?.selected || 'bg-blue-500 text-white'
                                : TAG_FILTER_COLORS[category]?.unselected || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                        {canExpand && (
                          <button
                            onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !isExpandedCategory }))}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline py-1 font-medium"
                          >
                            {isExpandedCategory ? t('resumes.showLess') : `+${tags.length - 15} ${t('resumes.more')}`}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 text-sm bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <BriefcaseIcon className="w-4 h-4 text-purple-500" />
          <span className="font-semibold text-gray-900 dark:text-gray-100">{visibleData.totalDeals}</span>
          <span>{t('resumes.groupedView.deals', 'affaires')}</span>
        </div>
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <DocumentTextIcon className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-gray-900 dark:text-gray-100">{visibleData.totalAssigned}</span>
          <span>{t('resumes.groupedView.assigned', 'CVs affectés')}</span>
        </div>
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <FolderOpenIcon className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-gray-900 dark:text-gray-100">{visibleData.totalUnassigned}</span>
          <span>{t('resumes.groupedView.unassigned', 'non affectés')}</span>
        </div>
      </div>

      {/* Deal sections */}
      {visibleData.deals.map(deal => {
        const originalDeal = data.deals.find(candidate => candidate.id === deal.id) || deal;
        const isExpanded = hasActiveFilters ? autoExpandedDealIds.has(deal.id) : expandedDeals.has(deal.id);

        return (
          <DealSection
            key={deal.id}
            deal={deal}
            originalDeal={originalDeal}
            isExpanded={isExpanded}
            hasActiveFilters={hasActiveFilters}
            isDragOver={dragOverDealId === deal.id}
            isSourceDeal={draggedResume?.sourceDealId === deal.id}
            isDragging={!!draggedResume}
            draggedResumeId={draggedResume?.resumeId || null}
            dropping={dropping}
            onToggle={() => toggleDeal(deal.id)}
            onDragEnter={handleDragEnterDeal}
            onDragLeave={handleDragLeaveDeal}
            onDragOver={handleDragOverDeal}
            onDrop={handleDropOnDeal}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onResumeClick={handleResumeClick}
            onDownload={handleDownload}
            onDelete={openDeleteConfirm}
            onDealChange={fetchGroupedData}
            onExportDeal={handleExportDeal}
            getResumeTags={getResumeTags}
            getDownloadTitle={getDownloadTitle}
            saveViewState={saveViewState}
          />
        );
      })}

      {/* Empty deals message */}
      {visibleData.deals.length === 0 && !hasActiveFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-8 text-center">
          <BriefcaseIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-400">{t('resumes.groupedView.noDeals', 'Aucune affaire créée')}</p>
        </div>
      )}

      {visibleData.deals.length === 0 && visibleData.unassigned.length === 0 && hasActiveFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-12 text-center">
          <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t('resumes.noResults')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {t('resumes.noResultsFiltered')}
          </p>
        </div>
      )}

      {/* Unassigned resumes section */}
      {visibleData.unassigned.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
          <button
            onClick={() => {
              if (!hasActiveFilters) {
                setUnassignedExpanded(!unassignedExpanded);
              }
            }}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              {hasActiveFilters || unassignedExpanded ? (
                <ChevronDownIcon className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRightIcon className="w-5 h-5 text-gray-400" />
              )}
              <FolderOpenIcon className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">
                {t('resumes.groupedView.unassignedTitle', 'CVs non affectés à une affaire')}
              </h3>
            </div>
            <span className="ml-4 flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full text-sm font-medium">
              {hasActiveFilters && visibleData.unassigned.length !== data.unassigned.length
                ? `${visibleData.unassigned.length} / ${data.unassigned.length} CV${data.unassigned.length !== 1 ? 's' : ''}`
                : `${visibleData.unassigned.length} CV${visibleData.unassigned.length !== 1 ? 's' : ''}`}
            </span>
          </button>

          <AnimatePresence>
            {(hasActiveFilters || unassignedExpanded) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="space-y-2 pt-3">
                    {(() => {
                      const isFullyExpanded = expandedResumeSections.has('unassigned');
                      const displayedResumes = isFullyExpanded ? visibleData.unassigned : visibleData.unassigned.slice(0, INITIAL_RESUMES_LIMIT);
                      const hiddenCount = visibleData.unassigned.length - INITIAL_RESUMES_LIMIT;
                      return (
                        <>
                          {displayedResumes.map(resume => renderResumeCard(resume, null))}
                          {!isFullyExpanded && hiddenCount > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedResumeSections(prev => new Set([...prev, 'unassigned']));
                              }}
                              className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors font-medium"
                            >
                              {t('resumes.groupedView.showMore', 'Voir {{count}} CV(s) supplémentaire(s)').replace('{{count}}', String(hiddenCount))}
                            </button>
                          )}
                          {isFullyExpanded && visibleData.unassigned.length > INITIAL_RESUMES_LIMIT && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedResumeSections(prev => {
                                  const next = new Set(prev);
                                  next.delete('unassigned');
                                  return next;
                                });
                              }}
                              className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors"
                            >
                              {t('resumes.groupedView.showLess', 'Voir moins')}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Deal Export Modal */}
      {exportingDeal && (
        <DealExportModal
          dealId={exportingDeal.id}
          dealTitle={exportingDeal.title}
          resumeCount={exportingDeal.resumeCount}
          adaptationCount={exportingDeal.adaptationCount}
          onClose={() => setExportingDeal(null)}
        />
      )}

      {showDeleteConfirm && resumeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('resumes.confirmDelete')}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                {t('resumes.confirmDeleteMessage', { filename: resumeToDelete.name || t('resumes.untitled') })}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeDeleteConfirm}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmDeleteResume}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? t('common.deleting') : t('common.delete')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DealsGroupedView;
