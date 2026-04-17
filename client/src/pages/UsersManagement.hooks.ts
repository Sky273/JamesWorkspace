import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

import { useScopedViewRefresh } from '../hooks/useScopedViewRefresh';
import userService from '../utils/userService';
import logger from '../utils/logger.frontend';
import {
  markFirmViewsDirty,
  markUsersViewDirty,
} from '../utils/viewRefreshScopes';
import {
  buildVisibleRecordsPage,
  buildUsersManagementStats,
  computeAdjustedTotalCount,
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

function matchesUserSearch(user: User, rawSearch: string): boolean {
  const normalizedSearch = rawSearch.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }

  return [user.name, user.email, user.firmName, user.firm]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .some((value) => value.toLowerCase().includes(normalizedSearch));
}

function matchesFirmSearch(firm: Firm, rawSearch: string): boolean {
  const normalizedSearch = rawSearch.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }

  return firm.name.toLowerCase().includes(normalizedSearch);
}

type FetchUsersOptions = {
  page?: number;
  search?: string;
  clearOptimisticState?: boolean;
  forceRefresh?: boolean;
  preserveUser?: User | null;
};
type FetchFirmsOptions = {
  page?: number;
  search?: string;
  clearOptimisticState?: boolean;
  forceRefresh?: boolean;
  preserveFirm?: Firm | null;
};

export function useUsersManagementDashboard(options: { embedded?: boolean; forcedTab?: UsersManagementTab } = {}) {
  const refreshConsumerId = options.embedded ? 'admin-workspace:users-management' : 'users-management';
  const { t } = useTranslation();
  const { user } = useAuth();
  const tRef = useRef(t);
  const usersRequestIdRef = useRef(0);
  const firmsRequestIdRef = useRef(0);
  const deletedUserIdsRef = useRef<Set<string>>(new Set());
  const deletedFirmIdsRef = useRef<Set<string>>(new Set());
  const pendingUserRef = useRef<User | null>(null);
  const pendingFirmRef = useRef<Firm | null>(null);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [firmsLoading, setFirmsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<UsersManagementTab>('users');
  const [usersSearchTerm, setUsersSearchTerm] = useState('');
  const [firmsSearchTerm, setFirmsSearchTerm] = useState('');
  const [debouncedUsersSearchTerm, setDebouncedUsersSearchTerm] = useState('');
  const [debouncedFirmsSearchTerm, setDebouncedFirmsSearchTerm] = useState('');
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
  const effectiveActiveTab = options.forcedTab || activeTab;
  const canManageFirms = user?.role === 'admin';
  const canAssignSuperAdmin = user?.role === 'admin';
  const currentUserFirmId = user?.firmId || '';
  const currentUserFirm = useMemo(
    () => (currentUserFirmId
      ? { id: currentUserFirmId, name: user?.firmName || 'Cabinet' }
      : null),
    [currentUserFirmId, user?.firmName],
  );

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    startTransition(() => {
      setUsersPage(1);
    });
  }, [usersSearchTerm]);

  useEffect(() => {
    startTransition(() => {
      setFirmsPage(1);
    });
  }, [firmsSearchTerm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedUsersSearchTerm(usersSearchTerm);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [usersSearchTerm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFirmsSearchTerm(firmsSearchTerm);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [firmsSearchTerm]);

  const fetchUsers = useCallback(async (options: FetchUsersOptions = {}) => {
    const requestId = ++usersRequestIdRef.current;
    const effectivePage = options.page ?? usersPage;
    const effectiveSearch = options.search ?? debouncedUsersSearchTerm;
    const normalizedSearch = effectiveSearch.trim().toLowerCase();
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

      const preservedUser = options.preserveUser ?? (options.clearOptimisticState ? null : pendingUserRef.current);
      const shouldPreserveUser = preservedUser != null
        && !deletedUserIdsRef.current.has(preservedUser.id)
        && (normalizedSearch.length === 0
          || (preservedUser.name || '').toLowerCase().includes(normalizedSearch)
          || (preservedUser.email || '').toLowerCase().includes(normalizedSearch));

      if (userData.users) {
        const { nextRecords: nextUsers, responseIncludesPreservedRecord: responseIncludesPreservedUser } = buildVisibleRecordsPage(userData.users, {
          deletedIds: deletedUserIdsRef.current,
          pageSize: USERS_PAGE_SIZE,
          preservedRecord: preservedUser,
          shouldIncludePreservedRecord: shouldPreserveUser,
        });
        setUsers(nextUsers);
        pendingUserRef.current = options.clearOptimisticState || responseIncludesPreservedUser
          ? null
          : preservedUser;
        setUsersTotalCount(
          computeAdjustedTotalCount(
            userData.users,
            deletedUserIdsRef.current,
            userData.pagination?.totalCount ?? undefined,
            nextUsers.length,
          ),
        );
        setUsersHasMore(userData.pagination?.hasMore || false);
      } else {
        const { nextRecords: nextUsers } = buildVisibleRecordsPage(Array.isArray(userData) ? userData : [], {
          deletedIds: deletedUserIdsRef.current,
          pageSize: USERS_PAGE_SIZE,
          preservedRecord: preservedUser,
          shouldIncludePreservedRecord: shouldPreserveUser,
        });
        setUsers(nextUsers);
        pendingUserRef.current = options.clearOptimisticState ? null : preservedUser;
        setUsersTotalCount(nextUsers.length);
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
  }, [debouncedUsersSearchTerm, usersPage]);

  const fetchFirms = useCallback(async (options: FetchFirmsOptions = {}) => {
    const requestId = ++firmsRequestIdRef.current;
    const effectivePage = options.page ?? firmsPage;
    const effectiveSearch = options.search ?? debouncedFirmsSearchTerm;
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
        const preservedFirm = options.preserveFirm ?? (options.clearOptimisticState ? null : pendingFirmRef.current);
        const shouldPreserveFirm = preservedFirm != null
          && !deletedFirmIdsRef.current.has(preservedFirm.id)
          && (normalizedSearch.length === 0 || preservedFirm.name.toLowerCase().includes(normalizedSearch));
        const { nextRecords: nextFirms, responseIncludesPreservedRecord: responseIncludesPreservedFirm } = buildVisibleRecordsPage(customerData.customers, {
          deletedIds: deletedFirmIdsRef.current,
          pageSize: USERS_PAGE_SIZE,
          preservedRecord: preservedFirm,
          shouldIncludePreservedRecord: shouldPreserveFirm,
        });
        setFirms(nextFirms);
        pendingFirmRef.current = options.clearOptimisticState || responseIncludesPreservedFirm
          ? null
          : preservedFirm;
        setFirmsTotalCount(
          computeAdjustedTotalCount(
            customerData.customers,
            deletedFirmIdsRef.current,
            customerData.pagination?.totalCount ?? undefined,
            nextFirms.length,
          ),
        );
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
  }, [canManageFirms, currentUserFirm, debouncedFirmsSearchTerm, firmsPage]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!canManageFirms) {
      void fetchFirms();
      return;
    }

    const shouldPrioritizeFirms = effectiveActiveTab === 'firms' || userModalOpen || firmModalOpen;
    if (shouldPrioritizeFirms) {
      void fetchFirms();
      return;
    }

    const deferredFetch = window.setTimeout(() => {
      void fetchFirms();
    }, 250);

    return () => window.clearTimeout(deferredFetch);
  }, [canManageFirms, effectiveActiveTab, fetchFirms, firmModalOpen, userModalOpen]);

  useEffect(() => {
    if (!usersLoading && loading) {
      setLoading(false);
    }
  }, [loading, usersLoading]);

  useEffect(() => {
    if (!canManageFirms && activeTab !== 'users') {
      setActiveTab('users');
    }
  }, [activeTab, canManageFirms]);

  useScopedViewRefresh({
    consumerId: refreshConsumerId,
    scopes: ['users', 'administration'],
    onRefresh: () => {
      void fetchUsers({ forceRefresh: true });
    },
  });

  useScopedViewRefresh({
    consumerId: refreshConsumerId,
    scopes: ['firms', 'administration'],
    enabled: canManageFirms,
    onRefresh: () => {
      void fetchFirms({ forceRefresh: true });
    },
  });

  const effectiveUsers = useMemo(() => {
    const pendingUser = pendingUserRef.current;
    if (!pendingUser || deletedUserIdsRef.current.has(pendingUser.id) || !matchesUserSearch(pendingUser, usersSearchTerm)) {
      return users;
    }

    if (users.some((userRecord) => userRecord.id === pendingUser.id)) {
      return users;
    }

    return [pendingUser, ...users].slice(0, USERS_PAGE_SIZE);
  }, [users, usersSearchTerm]);
  const effectiveFirms = useMemo(() => {
    const pendingFirm = pendingFirmRef.current;
    if (!pendingFirm || deletedFirmIdsRef.current.has(pendingFirm.id) || !matchesFirmSearch(pendingFirm, firmsSearchTerm)) {
      return firms;
    }

    if (firms.some((firm) => firm.id === pendingFirm.id)) {
      return firms;
    }

    return [pendingFirm, ...firms].slice(0, USERS_PAGE_SIZE);
  }, [firms, firmsSearchTerm]);
  const effectiveUsersTotalCount = Math.max(usersTotalCount, effectiveUsers.length);
  const effectiveFirmsTotalCount = Math.max(firmsTotalCount, effectiveFirms.length);
  const usersTotalPages = getTotalPages(effectiveUsersTotalCount, USERS_PAGE_SIZE);
  const firmsTotalPages = getTotalPages(effectiveFirmsTotalCount, USERS_PAGE_SIZE);

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
      setUserModalOpen(false);
      setSelectedUser(null);
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
        pendingUserRef.current = updatedUser;
        usersRequestIdRef.current += 1;
        setUsers((currentUsers) => currentUsers.map((userRecord) => (userRecord.id === selectedUser.id ? updatedUser : userRecord)));
        toast.success(t('users.management.messages.userUpdated'));
        markUsersViewDirty();
        await fetchUsers({ preserveUser: updatedUser });
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
        pendingUserRef.current = createdUser;
        usersRequestIdRef.current += 1;
        deletedUserIdsRef.current.delete(createdUser.id);
        setUsers((currentUsers) => [createdUser, ...currentUsers].slice(0, USERS_PAGE_SIZE));
        setUsersTotalCount((currentTotal) => currentTotal + 1);
        setUsersPage(1);
        toast.success(
          createdUser.invitationSent === false
            ? t('users.management.messages.userCreatedInvitationPending')
            : t('users.management.messages.userCreatedInvitationSent')
        );
        markUsersViewDirty();
        await fetchUsers({ page: 1, search: usersSearchTerm.trim(), forceRefresh: true, preserveUser: createdUser });
      }

      if (canManageFirms) {
        void fetchFirms();
      }
    } catch (error) {
      logger.error('Error saving user:', error);
      toast.error(selectedUser ? t('users.management.messages.errorUpdatingUser') : t('users.management.messages.errorCreatingUser'));
    }
  }, [canManageFirms, fetchFirms, fetchUsers, selectedUser, t, usersSearchTerm]);

  const handleDeleteUser = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      const deletedUserId = deleteTarget.id;
      pendingUserRef.current = null;
      deletedUserIdsRef.current.add(deletedUserId);
      setUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== deletedUserId));
      setUsersTotalCount((currentTotal) => Math.max(0, currentTotal - 1));

      await userService.deleteUser(deletedUserId);
      toast.success(t('users.management.messages.userDeleted'));
      markUsersViewDirty();
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
      setFirmModalOpen(false);
      setSelectedFirm(null);
      let firmId: string | undefined;
      let createdFirm: Firm | null = null;
      const normalizedSearch = firmsSearchTerm.trim();
      if (selectedFirm) {
        const updatedFirm = await userService.updateCustomer(selectedFirm.id, { name: formData.name });
        pendingFirmRef.current = updatedFirm;
        firmsRequestIdRef.current += 1;
        setFirms((currentFirms) => currentFirms.map((firm) => (firm.id === selectedFirm.id ? updatedFirm : firm)));
        firmId = selectedFirm.id;
        toast.success(t('users.management.messages.firmUpdated'));
        markFirmViewsDirty();
      } else {
        const newFirm = await userService.createCustomer({ name: formData.name });
        pendingFirmRef.current = newFirm;
        firmsRequestIdRef.current += 1;
        deletedFirmIdsRef.current.delete(newFirm.id);
        setFirms((currentFirms) => [newFirm, ...currentFirms].slice(0, USERS_PAGE_SIZE));
        setFirmsTotalCount((currentTotal) => currentTotal + 1);
        setFirmsPage(1);
        firmId = newFirm?.id;
        createdFirm = newFirm;
        toast.success(t('users.management.messages.firmCreated'));
        markFirmViewsDirty();
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
  }, [fetchFirms, fetchUsers, firmsPage, firmsSearchTerm, selectedFirm, t]);

  const handleDeleteFirm = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      const deletedFirmId = deleteTarget.id;
      pendingFirmRef.current = null;
      const normalizedSearch = firmsSearchTerm.trim();
      deletedFirmIdsRef.current.add(deletedFirmId);
      setFirms((currentFirms) => currentFirms.filter((firm) => firm.id !== deletedFirmId));
      setFirmsTotalCount((currentTotal) => Math.max(0, currentTotal - 1));

      await userService.deleteCustomer(deletedFirmId);
      toast.success(t('users.management.messages.firmDeleted'));
      markFirmViewsDirty();
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
        search: firmsSearchTerm.trim(),
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
  }, [deleteTarget, fetchFirms, fetchUsers, firmsPage, firmsSearchTerm, t]);

  const stats = useMemo<UsersManagementStats>(
    () => buildUsersManagementStats(effectiveUsers, effectiveUsersTotalCount, effectiveFirmsTotalCount),
    [effectiveFirmsTotalCount, effectiveUsers, effectiveUsersTotalCount],
  );

  const refreshData = useCallback(async () => {
    const normalizedUsersSearch = usersSearchTerm.trim();
    const normalizedFirmsSearch = firmsSearchTerm.trim();
    const nextUsersPage = normalizedUsersSearch === debouncedUsersSearchTerm ? usersPage : 1;
    const nextFirmsPage = normalizedFirmsSearch === debouncedFirmsSearchTerm ? firmsPage : 1;

    usersRequestIdRef.current += 1;
    firmsRequestIdRef.current += 1;
    if (normalizedUsersSearch !== debouncedUsersSearchTerm || normalizedFirmsSearch !== debouncedFirmsSearchTerm) {
      startTransition(() => {
        if (normalizedUsersSearch !== debouncedUsersSearchTerm) {
          setUsersPage(1);
        }
        if (normalizedFirmsSearch !== debouncedFirmsSearchTerm) {
          setFirmsPage(1);
        }
      });
    }

    await fetchUsers({
      page: nextUsersPage,
      search: normalizedUsersSearch,
      clearOptimisticState: true,
      forceRefresh: true,
    });

    if (canManageFirms && (effectiveActiveTab === 'firms' || firms.length > 0)) {
      await fetchFirms({
        page: nextFirmsPage,
        search: normalizedFirmsSearch,
        clearOptimisticState: true,
        forceRefresh: true,
      });
    }
  }, [canManageFirms, debouncedFirmsSearchTerm, debouncedUsersSearchTerm, effectiveActiveTab, fetchFirms, fetchUsers, firms.length, firmsPage, firmsSearchTerm, usersPage, usersSearchTerm]);

  const searchTerm = effectiveActiveTab === 'users' ? usersSearchTerm : firmsSearchTerm;
  const setSearchTerm = useCallback((value: string) => {
    if (effectiveActiveTab === 'users') {
      setUsersSearchTerm(value);
      return;
    }
    setFirmsSearchTerm(value);
  }, [effectiveActiveTab]);

  const resetSearch = useCallback(() => {
    if (effectiveActiveTab === 'users') {
      setUsersSearchTerm('');
      return;
    }
    setFirmsSearchTerm('');
  }, [effectiveActiveTab]);

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
    firms: effectiveFirms,
    firmsPage,
    firmsTotalCount: effectiveFirmsTotalCount,
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
    resetSearch,
    searchTerm,
    selectedFirm,
    selectedUser,
    setActiveTab,
    setSearchTerm,
    stats,
    userModalOpen,
    users: effectiveUsers,
    usersPage,
    usersTotalCount: effectiveUsersTotalCount,
    usersTotalPages,
  };
}
