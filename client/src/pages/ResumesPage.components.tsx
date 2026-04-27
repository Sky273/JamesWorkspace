import { FolderIcon, ListBulletIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import ConfirmDialog from '../components/page/ConfirmDialog';
import ViewModeToggle from '../components/page/ViewModeToggle';
import Pagination from '../components/Pagination';
import {
  DealsGroupedView,
  SearchAndActions,
  StatsCards,
} from '../components/ResumesPage';
import type { Resume } from '../types/entities';
import {
  RESUMES_PAGE_SIZE,
  type ResumeStats,
  type ResumeViewMode,
  type TagsByCategory,
} from './ResumesPage.hooks';
import { ResumeFiltersPanel, ResumesResultsGrid } from './ResumesPage.parts';

export function ResumesHeader() {
  const { t } = useTranslation();

  return (
    <header className="cv-page-heading mb-[22px]">
      <div className="min-w-0">
        <h1 className="cv-display text-[25px] font-bold leading-tight text-[var(--cv-text)]">
          {t('resumes.title')}
        </h1>
        <p className="mt-0.5 text-[13px] leading-5 text-[var(--cv-muted)]">
          {t('resumes.subtitle')}
        </p>
      </div>
    </header>
  );
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
      className="cv-view-toggle-row"
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
  filteredResumes,
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
  filteredResumes: Resume[];
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
      <div className="mb-6">
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
        {totalCount > 0 ? (
          <ResumeFiltersPanel
            clearFilters={clearFilters}
            getTagCategory={getTagCategory}
            handleTagClick={handleTagClick}
            isFilterExpanded={isFilterExpanded}
            selectedTags={selectedTags}
            tagsByCategory={tagsByCategory}
          />
        ) : null}
      </div>

      <ResumesResultsGrid
        clearFilters={clearFilters}
        filteredResumes={filteredResumes}
        goToUpload={goToUpload}
        handleDownloadResume={handleDownloadResume}
        handleResumeClick={handleResumeClick}
        loading={loading}
        onDeleteResume={onDeleteResume}
        onRefresh={onRefresh}
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

export function ResumesByDealView({
  allTags,
  refreshToken,
  stats,
}: {
  allTags: TagsByCategory;
  refreshToken: number;
  stats: ResumeStats;
}) {
  return <DealsGroupedView allTags={allTags} refreshToken={refreshToken} stats={stats} />;
}
