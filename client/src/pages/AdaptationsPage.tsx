import { motion } from 'framer-motion';

import {
  AdaptationsByDealView,
  AdaptationsExportDialog,
  AdaptationsHeader,
  AdaptationsListPanel,
  AdaptationsViewModeToggle,
} from './AdaptationsPage.components';
import { useAdaptationsDashboard } from './AdaptationsPage.hooks';

const AdaptationsPage = (): JSX.Element => {
  const {
    adaptationToExport,
    adaptations,
    clearFilters,
    closeExportModal,
    currentPage,
    exportLoading,
    fetchAdaptations,
    filterStatus,
    getMissionTitle,
    getResumeName,
    goToPage,
    handleConfirmExport,
    handleDelete,
    handleExportPDF,
    loading,
    loadingTemplates,
    navigateToAdaptation,
    searchTerm,
    selectedExportFormat,
    selectedTemplate,
    setFilterStatus,
    setSearchTerm,
    setSelectedExportFormat,
    setSelectedTemplate,
    setViewMode,
    showExportModal,
    stats,
    templates,
    totalCount,
    totalPages,
    viewMode,
  } = useAdaptationsDashboard();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="cv-surface app-page-shell"
    >
      <AdaptationsHeader />
      <AdaptationsViewModeToggle value={viewMode} onChange={setViewMode} />

      {viewMode === 'byDeal' ? (
        <AdaptationsByDealView />
      ) : (
        <AdaptationsListPanel
          adaptations={adaptations}
          clearFilters={clearFilters}
          currentPage={currentPage}
          filterStatus={filterStatus}
          getMissionTitle={getMissionTitle}
          getResumeName={getResumeName}
          goToPage={goToPage}
          loading={loading}
          onDelete={handleDelete}
          onExport={handleExportPDF}
          onOpen={navigateToAdaptation}
          onRefresh={fetchAdaptations}
          onSearchChange={setSearchTerm}
          onStatusChange={setFilterStatus}
          searchTerm={searchTerm}
          stats={stats}
          totalCount={totalCount}
          totalPages={totalPages}
        />
      )}

      <AdaptationsExportDialog
        adaptation={adaptationToExport}
        isLoading={exportLoading}
        isOpen={showExportModal}
        loadingTemplates={loadingTemplates}
        onClose={closeExportModal}
        onConfirm={handleConfirmExport}
        selectedFormat={selectedExportFormat}
        selectedTemplate={selectedTemplate}
        setSelectedFormat={setSelectedExportFormat}
        setSelectedTemplate={setSelectedTemplate}
        templates={templates}
      />
    </motion.div>
  );
};

export default AdaptationsPage;
