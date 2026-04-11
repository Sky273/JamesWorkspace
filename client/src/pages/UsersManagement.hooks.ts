import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

import userService from '../utils/userService';
import logger from '../utils/logger.frontend';
import {
  buildUsersManagementStats,
  createDeleteTarget,
  getTotalPages,
} from './UsersManagement.hookUtils';

export interface User {
  id: string;
  name?: string;
  email?: string;
  firm?: string;
  firmId?: string;
  firmName?: string;
  role?: string;
  status?: string;
}

export interface Firm {
  id: string;
  name: string;
}

export interface DeleteTarget {
  id: string;
  name?: string;
  type: 'user' | 'firm';
}

export interface UserFormData {
  name: string;
  email: string;
  jobTitle: string;
  phone: string;
  firmId: string;
  role: string;
  status: string;
}

export interface FirmFormData {
  name: string;
  logoFile?: File | null;
}

export interface UsersManagementStats {
  totalUsers: number;
  totalFirms: number;
  activeUsers: number;
  admins: number;
}

export type UsersManagementTab = 'users' | 'firms';
export const USERS_PAGE_SIZE = 12;

export function useUsersManagementDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const tRef = useRef(t);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [firmsLoading, setFirmsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<UsersManagementTab>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalCount, setUsersTotalCount] = useState(0);
  const [, setUsersHasMore] = useState(false);
  const [firmsPage, setFirmsPage] = useState(1);
  const [firmsTotalCount, setFirmsTotalCount] = useState(0);
  const [, setFirmsHasMore] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [firmModalOpen, setFirmModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const canManageFirms = user?.role === 'admin';
  const canAssignSuperAdmin = user?.role === 'admin';
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const currentUserFirmId = user?.firmId || user?.firm_id || '';
  const currentUserFirm = useMemo(
    () => (currentUserFirmId
      ? { id: currentUserFirmId, name: user?.firmName || user?.firm || 'Cabinet' }
      : null),
    [currentUserFirmId, user?.firm, user?.firmName],
  );

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    startTransition(() => {
      setUsersPage(1);
      setFirmsPage(1);
    });
  }, [searchTerm]);

  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const userData = await userService.getUsersPaginated({
        page: usersPage,
        pageSize: USERS_PAGE_SIZE,
        search: deferredSearchTerm,
      });
      if (userData.users) {
        setUsers(userData.users);
        setUsersTotalCount(userData.pagination?.totalCount || userData.users.length);
        setUsersHasMore(userData.pagination?.hasMore || false);
      } else {
        setUsers(Array.isArray(userData) ? userData : []);
        setUsersTotalCount(Array.isArray(userData) ? userData.length : 0);
      }
    } catch (error) {
      logger.error('Error loading users:', error);
      toast.error(tRef.current('common.error'));
    } finally {
      setUsersLoading(false);
    }
  }, [deferredSearchTerm, usersPage]);

  const fetchFirms = useCallback(async () => {
    if (!canManageFirms) {
      const scopedFirms = currentUserFirm ? [currentUserFirm] : [];
      setFirms(scopedFirms);
      setFirmsTotalCount(scopedFirms.length);
      setFirmsHasMore(false);
      return;
    }

    try {
      setFirmsLoading(true);
      const customerData = await userService.getCustomersPaginated({
        page: firmsPage,
        pageSize: USERS_PAGE_SIZE,
        search: deferredSearchTerm,
      });

      if (customerData?.customers) {
        setFirms(customerData.customers);
        setFirmsTotalCount(customerData.pagination?.totalCount || customerData.customers.length);
        setFirmsHasMore(customerData.pagination?.hasMore || false);
      }
    } catch (error) {
      logger.error('Error loading firms:', error);
      toast.error(tRef.current('common.error'));
    } finally {
      setFirmsLoading(false);
    }
  }, [canManageFirms, currentUserFirm, deferredSearchTerm, firmsPage]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!canManageFirms) {
      void fetchFirms();
      return;
    }

    const shouldPrioritizeFirms = activeTab === 'firms' || userModalOpen || firmModalOpen;
    if (shouldPrioritizeFirms) {
      void fetchFirms();
      return;
    }

    const deferredFetch = window.setTimeout(() => {
      void fetchFirms();
    }, 250);

    return () => window.clearTimeout(deferredFetch);
  }, [activeTab, canManageFirms, fetchFirms, firmModalOpen, userModalOpen]);

  useEffect(() => {
    setLoading(usersLoading);
  }, [usersLoading]);

  useEffect(() => {
    if (!canManageFirms && activeTab !== 'users') {
      setActiveTab('users');
    }
  }, [activeTab, canManageFirms]);

  const usersTotalPages = getTotalPages(usersTotalCount, USERS_PAGE_SIZE);
  const firmsTotalPages = getTotalPages(firmsTotalCount, USERS_PAGE_SIZE);

  const goToUsersPage = useCallback((page: number) => {
    if (page >= 1 && page <= usersTotalPages) {
      setUsersPage(page);
    }
  }, [usersTotalPages]);

  const goToFirmsPage = useCallback((page: number) => {
    if (page >= 1 && page <= firmsTotalPages) {
      setFirmsPage(page);
    }
  }, [firmsTotalPages]);

  const handleUserSubmit = useCallback(async (formData: UserFormData) => {
    try {
      if (selectedUser) {
        await userService.updateUser(selectedUser.id, {
          name: formData.name,
          email: formData.email.toLowerCase(),
          jobTitle: formData.jobTitle || '',
          phone: formData.phone || '',
          firmId: formData.firmId || undefined,
          role: formData.role,
          status: formData.status,
        });
        toast.success(t('users.management.messages.userUpdated'));
      } else {
        await userService.createUser({
          name: formData.name,
          email: formData.email,
          jobTitle: formData.jobTitle || '',
          phone: formData.phone || '',
          firmId: formData.firmId,
          role: formData.role,
          status: formData.status,
        });
        toast.success(t('users.management.messages.userCreatedInvitationSent'));
      }

      setUserModalOpen(false);
      setSelectedUser(null);
      await fetchUsers();
      if (canManageFirms) {
        void fetchFirms();
      }
    } catch (error) {
      logger.error('Error saving user:', error);
      toast.error(selectedUser ? t('users.management.messages.errorUpdatingUser') : t('users.management.messages.errorCreatingUser'));
    }
  }, [canManageFirms, fetchFirms, fetchUsers, selectedUser, t]);

  const handleDeleteUser = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await userService.deleteUser(deleteTarget.id);
      toast.success(t('users.management.messages.userDeleted'));
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      await fetchUsers();
      if (canManageFirms) {
        void fetchFirms();
      }
    } catch (error) {
      logger.error('Error deleting user:', error);
      toast.error(t('users.management.messages.errorDeletingUser'));
    }
  }, [canManageFirms, deleteTarget, fetchFirms, fetchUsers, t]);

  const handleForcePasswordReset = useCallback(async () => {
    if (!selectedUser) {
      return;
    }

    try {
      await userService.forcePasswordReset(selectedUser.id);
      toast.success(t('users.management.messages.passwordResetForced'));
      setPasswordModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      logger.error('Error forcing password reset:', error);
      toast.error(t('users.management.messages.errorForcingPasswordReset'));
    }
  }, [selectedUser, t]);

  const handleFirmSubmit = useCallback(async (formData: FirmFormData) => {
    try {
      let firmId: string | undefined;
      if (selectedFirm) {
        await userService.updateCustomer(selectedFirm.id, { name: formData.name });
        firmId = selectedFirm.id;
        toast.success(t('users.management.messages.firmUpdated'));
      } else {
        const newFirm = await userService.createCustomer({ name: formData.name });
        firmId = newFirm?.id;
        toast.success(t('users.management.messages.firmCreated'));
      }

      if (firmId && formData.logoFile) {
        try {
          await userService.uploadFirmLogo(firmId, formData.logoFile);
          toast.success(t('users.management.messages.logoUploaded'));
        } catch (logoError) {
          logger.error('Error uploading logo:', logoError);
          toast.error(t('users.management.messages.logoUploadFailed'));
        }
      }

      setFirmModalOpen(false);
      setSelectedFirm(null);
      await fetchUsers();
      void fetchFirms();
    } catch (error) {
      logger.error('Error saving customer:', error);
      toast.error(selectedFirm ? t('users.management.messages.errorUpdatingFirm') : t('users.management.messages.errorCreatingFirm'));
    }
  }, [fetchFirms, fetchUsers, selectedFirm, t]);

  const handleDeleteFirm = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await userService.deleteCustomer(deleteTarget.id);
      toast.success(t('users.management.messages.firmDeleted'));
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      await fetchUsers();
      void fetchFirms();
    } catch (error: unknown) {
      logger.error('Error deleting customer:', error);
      if (error instanceof Error && error.message.includes('associated users')) {
        toast.error(t('users.management.messages.cannotDeleteFirmWithUsers'));
      } else {
        toast.error(t('users.management.messages.errorDeletingFirm'));
      }
    }
  }, [deleteTarget, fetchFirms, fetchUsers, t]);

  const stats = useMemo<UsersManagementStats>(
    () => buildUsersManagementStats(users, usersTotalCount, firmsTotalCount),
    [firmsTotalCount, users, usersTotalCount],
  );

  const refreshData = useCallback(async () => {
    await fetchUsers();

    if (canManageFirms && (activeTab === 'firms' || firms.length > 0)) {
      await fetchFirms();
    }
  }, [activeTab, canManageFirms, fetchFirms, fetchUsers, firms.length]);

  return {
    activeTab,
    closeDeleteModal: () => {
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    },
    closeFirmModal: () => {
      setFirmModalOpen(false);
      setSelectedFirm(null);
    },
    closePasswordModal: () => {
      setPasswordModalOpen(false);
      setSelectedUser(null);
    },
    closeUserModal: () => {
      setUserModalOpen(false);
      setSelectedUser(null);
    },
    deleteModalOpen,
    deleteTarget,
    fetchData: refreshData,
    firmsLoading,
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
    handleForcePasswordReset,
    handleUserSubmit,
    canAssignSuperAdmin,
    canManageFirms,
    loading,
    openCreateFirm: () => {
      setSelectedFirm(null);
      setFirmModalOpen(true);
    },
    openCreateUser: () => {
      setSelectedUser(null);
      setUserModalOpen(true);
    },
    openDeleteFirm: (firm: Firm) => {
      setDeleteTarget(createDeleteTarget(firm, 'firm'));
      setDeleteModalOpen(true);
    },
    openDeleteUser: (user: User) => {
      setDeleteTarget(createDeleteTarget(user, 'user'));
      setDeleteModalOpen(true);
    },
    openEditFirm: (firm: Firm) => {
      setSelectedFirm(firm);
      setFirmModalOpen(true);
    },
    openEditUser: (user: User) => {
      setSelectedUser(user);
      setUserModalOpen(true);
    },
    openPasswordModal: (user: User) => {
      setSelectedUser(user);
      setPasswordModalOpen(true);
    },
    passwordModalOpen,
    resetSearch: () => setSearchTerm(''),
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
  };
}
