import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import {
  FirmsResults,
  UsersManagementHeader,
  UsersManagementLoadingState,
  UsersManagementStatsCards,
  UsersManagementToolbar,
  UsersResults,
} from './UsersManagement.components';
import { useUsersManagementDashboard } from './UsersManagement.hooks';

const ConfirmDeleteModal = lazy(() => import('../components/UsersManagement/ConfirmDeleteModal'));
const FirmFormModal = lazy(() => import('../components/UsersManagement/FirmFormModal'));
const PasswordModal = lazy(() => import('../components/UsersManagement/PasswordModal'));
const UserFormModal = lazy(() => import('../components/UsersManagement/UserFormModal'));

const UsersManagement = ({
  embedded = false,
  forcedTab,
  hideTabSelector = false,
}: {
  embedded?: boolean;
  forcedTab?: 'users' | 'firms';
  hideTabSelector?: boolean;
} = {}): JSX.Element => {
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
    firmsLoading,
    firmsPage,
    firmsTotalCount,
    firmsTotalPages,
    goToFirmsPage,
    goToUsersPage,
    handleDeleteFirm,
    handleDeleteUser,
    handleFirmSubmit,
    handleForcePasswordReset,
    handleUserSubmit,
    canAssignSuperAdmin,
    canManageFirms,
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
  } = useUsersManagementDashboard({ embedded, forcedTab });

  const effectiveTab = forcedTab || activeTab;

  const setManagementTab = (nextTab: 'users' | 'firms') => {
    if (forcedTab) {
      return;
    }
    setActiveTab(nextTab);
  };

  if (loading) {
    return <UsersManagementLoadingState />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={embedded ? 'users-management-shell space-y-6' : 'users-management-shell cv-surface app-page-shell'}
    >
      {!embedded ? <UsersManagementHeader /> : null}
      <UsersManagementStatsCards stats={stats} showFirmsStats={canManageFirms} />
      <UsersManagementToolbar
        activeTab={effectiveTab}
        canManageFirms={canManageFirms}
        firmsCount={firms.length}
        hideTabs={hideTabSelector || Boolean(forcedTab)}
        onCreate={effectiveTab === 'users' ? openCreateUser : openCreateFirm}
        onRefresh={fetchData}
        onResetSearch={resetSearch}
        onSearchChange={setSearchTerm}
        onTabChange={setManagementTab}
        searchTerm={searchTerm}
        usersCount={users.length}
      />

      {effectiveTab === 'users' ? (
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
          loading={loading || firmsLoading}
          onDelete={openDeleteFirm}
          onEdit={openEditFirm}
          onPageChange={goToFirmsPage}
          totalCount={firmsTotalCount}
          totalPages={firmsTotalPages}
          users={users}
        />
      )}

      <Suspense fallback={null}>
        {userModalOpen ? (
          <UserFormModal
            isOpen={userModalOpen}
            onClose={closeUserModal}
            onSubmit={handleUserSubmit}
            user={selectedUser}
            firms={firms}
            canAssignSuperAdmin={canAssignSuperAdmin}
            canChangeFirm={canManageFirms}
            t={t}
          />
        ) : null}
        {canManageFirms && firmModalOpen ? (
          <FirmFormModal
            isOpen={firmModalOpen}
            onClose={closeFirmModal}
            onSubmit={handleFirmSubmit}
            firm={selectedFirm}
            t={t}
          />
        ) : null}
        {passwordModalOpen ? (
          <PasswordModal
            isOpen={passwordModalOpen}
            onClose={closePasswordModal}
            onSubmit={handleForcePasswordReset}
            userName={selectedUser?.name || ''}
            t={t}
          />
        ) : null}
        {deleteModalOpen ? (
          <ConfirmDeleteModal
            isOpen={deleteModalOpen}
            onClose={closeDeleteModal}
            onConfirm={deleteTarget?.type === 'user' ? handleDeleteUser : handleDeleteFirm}
            message={deleteTarget?.type === 'user' ? t('users.management.messages.confirmDeleteUser', { name: deleteTarget?.name }) : t('users.management.messages.confirmDeleteFirm', { name: deleteTarget?.name })}
            t={t}
          />
        ) : null}
      </Suspense>
    </motion.div>
  );
};

export default UsersManagement;
