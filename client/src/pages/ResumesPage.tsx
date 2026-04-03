import { motion } from 'framer-motion';

import {
  ResumesByDealView,
  ResumesDeleteModal,
  ResumesHeader,
  ResumesListPanel,
  ResumesViewModeToggle,
} from './ResumesPage.components';
import { useResumesDashboard } from './ResumesPage.hooks';

const ResumesPage = (): JSX.Element => {
  const {
    allTags,
    authUser,
    clearFilters,
    closeDeleteConfirm,
    confirmDeleteResume,
    currentPage,
    deleting,
    expandedCategories,
    fetchResumes,
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
    openDeleteConfirm,
    resumeToDelete,
    searchQuery,
    selectedTags,
    setExpandedCategories,
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
      className="cv-surface mx-auto mb-8 max-w-7xl rounded-[2.5rem] p-6 sm:p-8"
    >
      <ResumesHeader />
      <ResumesViewModeToggle value={viewMode} onChange={setViewMode} />

      {viewMode === 'byDeal' ? (
        <ResumesByDealView allTags={allTags} stats={stats} />
      ) : (
        <ResumesListPanel
          authUserRole={authUser?.role}
          clearFilters={clearFilters}
          currentPage={currentPage}
          expandedCategories={expandedCategories}
          filteredResumes={filteredResumes}
          formatResumeDate={formatResumeDate}
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
          onToggleTagExpansion={(category) =>
            setExpandedCategories((previousState) => ({
              ...previousState,
              [category]: !previousState[category],
            }))
          }
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
