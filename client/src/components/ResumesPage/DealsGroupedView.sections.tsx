import { AnimatePresence, motion } from 'framer-motion';
import {
  BriefcaseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { ResumeBasic, DealGroup, GroupedData, TagsByCategory } from './dealsGrouped.types';
import {
  CATEGORY_HEADER_COLORS,
  FILTER_CONTENT_VARIANTS,
  INITIAL_RESUMES_LIMIT,
  TAG_FILTER_COLORS,
} from './dealsGrouped.types';
import DealSection from './DealSection';

interface FilterPanelProps {
  allTags: TagsByCategory;
  expandedCategories: Record<string, boolean>;
  getTagCategory: (tag: string) => string;
  handleTagClick: (tag: string) => void;
  isFilterExpanded: boolean;
  selectedTags: string[];
  setExpandedCategories: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  t: TFunction;
  visibleData: GroupedData;
}

export function FilterPanel({
  allTags,
  expandedCategories,
  getTagCategory,
  handleTagClick,
  isFilterExpanded,
  selectedTags,
  setExpandedCategories,
  t,
  visibleData,
}: FilterPanelProps): JSX.Element | null {
  if (!isFilterExpanded || (visibleData.totalAssigned <= 0 && visibleData.totalUnassigned <= 0 && !Object.values(allTags).some((tags) => tags.length > 0))) {
    return null;
  }

  return (
    <AnimatePresence>
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
                {selectedTags.map((tag) => {
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
                  {displayedTags.map((tag) => (
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
                      onClick={() => setExpandedCategories((prev) => ({ ...prev, [category]: !isExpandedCategory }))}
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
    </AnimatePresence>
  );
}

export function SummaryBar({ t, visibleData }: { t: TFunction; visibleData: GroupedData }): JSX.Element {
  return (
    <div className="flex items-center gap-3 text-sm bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 px-4 py-2.5">
      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
        <BriefcaseIcon className="w-4 h-4 text-purple-500" />
        <span className="font-semibold text-gray-900 dark:text-gray-100">{visibleData.totalDeals}</span>
        <span>{t('resumes.groupedView.deals')}</span>
      </div>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
        <DocumentTextIcon className="w-4 h-4 text-blue-500" />
        <span className="font-semibold text-gray-900 dark:text-gray-100">{visibleData.totalAssigned}</span>
        <span>{t('resumes.groupedView.assigned')}</span>
      </div>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
        <FolderOpenIcon className="w-4 h-4 text-amber-500" />
        <span className="font-semibold text-gray-900 dark:text-gray-100">{visibleData.totalUnassigned}</span>
        <span>{t('resumes.groupedView.unassigned')}</span>
      </div>
    </div>
  );
}

interface DealsSectionsProps {
  autoExpandedDealIds: Set<string>;
  data: GroupedData;
  dragOverDealId: string | null;
  draggedResume: { resumeId: string; sourceDealId: string | null } | null;
  dropping: boolean;
  expandedDeals: Set<string>;
  fetchGroupedData: () => Promise<void>;
  getDownloadTitle: (resume: ResumeBasic) => string;
  getResumeTags: (resume: ResumeBasic) => Record<string, string[]>;
  handleDelete: (resume: ResumeBasic, event: React.MouseEvent) => void;
  handleDownload: (resume: ResumeBasic, event: React.MouseEvent) => Promise<void>;
  handleDragEnd: (event: React.DragEvent) => void;
  handleDragEnterDeal: (event: React.DragEvent, dealId: string) => void;
  handleDragLeaveDeal: (event: React.DragEvent, dealId: string) => void;
  handleDragOverDeal: (event: React.DragEvent) => void;
  handleDragStart: (event: React.DragEvent, resumeId: string, sourceDealId: string | null) => void;
  handleDropOnDeal: (event: React.DragEvent, dealId: string) => Promise<void>;
  handleExportDeal: (deal: DealGroup) => void;
  handleResumeClick: (resumeId: string) => void;
  hasActiveFilters: boolean;
  saveViewState: () => void;
  toggleDeal: (dealId: string) => void;
  visibleData: GroupedData;
}

export function DealsSections(props: DealsSectionsProps): JSX.Element {
  const {
    autoExpandedDealIds,
    data,
    dragOverDealId,
    draggedResume,
    dropping,
    expandedDeals,
    fetchGroupedData,
    getDownloadTitle,
    getResumeTags,
    handleDelete,
    handleDownload,
    handleDragEnd,
    handleDragEnterDeal,
    handleDragLeaveDeal,
    handleDragOverDeal,
    handleDragStart,
    handleDropOnDeal,
    handleExportDeal,
    handleResumeClick,
    hasActiveFilters,
    saveViewState,
    toggleDeal,
    visibleData,
  } = props;

  return (
    <>
      {visibleData.deals.map((deal) => {
        const originalDeal = data.deals.find((candidate) => candidate.id === deal.id) || deal;
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
            onDelete={handleDelete}
            onDealChange={fetchGroupedData}
            onExportDeal={handleExportDeal}
            getResumeTags={getResumeTags}
            getDownloadTitle={getDownloadTitle}
            saveViewState={saveViewState}
          />
        );
      })}
    </>
  );
}

interface UnassignedSectionProps {
  data: GroupedData;
  expandedResumeSections: Set<string>;
  hasActiveFilters: boolean;
  renderResumeCard: (resume: ResumeBasic, sourceDealId: string | null, index: number) => JSX.Element;
  setExpandedResumeSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  setUnassignedExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  t: TFunction;
  unassignedExpanded: boolean;
  visibleData: GroupedData;
}

export function UnassignedSection({
  data,
  expandedResumeSections,
  hasActiveFilters,
  renderResumeCard,
  setExpandedResumeSections,
  setUnassignedExpanded,
  t,
  unassignedExpanded,
  visibleData,
}: UnassignedSectionProps): JSX.Element | null {
  if (visibleData.unassigned.length <= 0) {
    return null;
  }

  const isFullyExpanded = expandedResumeSections.has('unassigned');
  const displayedResumes = isFullyExpanded ? visibleData.unassigned : visibleData.unassigned.slice(0, INITIAL_RESUMES_LIMIT);
  const hiddenCount = visibleData.unassigned.length - INITIAL_RESUMES_LIMIT;

  return (
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
            {t('resumes.groupedView.unassignedTitle')}
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
                {displayedResumes.map((resume, index) => renderResumeCard(resume, null, index))}
                {!isFullyExpanded && hiddenCount > 0 && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedResumeSections((prev) => new Set([...prev, 'unassigned']));
                    }}
                    className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors font-medium"
                  >
                    {t('resumes.groupedView.showMore', { count: hiddenCount })}
                  </button>
                )}
                {isFullyExpanded && visibleData.unassigned.length > INITIAL_RESUMES_LIMIT && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedResumeSections((prev) => {
                        const next = new Set(prev);
                        next.delete('unassigned');
                        return next;
                      });
                    }}
                    className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors"
                  >
                    {t('resumes.groupedView.showLess')}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface DeleteConfirmModalProps {
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  resume: ResumeBasic;
  t: TFunction;
}

export function DeleteConfirmModal({ deleting, onClose, onConfirm, resume, t }: DeleteConfirmModalProps): JSX.Element {
  return (
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
            {t('resumes.confirmDeleteMessage', { filename: resume.name || t('resumes.untitled') })}
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={deleting}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {deleting ? t('common.deleting') : t('common.delete')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function EmptyDealsState({ hasActiveFilters, t, visibleData }: { hasActiveFilters: boolean; t: TFunction; visibleData: GroupedData }): JSX.Element | null {
  if (visibleData.deals.length === 0 && !hasActiveFilters) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-8 text-center">
        <BriefcaseIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600 dark:text-gray-400">{t('resumes.groupedView.noDeals')}</p>
      </div>
    );
  }

  if (visibleData.deals.length === 0 && visibleData.unassigned.length === 0 && hasActiveFilters) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-12 text-center">
        <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t('resumes.noResults')}
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          {t('resumes.noResultsFiltered')}
        </p>
      </div>
    );
  }

  return null;
}
