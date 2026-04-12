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
type FetchUsersOptions = {
  page?: number;
  search?: string;
  clearOptimisticState?: boolean;
  forceRefresh?: boolean;
};
type FetchFirmsOptions = {
  page?: number;
  search?: string;
  clearOptimisticState?: boolean;
  forceRefresh?: boolean;
  preserveFirm?: Firm | null;
};

export function useUsersManagementDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const tRef = useRef(t);
  const usersRequestIdRef = useRef(0);
  const firmsRequestIdRef = useRef(0);
  const deletedUserIdsRef = useRef<Set<string>>(new Set());
  const deletedFirmIdsRef = useRef<Set<string>>(new Set());
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

  const fetchUsers = useCallback(async (options: FetchUsersOptions = {}) => {
    const requestId = ++usersRequestIdRef.current;
    const effectivePage = options.page ?? usersPage;
    const effectiveSearch = options.search ?? deferredSearchTerm;
    if (options.clearOptimisticState) {
      deletedUserIdsRef.current.clear();
    }
    try {
      setUsersLoading(true);
      const userData = await userService.getUsersPaginated({
        page: effectivePage,
        pageSize: USERS_PAGE_SIZE,
        search: effectiveSearch,
        forceRefresh: options.forceRefresh,
      });
      if (requestId !== usersRequestIdRef.current) {
        return;
      }

      const filterDeletedUsers = (records: User[]) => records.filter(
        (record) => !deletedUserIdsRef.current.has(record.id),
      );

      if (userData.users) {
        const visibleUsers = filterDeletedUsers(userData.users);
        setUsers(visibleUsers);
        const reportedTotal = userData.pagination?.totalCount;
        const adjustedTotal = typeof reportedTotal === 'number'
          ? Math.max(0, reportedTotal - [...deletedUserIdsRef.current].filter((id) => userData.users.some((user) => user.id === id)).length)
          : visibleUsers.length;
        setUsersTotalCount(adjustedTotal);
        setUsersHasMore(userData.pagination?.hasMore || false);
      } else {
        const visibleUsers = filterDeletedUsers(Array.isArray(userData) ? userData : []);
        setUsers(visibleUsers);
        setUsersTotalCount(visibleUsers.length);
      }
    } catch (error) {
      if (requestId !== usersRequestIdRef.current) {
        return;
      }
      logger.error('Error loading users:', error);
      toast.error(tRef.current('common.error'));
    } finally {
      if (requestId === usersRequestIdRef.current) {
        setUsersLoading(false);
      }
    }
  }, [deferredSearchTerm, usersPage]);

  const fetchFirms = useCallback(async (options: FetchFirmsOptions = {}) => {
    const requestId = ++firmsRequestIdRef.current;
    const effectivePage = options.page ?? firmsPage;
    const effectiveSearch = options.search ?? deferredSearchTerm;
    const normalizedSearch = effectiveSearch.trim().toLowerCase();
    if (options.clearOptimisticState) {
      deletedFirmIdsRef.current.clear();
    }
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
        page: effectivePage,
        pageSize: USERS_PAGE_SIZE,
        search: effectiveSearch,
        forceRefresh: options.forceRefresh,
      });

      if (customerData?.customers) {
        if (requestId !== firmsRequestIdRef.current) {
          return;
        }
        const visibleFirms = customerData.customers.filter((firm) => !deletedFirmIdsRef.current.has(firm.id));
        const preservedFirm = options.preserveFirm;
        const shouldPreserveFirm = preservedFirm != null
          && !deletedFirmIdsRef.current.has(preservedFirm.id)
          && (normalizedSearch.length === 0 || preservedFirm.name.toLowerCase().includes(normalizedSearch))
          && !visibleFirms.some((firm) => firm.id === preservedFirm.id);
        const nextFirms: Firm[] = shouldPreserveFirm && preservedFirm
          ? [preservedFirm, ...visibleFirms].slice(0, USERS_PAGE_SIZE)
          : visibleFirms;
        setFirms(nextFirms);
        const reportedTotal = customerData.pagination?.totalCount;
        const adjustedTotal = typeof reportedTotal === 'number'
          ? Math.max(0, reportedTotal - [...deletedFirmIdsRef.current].filter((id) => customerData.customers.some((firm) => firm.id === id)).length)
          : nextFirms.length;
        setFirmsTotalCount(adjustedTotal);
        setFirmsHasMore(customerData.pagination?.hasMore || false);
      }
    } catch (error) {
      if (requestId !== firmsRequestIdRef.current) {
        return;
      }
      logger.error('Error loading firms:', error);
      toast.error(tRef.current('common.error'));
    } finally {
      if (requestId === firmsRequestIdRef.current) {
        setFirmsLoading(false);
      }
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
        const updatedUser = await userService.updateUser(selectedUser.id, {
          name: formData.name,
          email: formData.email.toLowerCase(),
          jobTitle: formData.jobTitle || '',
          phone: formData.phone || '',
          firmId: formData.firmId || undefined,
          role: formData.role,
          status: formData.status,
        });
        usersRequestIdRef.current += 1;
        setUsers((currentUsers) => currentUsers.map((userRecord) => (userRecord.id === selectedUser.id ? updatedUser : userRecord)));
        toast.success(t('users.management.messages.userUpdated'));
        await fetchUsers();
      } else {
        const createdUser = await userService.createUser({
          name: formData.name,
          email: formData.email,
          jobTitle: formData.jobTitle || '',
          phone: formData.phone || '',
          firmId: formData.firmId,
          role: formData.role,
          status: formData.status,
        });
        usersRequestIdRef.current += 1;
        deletedUserIdsRef.current.delete(createdUser.id);
        setUsers((currentUsers) => [createdUser, ...currentUsers].slice(0, USERS_PAGE_SIZE));
        setUsersTotalCount((currentTotal) => currentTotal + 1);
        setUsersPage(1);
        toast.success(t('users.management.messages.userCreatedInvitationSent'));
      }

      setUserModalOpen(false);
      setSelectedUser(null);
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
      const deletedUserId = deleteTarget.id;
      deletedUserIdsRef.current.add(deletedUserId);
      setUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== deletedUserId));
      setUsersTotalCount((currentTotal) => Math.max(0, currentTotal - 1));

      await userService.deleteUser(deletedUserId);
      toast.success(t('users.management.messages.userDeleted'));
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      await fetchUsers();
      if (canManageFirms) {
        void fetchFirms();
      }
    } catch (error) {
      deletedUserIdsRef.current.delete(deleteTarget.id);
      void fetchUsers();
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
      let createdFirm: Firm | null = null;
      const normalizedSearch = searchTerm.trim();
      if (selectedFirm) {
        const updatedFirm = await userService.updateCustomer(selectedFirm.id, { name: formData.name });
        firmsRequestIdRef.current += 1;
        setFirms((currentFirms) => currentFirms.map((firm) => (firm.id === selectedFirm.id ? updatedFirm : firm)));
        firmId = selectedFirm.id;
        toast.success(t('users.management.messages.firmUpdated'));
      } else {
        const newFirm = await userService.createCustomer({ name: formData.name });
        firmsRequestIdRef.current += 1;
        deletedFirmIdsRef.current.delete(newFirm.id);
        setFirms((currentFirms) => [newFirm, ...currentFirms].slice(0, USERS_PAGE_SIZE));
        setFirmsTotalCount((currentTotal) => currentTotal + 1);
        setFirmsPage(1);
        firmId = newFirm?.id;
        createdFirm = newFirm;
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
      await fetchFirms({
        page: selectedFirm ? firmsPage : 1,
        search: normalizedSearch,
        clearOptimisticState: false,
        forceRefresh: true,
        preserveFirm: selectedFirm ? null : createdFirm,
      });
      await fetchUsers();
    } catch (error) {
      logger.error('Error saving customer:', error);
      toast.error(selectedFirm ? t('users.management.messages.errorUpdatingFirm') : t('users.management.messages.errorCreatingFirm'));
    }
  }, [fetchFirms, fetchUsers, firmsPage, searchTerm, selectedFirm, t]);

  const handleDeleteFirm = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      const deletedFirmId = deleteTarget.id;
      const normalizedSearch = searchTerm.trim();
      deletedFirmIdsRef.current.add(deletedFirmId);
      setFirms((currentFirms) => currentFirms.filter((firm) => firm.id !== deletedFirmId));
      setFirmsTotalCount((currentTotal) => Math.max(0, currentTotal - 1));

      await userService.deleteCustomer(deletedFirmId);
      toast.success(t('users.management.messages.firmDeleted'));
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      await fetchFirms({
        page: firmsPage,
        search: normalizedSearch,
        clearOptimisticState: false,
        forceRefresh: true,
      });
      await fetchUsers();
    } catch (error: unknown) {
      deletedFirmIdsRef.current.delete(deleteTarget.id);
      void fetchFirms({
        page: firmsPage,
        search: searchTerm.trim(),
        clearOptimisticState: false,
        forceRefresh: true,
      });
      logger.error('Error deleting customer:', error);
      if (error instanceof Error && error.message.includes('associated users')) {
        toast.error(t('users.management.messages.cannotDeleteFirmWithUsers'));
      } else {
        toast.error(t('users.management.messages.errorDeletingFirm'));
      }
    }
  }, [deleteTarget, fetchFirms, fetchUsers, firmsPage, searchTerm, t]);

  const stats = useMemo<UsersManagementStats>(
    () => buildUsersManagementStats(users, usersTotalCount, firmsTotalCount),
    [firmsTotalCount, users, usersTotalCount],
  );

  const refreshData = useCallback(async () => {
    const normalizedSearch = searchTerm.trim();
    const nextUsersPage = normalizedSearch === deferredSearchTerm ? usersPage : 1;
    const nextFirmsPage = normalizedSearch === deferredSearchTerm ? firmsPage : 1;

    usersRequestIdRef.current += 1;
    firmsRequestIdRef.current += 1;
    if (normalizedSearch !== deferredSearchTerm) {
      startTransition(() => {
        setUsersPage(1);
        setFirmsPage(1);
      });
    }

    await fetchUsers({
      page: nextUsersPage,
      search: normalizedSearch,
      clearOptimisticState: true,
      forceRefresh: true,
    });

    if (canManageFirms && (activeTab === 'firms' || firms.length > 0)) {
      await fetchFirms({
        page: nextFirmsPage,
        search: normalizedSearch,
        clearOptimisticState: true,
        forceRefresh: true,
      });
    }
  }, [activeTab, canManageFirms, deferredSearchTerm, fetchFirms, fetchUsers, firms.length, firmsPage, searchTerm, usersPage]);

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
