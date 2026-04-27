import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';

import {
  ResumesDeleteModal,
  ResumesHeader,
  ResumesListPanel,
  ResumesViewModeToggle,
} from './ResumesPage.components';
import { useResumesDashboard } from './ResumesPage.hooks';

const ResumesByDealView = lazy(() =>
  import('./ResumesPage.components').then((module) => ({ default: module.ResumesByDealView }))
);

const ResumesPage = (): JSX.Element => {
  const {
    allTags,
    authUser,
    clearFilters,
    closeDeleteConfirm,
    confirmDeleteResume,
    currentPage,
    deleting,
    fetchResumes,
    filteredResumes,
    getTagCategory,
    goToBatchUpload,
    goToPage,
    goToUpload,
    groupedRefreshToken,
    handleDownloadResume,
    handleResumeClick,
    handleTagClick,
    isFilterExpanded,
    loading,
    openDeleteConfirm,
    resumeToDelete,
    searchQuery,
    selectedTags,
    setIsFilterExpanded,
    setSearchQuery,
    setViewMode,
    showDeleteConfirm,
    stats,
    tagsByCategory,
    totalCount,
    totalPages,
    viewMode,
  } = useResumesDashboard();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="cv-surface mx-auto mb-8 w-full p-4 sm:p-6 lg:p-[30px]"
    >
      <ResumesHeader />
      <ResumesViewModeToggle value={viewMode} onChange={setViewMode} />

      {viewMode === 'byDeal' ? (
        <Suspense fallback={<div className="cv-panel mt-6 rounded-[1rem] p-8 text-sm text-slate-500 dark:text-[#a3aac4]">Chargement de la vue par affaire...</div>}>
          <ResumesByDealView allTags={allTags} refreshToken={groupedRefreshToken} stats={stats} />
        </Suspense>
      ) : (
        <ResumesListPanel
          authUserRole={authUser?.role}
          clearFilters={clearFilters}
          currentPage={currentPage}
          filteredResumes={filteredResumes}
          getTagCategory={getTagCategory}
          goToBatchUpload={goToBatchUpload}
          goToPage={goToPage}
          goToUpload={goToUpload}
          handleDownloadResume={handleDownloadResume}
          handleResumeClick={handleResumeClick}
          handleTagClick={handleTagClick}
          isFilterExpanded={isFilterExpanded}
          loading={loading}
          onDeleteResume={openDeleteConfirm}
          onRefresh={fetchResumes}
          onToggleFilter={() => setIsFilterExpanded(!isFilterExpanded)}
          searchQuery={searchQuery}
          selectedTags={selectedTags}
          setSearchQuery={setSearchQuery}
          stats={stats}
          tagsByCategory={tagsByCategory}
          totalCount={totalCount}
          totalPages={totalPages}
        />
      )}

      <ResumesDeleteModal
        deleting={deleting}
        isOpen={showDeleteConfirm}
        onClose={closeDeleteConfirm}
        onConfirm={confirmDeleteResume}
        resume={resumeToDelete}
      />
    </motion.div>
  );
};

export default ResumesPage;
