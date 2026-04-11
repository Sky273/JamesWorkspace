import {
  ArrowPathIcon,
  BuildingOfficeIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import PageHeader from '../components/page/PageHeader';
import PaginationPair from '../components/page/PaginationPair';
import SearchField from '../components/page/SearchField';
import StatCardsGrid from '../components/page/StatCardsGrid';
import { SkeletonUsersTable } from '../components/ui/Skeleton';
import type { Firm, User, UsersManagementStats, UsersManagementTab } from './UsersManagement.hooks';
import { USERS_PAGE_SIZE } from './UsersManagement.hooks';
import { FirmsResultsGrid, UsersResultsGrid } from './UsersManagement.sections';

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

export function UsersManagementStatsCards({ stats, showFirmsStats = true }: { stats: UsersManagementStats; showFirmsStats?: boolean }) {
  const { t } = useTranslation();

  const items = [
    {
      icon: UsersIcon,
      iconBgClassName: 'bg-blue-100 dark:bg-blue-900/30',
      iconClassName: 'text-blue-600 dark:text-blue-400',
      label: t('users.management.stats.totalUsers'),
      value: stats.totalUsers,
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
  ];

  if (showFirmsStats) {
    items.splice(1, 0, {
      icon: BuildingOfficeIcon,
      iconBgClassName: 'bg-green-100 dark:bg-green-900/30',
      iconClassName: 'text-green-600 dark:text-green-400',
      label: t('users.management.stats.totalFirms'),
      value: stats.totalFirms,
    });
  }

  return (
    <StatCardsGrid
      className={`grid grid-cols-1 ${showFirmsStats ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 mb-6`}
      items={items}
    />
  );
}

export function UsersManagementToolbar({
  activeTab,
  canManageFirms,
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
  canManageFirms: boolean;
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
    <div className="section-shell mb-6 rounded-[2rem]">
      <div className="flex flex-col border-b border-[var(--cv-outline)] p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4 mb-4 md:mb-0">
          <button onClick={() => onTabChange('users')} className={`app-tab-button ${activeTab === 'users' ? 'app-tab-button-active' : ''}`}><UsersIcon className="w-5 h-5" />{t('users.management.tabs.users')} ({usersCount})</button>
          {canManageFirms ? <button onClick={() => onTabChange('firms')} className={`app-tab-button ${activeTab === 'firms' ? 'app-tab-button-active' : ''}`}><BuildingOfficeIcon className="w-5 h-5" />{t('users.management.tabs.firms')} ({firmsCount})</button> : null}
        </div>
        <div className="flex gap-2">
          <button onClick={() => void onRefresh()} className="app-button-secondary rounded-2xl p-2.5" title={t('users.management.refresh')}><ArrowPathIcon className="w-5 h-5" /></button>
          <button onClick={onCreate} className="app-button-primary flex items-center gap-2 rounded-2xl px-4 py-2.5"><PlusIcon className="w-5 h-5" />{activeTab === 'users' ? t('users.management.addUser') : t('users.management.addFirm')}</button>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <SearchField containerClassName="relative flex-1" value={searchTerm} onChange={onSearchChange} placeholder={activeTab === 'users' ? t('users.management.searchUsers') : t('users.management.searchFirms')} />
          {searchTerm ? <button onClick={onResetSearch} className="app-button-secondary inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-medium" title={t('common.resetFilters')}><XMarkIcon className="w-4 h-4" /><span className="hidden sm:inline">{t('common.resetFilters')}</span></button> : null}
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
        <UsersResultsGrid users={users} onDelete={onDelete} onEdit={onEdit} onPassword={onPassword} />
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
        <FirmsResultsGrid firms={firms} users={users} onDelete={onDelete} onEdit={onEdit} />
      </div>
    </>
  );
}
