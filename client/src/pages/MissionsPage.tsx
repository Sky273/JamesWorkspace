import { useRef } from 'react';
import { motion } from 'framer-motion';

import { DeferredTiptapEditor as TiptapEditor } from '../components/TiptapEditor';
import type { TiptapEditorRef } from '../components/TiptapEditor';
import MissionFormModal from './MissionFormModal';
import {
  MissionsByDealView,
  MissionsHeader,
  MissionsListPanel,
  MissionsViewModeToggle,
} from './MissionsPage.components';
import { useMissionsDashboard } from './MissionsPage.hooks';

const MissionsPage = (): JSX.Element => {
  const editorRef = useRef<TiptapEditorRef | null>(null);
  const {
    clients,
    contacts,
    closeModal,
    currentPage,
    deals,
    editingMission,
    fetchMissions,
    formData,
    goToPage,
    handleDelete,
    handleEdit,
    handleSubmit,
    loading,
    loadingClients,
    loadingContacts,
    loadingDeals,
    missions,
    openCreateModal,
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
  } = useMissionsDashboard();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="cv-surface mx-auto mb-8 max-w-7xl rounded-[2.5rem] p-6 sm:p-8"
    >
      <MissionsHeader />
      <MissionsViewModeToggle value={viewMode} onChange={setViewMode} />

      {viewMode === 'byDeal' ? (
        <MissionsByDealView onAddMission={openCreateModal} />
      ) : (
        <MissionsListPanel
          currentPage={currentPage}
          loading={loading}
          missions={missions}
          onAddMission={openCreateModal}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onPageChange={goToPage}
          onRefresh={fetchMissions}
          onResetSearch={resetSearch}
          onSearchChange={setSearchTerm}
          searchTerm={searchTerm}
          stats={stats}
          totalCount={totalCount}
          totalPages={totalPages}
        />
      )}

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
