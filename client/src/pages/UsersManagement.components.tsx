import {
  ArrowPathIcon,
  BuildingOfficeIcon,
  KeyIcon,
  PencilSquareIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import CardActionButton from '../components/page/CardActionButton';
import AnimatedCard from '../components/page/AnimatedCard';
import EmptyStateCard from '../components/page/EmptyStateCard';
import PageHeader from '../components/page/PageHeader';
import PaginationPair from '../components/page/PaginationPair';
import SearchField from '../components/page/SearchField';
import StatCardsGrid from '../components/page/StatCardsGrid';
import { SkeletonUsersTable } from '../components/ui/Skeleton';
import type { Firm, User, UsersManagementStats, UsersManagementTab } from './UsersManagement.hooks';
import { USERS_PAGE_SIZE } from './UsersManagement.hooks';

function getRoleBadge(role: string | undefined, t: (key: string) => string) {
  const isAdmin = role === 'admin';
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
}

function getStatusBadge(status: string | undefined, t: (key: string) => string) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  };

  return <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status || ''] || colors.pending}`}>{t(`users.management.status.${status}`) || status}</span>;
}

export function UsersManagementLoadingState() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6" />
      <SkeletonUsersTable rows={8} />
    </div>
  );
}

export function UsersManagementHeader() {
  const { t } = useTranslation();

  return <PageHeader title={t('users.management.title')} subtitle={t('users.management.subtitle')} />;
}

export function UsersManagementStatsCards({ stats }: { stats: UsersManagementStats }) {
  const { t } = useTranslation();

  return (
    <StatCardsGrid
      className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
      items={[
        {
          icon: UsersIcon,
          iconBgClassName: 'bg-blue-100 dark:bg-blue-900/30',
          iconClassName: 'text-blue-600 dark:text-blue-400',
          label: t('users.management.stats.totalUsers'),
          value: stats.totalUsers,
        },
        {
          icon: BuildingOfficeIcon,
          iconBgClassName: 'bg-green-100 dark:bg-green-900/30',
          iconClassName: 'text-green-600 dark:text-green-400',
          label: t('users.management.stats.totalFirms'),
          value: stats.totalFirms,
        },
        {
          icon: UserIcon,
          iconBgClassName: 'bg-emerald-100 dark:bg-emerald-900/30',
          iconClassName: 'text-emerald-600 dark:text-emerald-400',
          label: t('users.management.stats.activeUsers'),
          value: stats.activeUsers,
        },
        {
          icon: ShieldCheckIcon,
          iconBgClassName: 'bg-purple-100 dark:bg-purple-900/30',
          iconClassName: 'text-purple-600 dark:text-purple-400',
          label: t('users.management.stats.admins'),
          value: stats.admins,
        },
      ]}
    />
  );
}

export function UsersManagementToolbar({
  activeTab,
  firmsCount,
  onCreate,
  onRefresh,
  onResetSearch,
  onSearchChange,
  onTabChange,
  searchTerm,
  usersCount,
}: {
  activeTab: UsersManagementTab;
  firmsCount: number;
  onCreate: () => void;
  onRefresh: () => Promise<void>;
  onResetSearch: () => void;
  onSearchChange: (value: string) => void;
  onTabChange: (tab: UsersManagementTab) => void;
  searchTerm: string;
  usersCount: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-4 mb-4 md:mb-0">
          <button onClick={() => onTabChange('users')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'users' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}><UsersIcon className="w-5 h-5" />{t('users.management.tabs.users')} ({usersCount})</button>
          <button onClick={() => onTabChange('firms')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'firms' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}><BuildingOfficeIcon className="w-5 h-5" />{t('users.management.tabs.firms')} ({firmsCount})</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void onRefresh()} className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title={t('users.management.refresh')}><ArrowPathIcon className="w-5 h-5" /></button>
          <button onClick={onCreate} className="btn btn-primary flex items-center gap-2 px-4 py-2"><PlusIcon className="w-5 h-5" />{activeTab === 'users' ? t('users.management.addUser') : t('users.management.addFirm')}</button>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <SearchField containerClassName="relative flex-1" value={searchTerm} onChange={onSearchChange} placeholder={activeTab === 'users' ? t('users.management.searchUsers') : t('users.management.searchFirms')} />
          {searchTerm ? <button onClick={onResetSearch} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title={t('common.resetFilters')}><XMarkIcon className="w-4 h-4" /><span className="hidden sm:inline">{t('common.resetFilters')}</span></button> : null}
        </div>
      </div>
    </div>
  );
}

export function UsersResults({
  currentPage,
  loading,
  onDelete,
  onEdit,
  onPageChange,
  onPassword,
  totalCount,
  totalPages,
  users,
}: {
  currentPage: number;
  loading: boolean;
  onDelete: (user: User) => void;
  onEdit: (user: User) => void;
  onPageChange: (page: number) => void;
  onPassword: (user: User) => void;
  totalCount: number;
  totalPages: number;
  users: User[];
}) {
  const { t } = useTranslation();

  return (
    <>
      <PaginationPair
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={USERS_PAGE_SIZE}
        onPageChange={onPageChange}
        loading={loading}
        itemName={t('users.management.results')}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.length === 0 ? (
          <div className="col-span-full"><EmptyStateCard icon={UsersIcon} description={t('users.management.noUsers')} /></div>
        ) : users.map((user, index) => (
          <AnimatedCard key={user.id} index={index} className="shadow">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center"><span className="text-blue-600 dark:text-blue-400 font-semibold">{user.name?.charAt(0)?.toUpperCase() || '?'}</span></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-gray-100">{user.name}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p></div>
                </div>
                {getStatusBadge(user.status, t)}
              </div>
              <div className="flex items-center gap-2 mb-3">
                {getRoleBadge(user.role, t)}
                {(user.firmName || user.firm) ? <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">{user.firmName || user.firm}</span> : null}
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <CardActionButton icon={PencilSquareIcon} label={t('users.management.actions.edit')} onClick={() => onEdit(user)} className="btn btn-primary flex-1 px-3 py-2" tone="primary" />
                <CardActionButton icon={KeyIcon} onClick={() => onPassword(user)} title={t('users.management.actions.resetPassword')} tone="info" />
                <CardActionButton icon={TrashIcon} onClick={() => onDelete(user)} title={t('users.management.actions.delete')} tone="danger" />
              </div>
            </div>
          </AnimatedCard>
        ))}
      </div>
    </>
  );
}

export function FirmsResults({
  currentPage,
  firms,
  loading,
  onDelete,
  onEdit,
  onPageChange,
  totalCount,
  totalPages,
  users,
}: {
  currentPage: number;
  firms: Firm[];
  loading: boolean;
  onDelete: (firm: Firm) => void;
  onEdit: (firm: Firm) => void;
  onPageChange: (page: number) => void;
  totalCount: number;
  totalPages: number;
  users: User[];
}) {
  const { t } = useTranslation();

  return (
    <>
      <PaginationPair
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={USERS_PAGE_SIZE}
        onPageChange={onPageChange}
        loading={loading}
        itemName={t('users.management.firmsResults')}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {firms.length === 0 ? (
          <div className="col-span-full"><EmptyStateCard icon={BuildingOfficeIcon} description={t('users.management.noFirms')} /></div>
        ) : firms.map((firm, index) => {
          const associatedUsers = users.filter((user) => user.firmId === firm.id);
          return (
            <AnimatedCard key={firm.id} index={index} className="shadow">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"><BuildingOfficeIcon className="w-5 h-5 text-green-600 dark:text-green-400" /></div>
                    <div><h3 className="font-semibold text-gray-900 dark:text-gray-100">{firm.name}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{associatedUsers.length} {t('users.management.tabs.users').toLowerCase()}</p></div>
                  </div>
                </div>
                {associatedUsers.length > 0 ? (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-1">
                      {associatedUsers.slice(0, 3).map((user) => <span key={user.id} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">{user.name}</span>)}
                      {associatedUsers.length > 3 ? <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">+{associatedUsers.length - 3}</span> : null}
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <CardActionButton icon={PencilSquareIcon} label={t('users.management.actions.edit')} onClick={() => onEdit(firm)} className="btn btn-primary flex-1 px-3 py-2" tone="primary" />
                  <CardActionButton
                    icon={TrashIcon}
                    onClick={() => onDelete(firm)}
                    tone={associatedUsers.length > 0 ? 'secondary' : 'danger'}
                    className={associatedUsers.length > 0 ? 'text-gray-400 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent' : ''}
                    title={t('users.management.actions.delete')}
                  />
                </div>
              </div>
            </AnimatedCard>
          );
        })}
      </div>
    </>
  );
}
