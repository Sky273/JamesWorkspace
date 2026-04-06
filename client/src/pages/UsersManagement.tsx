import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import {
  ConfirmDeleteModal,
  FirmFormModal,
  PasswordModal,
  UserFormModal,
} from '../components/UsersManagement';
import {
  FirmsResults,
  UsersManagementHeader,
  UsersManagementLoadingState,
  UsersManagementStatsCards,
  UsersManagementToolbar,
  UsersResults,
} from './UsersManagement.components';
import { useUsersManagementDashboard } from './UsersManagement.hooks';

const UsersManagement = (): JSX.Element => {
  const { t } = useTranslation();
  const {
    activeTab,
    closeDeleteModal,
    closeFirmModal,
    closePasswordModal,
    closeUserModal,
    deleteModalOpen,
    deleteTarget,
    fetchData,
    firmModalOpen,
    firms,
    firmsPage,
    firmsTotalCount,
    firmsTotalPages,
    goToFirmsPage,
    goToUsersPage,
    handleDeleteFirm,
    handleDeleteUser,
    handleFirmSubmit,
    handlePasswordChange,
    handleUserSubmit,
    loading,
    openCreateFirm,
    openCreateUser,
    openDeleteFirm,
    openDeleteUser,
    openEditFirm,
    openEditUser,
    openPasswordModal,
    passwordModalOpen,
    resetSearch,
    searchTerm,
    selectedFirm,
    selectedUser,
    setActiveTab,
    setSearchTerm,
    stats,
    userModalOpen,
    users,
    usersPage,
    usersTotalCount,
    usersTotalPages,
  } = useUsersManagementDashboard();

  if (loading) {
    return <UsersManagementLoadingState />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="cv-surface app-page-shell"
    >
      <UsersManagementHeader />
      <UsersManagementStatsCards stats={stats} />
      <UsersManagementToolbar
        activeTab={activeTab}
        firmsCount={firms.length}
        onCreate={activeTab === 'users' ? openCreateUser : openCreateFirm}
        onRefresh={fetchData}
        onResetSearch={resetSearch}
        onSearchChange={setSearchTerm}
        onTabChange={setActiveTab}
        searchTerm={searchTerm}
        usersCount={users.length}
      />

      {activeTab === 'users' ? (
        <UsersResults
          currentPage={usersPage}
          loading={loading}
          onDelete={openDeleteUser}
          onEdit={openEditUser}
          onPageChange={goToUsersPage}
          onPassword={openPasswordModal}
          totalCount={usersTotalCount}
          totalPages={usersTotalPages}
          users={users}
        />
      ) : (
        <FirmsResults
          currentPage={firmsPage}
          firms={firms}
          loading={loading}
          onDelete={openDeleteFirm}
          onEdit={openEditFirm}
          onPageChange={goToFirmsPage}
          totalCount={firmsTotalCount}
          totalPages={firmsTotalPages}
          users={users}
        />
      )}

      <UserFormModal
        isOpen={userModalOpen}
        onClose={closeUserModal}
        onSubmit={handleUserSubmit}
        user={selectedUser}
        firms={firms}
        t={t}
      />
      <FirmFormModal
        isOpen={firmModalOpen}
        onClose={closeFirmModal}
        onSubmit={handleFirmSubmit}
        firm={selectedFirm}
        t={t}
      />
      <PasswordModal
        isOpen={passwordModalOpen}
        onClose={closePasswordModal}
        onSubmit={handlePasswordChange}
        userName={selectedUser?.name || ''}
        t={t}
      />
      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={deleteTarget?.type === 'user' ? handleDeleteUser : handleDeleteFirm}
        message={deleteTarget?.type === 'user' ? t('users.management.messages.confirmDeleteUser', { name: deleteTarget?.name }) : t('users.management.messages.confirmDeleteFirm', { name: deleteTarget?.name })}
        t={t}
      />
    </motion.div>
  );
};

export default UsersManagement;
