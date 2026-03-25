import {
  ArrowDownTrayIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ChartBarIcon,
  DocumentTextIcon,
  EyeIcon,
  FolderIcon,
  ListBulletIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import ConfirmDialog from '../components/page/ConfirmDialog';
import EmptyStateCard from '../components/page/EmptyStateCard';
import PageHeader from '../components/page/PageHeader';
import ViewModeToggle from '../components/page/ViewModeToggle';
import ConsentBadge from '../components/ConsentBadge';
import Pagination from '../components/Pagination';
import {
  DealsGroupedView,
  ManageResumeDealsModal,
  SearchAndActions,
  StatsCards,
} from '../components/ResumesPage';
import { SkeletonResumeList } from '../components/ui/Skeleton';
import type { Resume } from '../types/entities';
import {
  getResumePreviewTags,
  RESUMES_PAGE_SIZE,
  type ExpandedCategories,
  type ResumeStats,
  type ResumeViewMode,
  type TagsByCategory,
} from './ResumesPage.hooks';

const filterContentVariants: Variants = {
  expanded: {
    height: 'auto',
    opacity: 1,
    marginBottom: '2rem',
    transition: {
      height: { duration: 0.3 },
      opacity: { duration: 0.2 },
    },
  },
  collapsed: {
    height: 0,
    opacity: 0,
    marginBottom: 0,
    transition: {
      height: { duration: 0.3 },
      opacity: { duration: 0.2 },
    },
  },
};

const tagColorMap: Record<string, string> = {
  Skills: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  Industries: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  Tools: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'Soft Skills': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
};

const categoryHeaderColors: Record<string, { dot: string; text: string; border: string }> = {
  Skills: { dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-400 dark:border-blue-500' },
  Industries: { dot: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-400 dark:border-purple-500' },
  Tools: { dot: 'bg-green-500', text: 'text-green-700 dark:text-green-300', border: 'border-green-400 dark:border-green-500' },
  'Soft Skills': { dot: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-400 dark:border-yellow-500' },
};

const tagFilterColors: Record<string, { selected: string; unselected: string }> = {
  Skills: {
    selected: 'bg-blue-500 text-white ring-2 ring-blue-300 dark:ring-blue-700',
    unselected: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50',
  },
  Industries: {
    selected: 'bg-purple-500 text-white ring-2 ring-purple-300 dark:ring-purple-700',
    unselected: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50',
  },
  Tools: {
    selected: 'bg-green-500 text-white ring-2 ring-green-300 dark:ring-green-700',
    unselected: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50',
  },
  'Soft Skills': {
    selected: 'bg-yellow-500 text-white ring-2 ring-yellow-300 dark:ring-yellow-700',
    unselected: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/50',
  },
};

function classNames(...classes: Array<string | boolean | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function getStatusBadgeClass(status?: string) {
  switch (status?.toLowerCase()) {
    case 'improved':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'analyzed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'processing':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'pending':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'error':
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'archived':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

export function ResumesHeader() {
  const { t } = useTranslation();

  return <PageHeader title={t('resumes.title')} subtitle={t('resumes.subtitle')} />;
}

export function ResumesViewModeToggle({
  onChange,
  value,
}: {
  onChange: (mode: ResumeViewMode) => void;
  value: ResumeViewMode;
}) {
  const { t } = useTranslation();

  return (
    <ViewModeToggle
      label={t('resumes.viewMode', 'Affichage')}
      onChange={onChange}
      options={[
        { icon: FolderIcon, label: t('resumes.viewByDeal', 'Par affaire'), value: 'byDeal' },
        { icon: ListBulletIcon, label: t('resumes.viewList', 'Liste'), value: 'list' },
      ]}
      value={value}
    />
  );
}

export function ResumesListPanel({
  authUserRole,
  expandedCategories,
  filteredResumes,
  formatResumeDate,
  getTagCategory,
  goToBatchUpload,
  goToPage,
  goToUpload,
  handleDownloadResume,
  handleResumeClick,
  handleTagClick,
  isFilterExpanded,
  loading,
  onRefresh,
  onToggleFilter,
  onToggleTagExpansion,
  onDeleteResume,
  searchQuery,
  selectedTags,
  setSearchQuery,
  stats,
  tagsByCategory,
  totalCount,
  totalPages,
  clearFilters,
  currentPage,
}: {
  authUserRole?: string;
  clearFilters: () => void;
  currentPage: number;
  expandedCategories: ExpandedCategories;
  filteredResumes: Resume[];
  formatResumeDate: (dateString?: string) => string;
  getTagCategory: (tag: string) => string;
  goToBatchUpload?: () => void;
  goToPage: (page: number) => void;
  goToUpload: () => void;
  handleDownloadResume: (resume: Resume, event: React.MouseEvent) => Promise<void>;
  handleResumeClick: (resume: Resume) => void;
  handleTagClick: (tag: string) => void;
  isFilterExpanded: boolean;
  loading: boolean;
  onDeleteResume: (resume: Resume, event: React.MouseEvent) => void;
  onRefresh: () => Promise<void>;
  onToggleFilter: () => void;
  onToggleTagExpansion: (category: string) => void;
  searchQuery: string;
  selectedTags: string[];
  setSearchQuery: (value: string) => void;
  stats: ResumeStats;
  tagsByCategory: TagsByCategory;
  totalCount: number;
  totalPages: number;
}) {
  const { t } = useTranslation();

  return (
    <>
      <StatsCards stats={stats} t={t} />
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 mb-6">
        <SearchAndActions
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isFilterExpanded={isFilterExpanded}
          onToggleFilter={onToggleFilter}
          selectedTagsCount={selectedTags.length}
          onRefresh={onRefresh}
          onUpload={goToUpload}
          onBatchUpload={authUserRole === 'admin' ? goToBatchUpload : undefined}
          onReset={clearFilters}
          t={t}
        />

        <AnimatePresence>
          {isFilterExpanded && totalCount > 0 ? (
            <motion.div
              variants={filterContentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="pt-4 space-y-4">
                {selectedTags.length > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('resumes.activeFilters')}:</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map((tag) => {
                        const category = getTagCategory(tag);
                        return (
                          <span key={tag} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${tagColorMap[category]}`}>
                            {tag}
                            <button onClick={() => handleTagClick(tag)} className="hover:opacity-70">
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {Object.entries(tagsByCategory).map(([category, tags]) => {
                  if (tags.length === 0) {
                    return null;
                  }

                  const isExpanded = expandedCategories[category];
                  const displayedTags = isExpanded ? tags : tags.slice(0, 15);
                  const hasMore = tags.length > 15;

                  return (
                    <div key={category}>
                      <h3 className={`flex items-center gap-2 text-sm font-semibold mb-2.5 pl-2 border-l-2 ${categoryHeaderColors[category]?.border || 'border-gray-400'} ${categoryHeaderColors[category]?.text || 'text-gray-700 dark:text-gray-300'}`}>
                        <span className={`w-2 h-2 rounded-full ${categoryHeaderColors[category]?.dot || 'bg-gray-400'}`} />
                        {t(`resumes.filters.${category.toLowerCase().replace(' ', '')}`)}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {displayedTags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => handleTagClick(tag)}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm transition-all ${
                              selectedTags.includes(tag)
                                ? tagFilterColors[category]?.selected || 'bg-blue-500 text-white'
                                : tagFilterColors[category]?.unselected || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                        {hasMore ? (
                          <button
                            onClick={() => onToggleTagExpansion(category)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline py-1 font-medium"
                          >
                            {isExpanded ? t('resumes.showLess') : `+${tags.length - 15} ${t('resumes.more')}`}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={RESUMES_PAGE_SIZE}
        onPageChange={goToPage}
        loading={loading}
        itemName={t('resumes.results')}
      />

      <ResumesResultsGrid
        filteredResumes={filteredResumes}
        formatResumeDate={formatResumeDate}
        handleDownloadResume={handleDownloadResume}
        handleResumeClick={handleResumeClick}
        loading={loading}
        onDeleteResume={onDeleteResume}
        searchQuery={searchQuery}
        selectedTags={selectedTags}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={RESUMES_PAGE_SIZE}
        onPageChange={goToPage}
        loading={loading}
        itemName={t('resumes.results')}
      />
    </>
  );
}

function ResumesResultsGrid({
  filteredResumes,
  formatResumeDate,
  handleDownloadResume,
  handleResumeClick,
  loading,
  onDeleteResume,
  searchQuery,
  selectedTags,
}: {
  filteredResumes: Resume[];
  formatResumeDate: (dateString?: string) => string;
  handleDownloadResume: (resume: Resume, event: React.MouseEvent) => Promise<void>;
  handleResumeClick: (resume: Resume) => void;
  loading: boolean;
  onDeleteResume: (resume: Resume, event: React.MouseEvent) => void;
  searchQuery: string;
  selectedTags: string[];
}) {
  const { t } = useTranslation();

  if (loading) {
    return <SkeletonResumeList count={6} />;
  }

  if (filteredResumes.length === 0) {
    return (
      <EmptyStateCard
        icon={DocumentTextIcon}
        title={t('resumes.noResults')}
        description={searchQuery || selectedTags.length > 0 ? t('resumes.noResultsFiltered') : t('resumes.uploadFirst')}
        containerClassName="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-12 text-center"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredResumes.map((resume, index) => (
        <motion.div
          key={resume.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
          onClick={() => handleResumeClick(resume)}
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <DocumentTextIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {resume.Name || resume['Resume File']?.[0]?.filename || t('resumes.untitled')}
                  </h3>
                </div>
                {resume.Title ? <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">{resume.Title}</p> : null}
              </div>
              <span className={classNames('ml-2 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0', getStatusBadgeClass(resume.Status))}>
                {t(`resumes.status.${resume.Status?.toLowerCase() || 'new'}`)}
              </span>
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('resumes.score_label')}</span>
              </div>
              <div className="flex items-center gap-2">
                {resume['Improved Global Rating'] && resume['Improved Global Rating'] !== resume['Global Rating'] ? (
                  <>
                    <span className="text-sm text-gray-400 line-through">{resume['Global Rating'] != null ? `${resume['Global Rating']}%` : '0%'}</span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">{resume['Improved Global Rating'] != null ? `${resume['Improved Global Rating']}%` : '0%'}</span>
                  </>
                ) : (
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{resume['Global Rating'] != null ? `${resume['Global Rating']}%` : '0%'}</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                {formatResumeDate(resume['Created At'])}
              </div>
              {resume.consent_status ? (
                <ConsentBadge
                  status={resume.consent_status}
                  candidateName={resume.candidate_name}
                  candidateEmail={resume.candidate_email}
                  consentTokenExpiresAt={resume.consent_token_expires_at}
                  retentionUntil={resume.retention_until}
                  compact={true}
                />
              ) : null}
            </div>

            {resume.FirmName ? (
              <div className="flex items-center gap-1 mb-3">
                <BuildingOfficeIcon className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-400 dark:text-gray-500">{resume.FirmName}</span>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-1">
              {(['Skills', 'Industries', 'Tools', 'Soft Skills'] as const).flatMap((category) =>
                getResumePreviewTags(resume, category).slice(0, 2).map((tag, index) => (
                  <span key={`${category}-${index}`} className={`text-xs px-2 py-0.5 rounded-full ${tagColorMap[category]}`}>
                    {tag}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 p-4 pt-0">
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleResumeClick(resume);
              }}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
            >
              <EyeIcon className="w-5 h-5" />
              {t('resumes.view')}
            </button>
            {resume['Resume File']?.[0] ? (
              <button
                onClick={(event) => void handleDownloadResume(resume, event)}
                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                title={resume['File Name'] || resume['Resume File']?.[0]?.filename || t('resumes.downloadResume')}
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
              </button>
            ) : null}
            <ManageResumeDealsModal resumeId={resume.id} />
            <button
              onClick={(event) => onDeleteResume(resume, event)}
              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
              title={t('resumes.deleteResume')}
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function ResumesDeleteModal({
  deleting,
  isOpen,
  onClose,
  onConfirm,
  resume,
}: {
  deleting: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  resume: Resume | null;
}) {
  const { t } = useTranslation();

  if (!resume) {
    return null;
  }

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => {
        void onConfirm();
      }}
      disabled={deleting}
      title={t('resumes.confirmDeleteTitle')}
      cancelLabel={t('common.cancel')}
      confirmLabel={deleting ? t('common.deleting') : t('common.delete')}
      content={<p>{t('resumes.confirmDeleteMessage', { filename: resume['Resume File']?.[0]?.filename || resume.Name || 'this resume' })}</p>}
    />
  );
}

export function ResumesByDealView({ allTags }: { allTags: TagsByCategory }) {
  return <DealsGroupedView allTags={allTags} />;
}

