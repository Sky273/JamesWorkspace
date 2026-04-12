import { motion } from 'framer-motion';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import userService from '../utils/userService';
import { templateService } from '../utils/templateService';

import {
  TemplatesDeleteModal,
  TemplatesDuplicateModal,
  TemplatesExtractDialog,
  TemplatesHeader,
  TemplatesLoadingState,
  TemplatesPreviewModal,
  TemplatesResults,
  TemplatesStats,
  TemplatesToolbar,
} from './TemplatesPage.components';
import { useTemplatesDashboard, type Template } from './TemplatesPage.hooks';

const TemplatesPage = (): JSX.Element => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin';
  const [duplicateTarget, setDuplicateTarget] = useState<Template | null>(null);
  const [duplicateFirmId, setDuplicateFirmId] = useState('');
  const [duplicateFirms, setDuplicateFirms] = useState<{ id: string; name: string }[]>([]);
  const [duplicateSubmitting, setDuplicateSubmitting] = useState(false);
  const {
    closeDeleteConfirmModal,
    currentPage,
    error,
    fetchTemplates,
    refreshTemplates,
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

  const availableDuplicateFirms = useMemo(
    () => duplicateFirms.filter((firm) => firm.id !== duplicateTarget?.FirmId),
    [duplicateFirms, duplicateTarget?.FirmId],
  );

  const closeDuplicateModal = useCallback(() => {
    setDuplicateTarget(null);
    setDuplicateFirmId('');
  }, []);

  const openDuplicateModal = useCallback(async (template: Template) => {
    if (!isSuperAdmin) {
      return;
    }

    try {
      const response = await userService.getCustomersPaginated({ page: 1, pageSize: 100 });
      setDuplicateFirms(response.customers || []);
      setDuplicateTarget(template);
      setDuplicateFirmId('');
    } catch {
      toast.error(t('templates.duplicate.loadFirmsError'));
    }
  }, [isSuperAdmin, t]);

  const handleDuplicateConfirm = useCallback(async () => {
    if (!duplicateTarget || !duplicateFirmId) {
      return;
    }

    setDuplicateSubmitting(true);
    try {
      await templateService.duplicateTemplate(duplicateTarget.id, duplicateFirmId);
      toast.success(t('templates.duplicate.success'));
      closeDuplicateModal();
      await fetchTemplates();
    } catch {
      toast.error(t('templates.duplicate.error'));
    } finally {
      setDuplicateSubmitting(false);
    }
  }, [closeDuplicateModal, duplicateFirmId, duplicateTarget, fetchTemplates, t]);

  if (!mounted || loading) {
    return <TemplatesLoadingState />;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="cv-surface app-page-shell">
      <TemplatesHeader />
      <TemplatesStats stats={stats} />
      <TemplatesToolbar
        onCreate={goToNewTemplate}
        onExtract={openExtractModal}
        onRefresh={refreshTemplates}
        onResetSearch={resetSearch}
        onSearchChange={setSearchTerm}
        onSortChange={setSortBy}
        searchTerm={searchTerm}
        sortBy={sortBy}
      />
      <TemplatesResults
        canDuplicate={isSuperAdmin}
        currentPage={currentPage}
        error={error}
        loading={loading}
        onDuplicateClick={openDuplicateModal}
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
      <TemplatesDuplicateModal
        firms={availableDuplicateFirms}
        isOpen={Boolean(duplicateTarget)}
        isSubmitting={duplicateSubmitting}
        onClose={closeDuplicateModal}
        onConfirm={handleDuplicateConfirm}
        onFirmChange={setDuplicateFirmId}
        selectedFirmId={duplicateFirmId}
        template={duplicateTarget}
      />
      <TemplatesExtractDialog
        isOpen={isExtractModalOpen}
        onClose={() => setIsExtractModalOpen(false)}
      />
    </motion.div>
  );
};

export default TemplatesPage;
