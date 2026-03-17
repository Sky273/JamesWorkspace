/**
 * UsersManagement Page
 * TypeScript version
 */

import { useState, useEffect, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import userService from '../utils/userService';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import logger from '../utils/logger.frontend';
import {
  UsersIcon,
  BuildingOfficeIcon,
  PencilSquareIcon,
  TrashIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  UserIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

import {
  UserFormModal,
  FirmFormModal,
  PasswordModal,
  ConfirmDeleteModal
} from '../components/UsersManagement';
import Pagination from '../components/Pagination';
import { SkeletonUsersTable } from '../components/ui/Skeleton';
import Breadcrumbs from '../components/Breadcrumbs';

interface User {
  id: string;
  name?: string;
  email?: string;
  firm?: string;
  role?: string;
  status?: string;
}

interface Firm {
  id: string;
  name: string;
}

interface DeleteTarget {
  id: string;
  name?: string;
  type: 'user' | 'firm';
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  jobTitle: string;
  phone: string;
  firm: string;
  role: string;
  status: string;
}

interface FirmFormData {
  name: string;
}

interface Stats {
  totalUsers: number;
  totalFirms: number;
  activeUsers: number;
  admins: number;
}

const UsersManagement = (): JSX.Element => {
  const { t } = useTranslation();
  const [firms, setFirms] = useState<Firm[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'users' | 'firms'>('users');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  
  // Server-side pagination state for users
  const [usersPage, setUsersPage] = useState<number>(1);
  const [usersTotalCount, setUsersTotalCount] = useState<number>(0);
  const [, setUsersHasMore] = useState<boolean>(false);
  
  // Server-side pagination state for firms
  const [firmsPage, setFirmsPage] = useState<number>(1);
  const [firmsTotalCount, setFirmsTotalCount] = useState<number>(0);
  const [, setFirmsHasMore] = useState<boolean>(false);
  
  const pageSize = 12;
  
  const [userModalOpen, setUserModalOpen] = useState<boolean>(false);
  const [firmModalOpen, setFirmModalOpen] = useState<boolean>(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState<boolean>(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setUsersPage(1);
      setFirmsPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchData = async (): Promise<void> => {
    try {
      setLoading(true);
      const [customerData, userData] = await Promise.all([
        userService.getCustomersPaginated({ page: firmsPage, pageSize, search: debouncedSearch }),
        userService.getUsersPaginated({ page: usersPage, pageSize, search: debouncedSearch })
      ]);
      
      // Handle paginated customers response
      if (customerData.customers) {
        setFirms(customerData.customers);
        setFirmsTotalCount(customerData.pagination?.totalCount || customerData.customers.length);
        setFirmsHasMore(customerData.pagination?.hasMore || false);
      } else {
        setFirms(Array.isArray(customerData) ? customerData : []);
        setFirmsTotalCount(Array.isArray(customerData) ? customerData.length : 0);
      }
      
      // Handle paginated users response
      if (userData.users) {
        setUsers(userData.users);
        setUsersTotalCount(userData.pagination?.totalCount || userData.users.length);
        setUsersHasMore(userData.pagination?.hasMore || false);
      } else {
        setUsers(Array.isArray(userData) ? userData : []);
        setUsersTotalCount(Array.isArray(userData) ? userData.length : 0);
      }
    } catch (err) {
      logger.error('Error loading data:', err);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersPage, firmsPage, debouncedSearch]);

  // Calculate total pages
  const usersTotalPages = Math.ceil(usersTotalCount / pageSize);
  const firmsTotalPages = Math.ceil(firmsTotalCount / pageSize);

  // Pagination handlers
  const goToUsersPage = (page: number) => {
    if (page >= 1 && page <= usersTotalPages) setUsersPage(page);
  };
  const goToFirmsPage = (page: number) => {
    if (page >= 1 && page <= firmsTotalPages) setFirmsPage(page);
  };

  const handleUserSubmit = async (formData: UserFormData): Promise<void> => {
    try {
      const capitalizedRole = formData.role.charAt(0).toUpperCase() + formData.role.slice(1).toLowerCase();
      
      if (selectedUser) {
        await userService.updateUser(selectedUser.id, {
          name: formData.name,
          email: formData.email.toLowerCase(),
          jobTitle: formData.jobTitle || '',
          phone: formData.phone || '',
          firm: formData.firm || undefined,
          role: capitalizedRole,
          status: formData.status
        });
        toast.success(t('users.management.messages.userUpdated'));
      } else {
        await userService.createUser({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          jobTitle: formData.jobTitle || '',
          phone: formData.phone || '',
          firm: formData.firm,
          role: capitalizedRole,
          status: formData.status
        });
        toast.success(t('users.management.messages.userCreated'));
      }
      setUserModalOpen(false);
      setSelectedUser(null);
      await fetchData();
    } catch (error) {
      logger.error('Error saving user:', error);
      toast.error(selectedUser ? t('users.management.messages.errorUpdatingUser') : t('users.management.messages.errorCreatingUser'));
    }
  };

  const handleDeleteUser = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await userService.deleteUser(deleteTarget.id);
      toast.success(t('users.management.messages.userDeleted'));
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      await fetchData();
    } catch (error) {
      logger.error('Error deleting user:', error);
      toast.error(t('users.management.messages.errorDeletingUser'));
    }
  };

  const handlePasswordChange = async (newPassword: string): Promise<void> => {
    if (!selectedUser) return;
    try {
      await userService.changeUserPassword(selectedUser.id, newPassword);
      toast.success(t('users.management.messages.passwordChanged'));
      setPasswordModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      logger.error('Error changing password:', error);
      toast.error(t('users.management.messages.errorChangingPassword'));
    }
  };

  const handleFirmSubmit = async (formData: FirmFormData): Promise<void> => {
    try {
      if (selectedFirm) {
        await userService.updateCustomer(selectedFirm.id, { Name: formData.name });
        toast.success(t('users.management.messages.firmUpdated'));
      } else {
        await userService.createCustomer({ Name: formData.name });
        toast.success(t('users.management.messages.firmCreated'));
      }
      setFirmModalOpen(false);
      setSelectedFirm(null);
      await fetchData();
    } catch (error) {
      logger.error('Error saving customer:', error);
      toast.error(selectedFirm ? t('users.management.messages.errorUpdatingFirm') : t('users.management.messages.errorCreatingFirm'));
    }
  };

  const handleDeleteFirm = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await userService.deleteCustomer(deleteTarget.id);
      toast.success(t('users.management.messages.firmDeleted'));
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      await fetchData();
    } catch (error: unknown) {
      logger.error('Error deleting customer:', error);
      if (error instanceof Error && error.message.includes('associated users')) {
        toast.error(t('users.management.messages.cannotDeleteFirmWithUsers'));
      } else {
        toast.error(t('users.management.messages.errorDeletingFirm'));
      }
    }
  };

  // No client-side filtering needed - server handles it
  const filteredUsers = users;
  const filteredFirms = firms;

  const stats: Stats = {
    totalUsers: usersTotalCount,
    totalFirms: firmsTotalCount,
    activeUsers: users.filter(u => u.status?.toLowerCase() === 'active').length,
    admins: users.filter(u => u.role?.toLowerCase() === 'admin').length
  };

  const getRoleBadge = (role?: string): JSX.Element => {
    const isAdmin = role?.toLowerCase() === 'admin';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
        isAdmin 
          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' 
          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      }`}>
        {isAdmin ? <ShieldCheckIcon className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
        {isAdmin ? t('users.management.roles.admin') : t('users.management.roles.user')}
      </span>
    );
  };

  const getStatusBadge = (status?: string): JSX.Element => {
    // Normalize status to handle both lowercase (from DB) and capitalized versions
    const normalizedStatus = status?.toLowerCase();
    const colors: Record<string, string> = {
      'active': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'inactive': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      'pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[normalizedStatus || ''] || colors['pending']}`}>
        {t(`users.management.status.${normalizedStatus}`) || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6" />
        <SkeletonUsersTable rows={8} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-6 max-w-7xl mx-auto"
    >
      <Breadcrumbs className="mb-4" />
      
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-8 rounded-full bg-primary-500" />
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
            {t('users.management.title')}
          </h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">
          {t('users.management.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <UsersIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('users.management.stats.totalUsers')}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalUsers}</div>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <BuildingOfficeIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('users.management.stats.totalFirms')}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalFirms}</div>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <UserIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('users.management.stats.activeUsers')}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.activeUsers}</div>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <ShieldCheckIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('users.management.stats.admins')}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.admins}</div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4 mb-4 md:mb-0">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'users'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <UsersIcon className="w-5 h-5" />
              {t('users.management.tabs.users')} ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('firms')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'firms'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <BuildingOfficeIcon className="w-5 h-5" />
              {t('users.management.tabs.firms')} ({firms.length})
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={t('users.management.refresh')}
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                if (activeTab === 'users') {
                  setSelectedUser(null);
                  setUserModalOpen(true);
                } else {
                  setSelectedFirm(null);
                  setFirmModalOpen(true);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              {activeTab === 'users' ? t('users.management.addUser') : t('users.management.addFirm')}
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={activeTab === 'users' ? t('users.management.searchUsers') : t('users.management.searchFirms')}
                value={searchTerm}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title={t('common.resetFilters')}
              >
                <XMarkIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{t('common.resetFilters')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top pagination for users */}
      {activeTab === 'users' && (
        <Pagination
          currentPage={usersPage}
          totalPages={usersTotalPages}
          totalCount={usersTotalCount}
          pageSize={pageSize}
          onPageChange={goToUsersPage}
          loading={loading}
          itemName={t('users.management.results')}
        />
      )}

      {/* Top pagination for customers */}
      {activeTab === 'firms' && (
        <Pagination
          currentPage={firmsPage}
          totalPages={firmsTotalPages}
          totalCount={firmsTotalCount}
          pageSize={pageSize}
          onPageChange={goToFirmsPage}
          loading={loading}
          itemName={t('users.management.firmsResults')}
        />
      )}

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <UsersIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">{t('users.management.noUsers')}</p>
            </div>
          ) : (
            filteredUsers.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">
                          {user.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{user.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                    </div>
                    {getStatusBadge(user.status)}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    {getRoleBadge(user.role)}
                    {user.firm && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        {user.firm}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => { setSelectedUser(user); setUserModalOpen(true); }}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                      {t('users.management.actions.edit')}
                    </button>
                    <button
                      onClick={() => { setSelectedUser(user); setPasswordModalOpen(true); }}
                      className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    >
                      <KeyIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setDeleteTarget({ ...user, type: 'user' } as DeleteTarget); setDeleteModalOpen(true); }}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Users pagination */}
      {activeTab === 'users' && (
        <Pagination
          currentPage={usersPage}
          totalPages={usersTotalPages}
          totalCount={usersTotalCount}
          pageSize={pageSize}
          onPageChange={goToUsersPage}
          loading={loading}
          itemName={t('users.management.results')}
        />
      )}

      {activeTab === 'firms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFirms.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <BuildingOfficeIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">{t('users.management.noFirms')}</p>
            </div>
          ) : (
            filteredFirms.map((customer, index) => {
              const associatedUsers = users.filter(u => u.firm === customer.name);
              return (
                <motion.div
                  key={customer.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                          <BuildingOfficeIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{customer.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {associatedUsers.length} {t('users.management.tabs.users').toLowerCase()}
                          </p>
                        </div>
                      </div>
                    </div>
                    {associatedUsers.length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-1">
                          {associatedUsers.slice(0, 3).map(u => (
                            <span key={u.id} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                              {u.name}
                            </span>
                          ))}
                          {associatedUsers.length > 3 && (
                            <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                              +{associatedUsers.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => { setSelectedFirm(customer); setFirmModalOpen(true); }}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                        {t('users.management.actions.edit')}
                      </button>
                      <button
                        onClick={() => { setDeleteTarget({ ...customer, type: 'firm' } as DeleteTarget); setDeleteModalOpen(true); }}
                        className={`p-2 rounded-lg transition-colors ${
                          associatedUsers.length > 0
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                        }`}
                        disabled={associatedUsers.length > 0}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Customers pagination */}
      {activeTab === 'firms' && (
        <Pagination
          currentPage={firmsPage}
          totalPages={firmsTotalPages}
          totalCount={firmsTotalCount}
          pageSize={pageSize}
          onPageChange={goToFirmsPage}
          loading={loading}
          itemName={t('users.management.firmsResults')}
        />
      )}

      <UserFormModal
        isOpen={userModalOpen}
        onClose={() => { setUserModalOpen(false); setSelectedUser(null); }}
        onSubmit={handleUserSubmit}
        user={selectedUser}
        firms={firms}
        t={t}
      />
      <FirmFormModal
        isOpen={firmModalOpen}
        onClose={() => { setFirmModalOpen(false); setSelectedFirm(null); }}
        onSubmit={handleFirmSubmit}
        firm={selectedFirm}
        t={t}
      />
      <PasswordModal
        isOpen={passwordModalOpen}
        onClose={() => { setPasswordModalOpen(false); setSelectedUser(null); }}
        onSubmit={handlePasswordChange}
        userName={selectedUser?.name || ''}
        t={t}
      />
      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeleteTarget(null); }}
        onConfirm={deleteTarget?.type === 'user' ? handleDeleteUser : handleDeleteFirm}
        message={deleteTarget?.type === 'user' 
          ? t('users.management.messages.confirmDeleteUser', { name: deleteTarget?.name })
          : t('users.management.messages.confirmDeleteFirm', { name: deleteTarget?.name })
        }
        t={t}
      />
    </motion.div>
  );
};

export default UsersManagement;
