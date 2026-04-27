import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import ConfirmDialog from '../components/page/ConfirmDialog';
import TiptapEditor from '../components/TiptapEditor/DeferredTiptapEditor';
import type { TiptapEditorRef } from '../components/TiptapEditor/TiptapEditor';
import MissionFormModal from './MissionFormModal';
import {
  MissionsByDealView,
  MissionsHeader,
  MissionsListPanel,
  MissionsViewModeToggle,
} from './MissionsPage.components';
import { StatsCards } from '../components/MissionsPage';
import { useMissionsDashboard } from './MissionsPage.hooks';

const MissionsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const editorRef = useRef<TiptapEditorRef | null>(null);
  const {
    clients,
    contacts,
    cancelDelete,
    closeModal,
    confirmDelete,
    currentPage,
    deals,
    deleteDialogDescription,
    editingMission,
    fetchMissions,
    formData,
    goToPage,
    handleEdit,
    handleSubmit,
    loading,
    loadingClients,
    loadingContacts,
    loadingDeals,
    isDeletingMission,
    missionPendingDelete,
    missions,
    openCreateModal,
    canDeleteMission,
    requestDelete,
    resetSearch,
    setEditorReady,
    setFormData,
    setSearchTerm,
    setViewMode,
    searchTerm,
    showModal,
    stats,
    totalCount,
    totalPages,
    viewMode,
    groupedRefreshToken,
  } = useMissionsDashboard();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="cv-surface missions-page-shell mx-auto mb-8 w-full max-w-7xl p-4 sm:p-6 lg:p-[30px]"
    >
      <MissionsHeader />
      <MissionsViewModeToggle value={viewMode} onChange={setViewMode} />
      <StatsCards stats={stats} missionsCount={totalCount} t={t} />

      {viewMode === 'byDeal' ? (
        <MissionsByDealView
          onAddMission={openCreateModal}
          onEditMission={(mission) => handleEdit({
            id: mission.id,
            Title: mission.title,
            Content: mission.content,
            Status: mission.status as 'Active' | 'Closed' | 'Draft',
            Firm: mission.firm,
            'Client ID': mission.client_id,
            'Client Name': mission.client_name,
            'Client Type': mission.client_type,
            'Contact ID': mission.contact_id,
            'Contact Name': mission.contact_name,
            'Contact Email': mission.contact_email,
            'Contact Role': mission.contact_role,
            'Adaptations Count': mission.adaptations_count,
            'Submissions Count': mission.submissions_count,
            'Pipeline Count': mission.pipeline_count,
            'Has Attachments': mission.has_attached_elements,
          })}
          onDeleteMission={(mission) => requestDelete({
            id: mission.id,
            Title: mission.title,
            Content: mission.content,
            Status: mission.status as 'Active' | 'Closed' | 'Draft',
            Firm: mission.firm,
            'Client ID': mission.client_id,
            'Client Name': mission.client_name,
            'Client Type': mission.client_type,
            'Contact ID': mission.contact_id,
            'Contact Name': mission.contact_name,
            'Contact Email': mission.contact_email,
            'Contact Role': mission.contact_role,
            'Adaptations Count': mission.adaptations_count,
            'Submissions Count': mission.submissions_count,
            'Pipeline Count': mission.pipeline_count,
            'Has Attachments': mission.has_attached_elements,
          })}
          refreshToken={groupedRefreshToken}
        />
      ) : (
        <MissionsListPanel
          canDeleteMission={canDeleteMission}
          currentPage={currentPage}
          loading={loading}
          missions={missions}
          onAddMission={openCreateModal}
          onDelete={requestDelete}
          onEdit={handleEdit}
          onPageChange={goToPage}
          onRefresh={fetchMissions}
          onResetSearch={resetSearch}
          onSearchChange={setSearchTerm}
          searchTerm={searchTerm}
          totalCount={totalCount}
          totalPages={totalPages}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(missionPendingDelete)}
        title={t('missions.messages.deleteDialogTitle', 'Supprimer cette mission ?')}
        content={deleteDialogDescription}
        confirmLabel={isDeletingMission ? t('common.deleting', 'Suppression…') : t('common.delete')}
        cancelLabel={t('common.cancel')}
        disabled={isDeletingMission}
        onClose={cancelDelete}
        onConfirm={() => {
          void confirmDelete();
        }}
      />

      {showModal ? (
        <MissionFormModal
          isEditing={Boolean(editingMission)}
          formData={formData}
          setFormData={setFormData}
          clients={clients}
          contacts={contacts}
          deals={deals}
          loadingClients={loadingClients}
          loadingContacts={loadingContacts}
          loadingDeals={loadingDeals}
          onSubmit={handleSubmit}
          onClose={closeModal}
          editorSlot={
            <TiptapEditor
              ref={editorRef}
              content={formData.Content}
              onChange={(html) => setFormData({ ...formData, Content: html })}
              onReady={() => setEditorReady(true)}
              height={400}
            />
          }
        />
      ) : null}
    </motion.div>
  );
};

export default MissionsPage;
