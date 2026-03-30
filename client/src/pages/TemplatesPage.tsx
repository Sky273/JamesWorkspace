import { motion } from 'framer-motion';

import {
  TemplatesDeleteModal,
  TemplatesExtractDialog,
  TemplatesHeader,
  TemplatesLoadingState,
  TemplatesPreviewModal,
  TemplatesResults,
  TemplatesStats,
  TemplatesToolbar,
} from './TemplatesPage.components';
import { useTemplatesDashboard } from './TemplatesPage.hooks';

const TemplatesPage = (): JSX.Element => {
  const {
    closeDeleteConfirmModal,
    currentPage,
    error,
    fetchTemplates,
    filteredTemplates,
    goToEditTemplate,
    goToNewTemplate,
    goToPage,
    handleConfirmDelete,
    isDeleteModalOpen,
    isDeleting,
    isExtractModalOpen,
    loading,
    mounted,
    openDeleteConfirmModal,
    openExtractModal,
    openPreviewModal,
    previewTemplate,
    resetSearch,
    searchTerm,
    setIsExtractModalOpen,
    setPreviewTemplate,
    setSearchTerm,
    setSortBy,
    sortBy,
    stats,
    templateToDelete,
    totalCount,
    totalPages,
  } = useTemplatesDashboard();

  if (!mounted || loading) {
    return <TemplatesLoadingState />;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="p-6 max-w-7xl mx-auto">
      <TemplatesHeader />
      <TemplatesStats stats={stats} />
      <TemplatesToolbar
        onCreate={goToNewTemplate}
        onExtract={openExtractModal}
        onRefresh={fetchTemplates}
        onResetSearch={resetSearch}
        onSearchChange={setSearchTerm}
        onSortChange={setSortBy}
        searchTerm={searchTerm}
        sortBy={sortBy}
      />
      <TemplatesResults
        currentPage={currentPage}
        error={error}
        loading={loading}
        onDeleteClick={openDeleteConfirmModal}
        onPageChange={goToPage}
        onPreviewClick={openPreviewModal}
        searchTerm={searchTerm}
        templates={filteredTemplates}
        totalCount={totalCount}
        totalPages={totalPages}
      />
      <TemplatesDeleteModal
        isDeleting={isDeleting}
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteConfirmModal}
        onConfirm={handleConfirmDelete}
        template={templateToDelete}
      />
      <TemplatesPreviewModal
        onClose={() => setPreviewTemplate(null)}
        onEdit={(templateId) => {
          goToEditTemplate(templateId);
          setPreviewTemplate(null);
        }}
        template={previewTemplate}
      />
      <TemplatesExtractDialog
        isOpen={isExtractModalOpen}
        onClose={() => setIsExtractModalOpen(false)}
      />
    </motion.div>
  );
};

export default TemplatesPage;
