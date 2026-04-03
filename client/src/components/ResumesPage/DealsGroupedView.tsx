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
import { BriefcaseIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { useResume } from '../../context/ResumeContext';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import logger from '../../utils/logger.frontend';
import { SkeletonResumeList } from '../ui/Skeleton';
import SearchAndActions from './SearchAndActions';
import DealExportModal from './DealExportModal';
import DealResumeCard from './DealResumeCard';
import {
  DealsSections,
  DeleteConfirmModal,
  EmptyDealsState,
  FilterPanel,
  SummaryBar,
  UnassignedSection,
} from './DealsGroupedView.sections';
import { useDealDragDrop } from './useDealDragDrop';
import { useDealsGroupedData } from './useDealsGroupedData';
import {
  type ResumeBasic,
  type DealGroup,
  type DealsGroupedViewProps,
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

  const renderResumeCard = (resume: ResumeBasic, sourceDealId: string | null, index: number) => (
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
      index={index}
    />
  );

  if (loading) {
    return <SkeletonResumeList count={6} />;
  }

  if (!data || !visibleData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-12 text-center">
        <BriefcaseIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">{t('resumes.groupedView.errorLoading')}</p>
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
          onBatchUpload={authUser?.role === 'admin' ? () => navigate('/batch-upload') : undefined}
          onReset={clearFilters}
          t={t}
        />
        <FilterPanel
          allTags={allTags}
          expandedCategories={expandedCategories}
          getTagCategory={getTagCategory}
          handleTagClick={handleTagClick}
          isFilterExpanded={isFilterExpanded}
          selectedTags={selectedTags}
          setExpandedCategories={setExpandedCategories}
          t={t}
          visibleData={visibleData}
        />
      </div>

      <SummaryBar t={t} visibleData={visibleData} />

      <DealsSections
        autoExpandedDealIds={autoExpandedDealIds}
        data={data}
        dragOverDealId={dragOverDealId}
        draggedResume={draggedResume}
        dropping={dropping}
        expandedDeals={expandedDeals}
        fetchGroupedData={fetchGroupedData}
        getDownloadTitle={getDownloadTitle}
        getResumeTags={getResumeTags}
        handleDelete={openDeleteConfirm}
        handleDownload={handleDownload}
        handleDragEnd={handleDragEnd}
        handleDragEnterDeal={handleDragEnterDeal}
        handleDragLeaveDeal={handleDragLeaveDeal}
        handleDragOverDeal={handleDragOverDeal}
        handleDragStart={handleDragStart}
        handleDropOnDeal={handleDropOnDeal}
        handleExportDeal={handleExportDeal}
        handleResumeClick={handleResumeClick}
        hasActiveFilters={hasActiveFilters}
        saveViewState={saveViewState}
        toggleDeal={toggleDeal}
        visibleData={visibleData}
      />

      <EmptyDealsState hasActiveFilters={hasActiveFilters} t={t} visibleData={visibleData} />

      <UnassignedSection
        data={data}
        expandedResumeSections={expandedResumeSections}
        hasActiveFilters={hasActiveFilters}
        renderResumeCard={renderResumeCard}
        setExpandedResumeSections={setExpandedResumeSections}
        setUnassignedExpanded={setUnassignedExpanded}
        t={t}
        unassignedExpanded={unassignedExpanded}
        visibleData={visibleData}
      />

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
        <DeleteConfirmModal
          deleting={deleting}
          onClose={closeDeleteConfirm}
          onConfirm={confirmDeleteResume}
          resume={resumeToDelete}
          t={t}
        />
      )}
    </div>
  );
};

export default DealsGroupedView;
