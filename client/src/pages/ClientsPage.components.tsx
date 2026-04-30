import {
  ArrowPathIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  EyeIcon,
  FolderIcon,
  CalendarDaysIcon,
  GlobeAltIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import type { Client, ClientType } from '../types/entities';
import Pagination from '../components/Pagination';
import PageHeader from '../components/page/PageHeader';
import ResponsivePageTabs from '../components/page/ResponsivePageTabs';
import SearchField from '../components/page/SearchField';
import ViewModeToggle from '../components/page/ViewModeToggle';
import { SkeletonClientList } from '../components/ui/Skeleton';
import type { CRMTab, ClientFilter, ClientsStats } from './ClientsPage.hooks';
import { CLIENTS_PAGE_SIZE } from './ClientsPage.hooks';

function getTypeColor(type: ClientType): string {
  return type === 'client'
    ? 'crm-client-type-badge crm-client-type-badge--client bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    : 'crm-client-type-badge crm-client-type-badge--prospect bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
}

export function CRMHeader() {
  const { t } = useTranslation();

  return <PageHeader title={t('crm.title')} subtitle={t('crm.subtitle')} />;
}

export function CRMMainTabs({
  crmTab,
  onClientsClick,
  onDealsClick,
  onInterviewsClick,
}: {
  crmTab: CRMTab;
  onClientsClick: () => void;
  onDealsClick: () => void;
  onInterviewsClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <ResponsivePageTabs
      label={t('crm.sections.title', 'Sections')}
      minItemWidthRem={9.5}
      onChange={(nextTab) => {
        if (nextTab === 'clients') onClientsClick();
        if (nextTab === 'deals') onDealsClick();
        if (nextTab === 'interviews') onInterviewsClick();
      }}
      options={[
        { value: 'clients', label: t('crm.tabs.clients'), icon: BuildingOfficeIcon },
        { value: 'deals', label: t('crm.tabs.deals'), icon: FolderIcon },
        { value: 'interviews', label: t('crm.tabs.interviews'), icon: CalendarDaysIcon },
      ]}
      value={crmTab}
    />
  );
}

export function CRMStatsCards({ stats }: { stats: ClientsStats }) {
  const { t } = useTranslation();

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="crm-stat-card lux-card flex items-center gap-3 rounded-[13px] p-3">
        <div className="crm-stat-icon crm-stat-icon--clients rounded-[9px] bg-green-100 p-2 dark:bg-green-900/30"><BuildingOfficeIcon className="h-5 w-5 text-green-600 dark:text-green-400" /></div>
        <div><div className="text-xs font-medium uppercase tracking-[0.07em] text-gray-500 dark:text-gray-400">{t('clients.stats.clients')}</div><div className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.totalClients}</div></div>
      </div>
      <div className="crm-stat-card lux-card flex items-center gap-3 rounded-[13px] p-3">
        <div className="crm-stat-icon crm-stat-icon--prospects rounded-[9px] bg-purple-100 p-2 dark:bg-purple-900/30"><BriefcaseIcon className="h-5 w-5 text-[#6246ea] dark:text-[#c9ccff]" /></div>
        <div><div className="text-xs font-medium uppercase tracking-[0.07em] text-gray-500 dark:text-gray-400">{t('clients.stats.prospects')}</div><div className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.totalProspects}</div></div>
      </div>
      <div className="crm-stat-card lux-card flex items-center gap-3 rounded-[13px] p-3">
        <div className="crm-stat-icon crm-stat-icon--contacts rounded-[9px] bg-purple-100 p-2 dark:bg-purple-900/30"><UserGroupIcon className="h-5 w-5 text-[#6246ea] dark:text-[#c9ccff]" /></div>
        <div><div className="text-xs font-medium uppercase tracking-[0.07em] text-gray-500 dark:text-gray-400">{t('clients.stats.contacts')}</div><div className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.totalContacts}</div></div>
      </div>
      <div className="crm-stat-card lux-card flex items-center gap-3 rounded-[13px] p-3">
        <div className="crm-stat-icon crm-stat-icon--submissions rounded-[9px] bg-orange-100 p-2 dark:bg-orange-900/30"><PaperAirplaneIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" /></div>
        <div><div className="text-xs font-medium uppercase tracking-[0.07em] text-gray-500 dark:text-gray-400">{t('clients.stats.submissions')}</div><div className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.totalSubmissions}</div></div>
      </div>
    </div>
  );
}

export function ClientsToolbar({
  activeTab,
  onCreateClient,
  onRefresh,
  onSearchTermChange,
  onSetActiveTab,
  searchTerm,
}: {
  activeTab: ClientFilter;
  onCreateClient: () => void;
  onRefresh: () => void;
  onSearchTermChange: (value: string) => void;
  onSetActiveTab: (value: ClientFilter) => void;
  searchTerm: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="section-shell mb-5 rounded-[13px]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--cv-outline)] p-3">
        <div className="min-w-0 flex-1">
          <ViewModeToggle
            className="crm-clients-type-toggle mb-0"
            label={t('clients.filters.type', 'Type')}
            onChange={onSetActiveTab}
            options={[
              { value: 'all', label: t('clients.tabs.all'), icon: UserGroupIcon },
              { value: 'client', label: t('clients.tabs.clients'), icon: BuildingOfficeIcon },
              { value: 'prospect', label: t('clients.tabs.prospects'), icon: BriefcaseIcon },
            ]}
            value={activeTab}
          />
        </div>
        <div className="crm-clients-toolbar-actions flex gap-2">
          <button
            onClick={onRefresh}
            className="app-button-secondary rounded-[9px] p-2.5"
            title={t('common.refresh')}
            aria-label={t('common.refresh')}
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button onClick={onCreateClient} className="app-button-primary flex items-center gap-2 rounded-[9px] px-4 py-2.5 text-sm"><PlusIcon className="h-4 w-4" />{t('clients.addClient')}</button>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-3">
          <SearchField
            containerClassName="relative flex-1"
            placeholder={t('clients.searchPlaceholder')}
            value={searchTerm}
            onChange={onSearchTermChange}
          />
          {searchTerm && <button onClick={() => onSearchTermChange('')} className="app-button-secondary inline-flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-sm font-medium" title={t('common.resetFilters')}><XMarkIcon className="h-4 w-4" /></button>}
        </div>
      </div>
    </div>
  );
}

export function ClientsResults({
  clients,
  loading,
  onDeleteClient,
  onEditClient,
  onOpenClientDetail,
}: {
  clients: Client[];
  loading: boolean;
  onDeleteClient: (client: Client) => void;
  onEditClient: (client: Client) => void;
  onOpenClientDetail: (client: Client) => void;
}) {
  const { t } = useTranslation();

  if (loading) {
    return <SkeletonClientList count={6} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
      {clients.length === 0 ? (
        <div className="section-shell col-span-full rounded-[13px] p-10 text-center">
          <BuildingOfficeIcon className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">{t('clients.noClients')}</p>
        </div>
      ) : (
        clients.map((client, index) => (
          <motion.div key={client.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="lux-card rounded-[13px] transition-all hover:-translate-y-0.5">
            <div className="p-3.5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-[9px] bg-gray-100 p-2 dark:bg-white/5"><BuildingOfficeIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" /></div>
                  <div>
                    <h3 className="font-semibold text-gray-950 dark:text-gray-100">{client.name}</h3>
                    {client.industry && <p className="text-sm text-gray-500 dark:text-gray-400">{client.industry}</p>}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getTypeColor(client.type)}`}>{t(`clients.types.${client.type}`)}</span>
              </div>
              <div className="space-y-2 mb-4">
                {client.website && <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><GlobeAltIcon className="w-4 h-4" /><a href={client.website} target="_blank" rel="noopener noreferrer" className="truncate hover:text-[#6246ea] dark:hover:text-[#c9ccff]">{client.website}</a></div>}
                {client.address && <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><MapPinIcon className="w-4 h-4 flex-shrink-0" /><span className="truncate">{client.address}</span></div>}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
                <div className="flex items-center gap-1"><UserGroupIcon className="w-4 h-4" /><span>{client.contacts_count || 0} {t('clients.contactsLabel')}</span></div>
                <div className="flex items-center gap-1"><PaperAirplaneIcon className="w-4 h-4" /><span>{client.submissions_count || 0} {t('clients.submissionsLabel')}</span></div>
              </div>
              <div className="flex items-center gap-1 mb-4"><BuildingOfficeIcon className="w-3 h-3 text-gray-400" /><span className="text-xs text-gray-400 dark:text-gray-500">{client.firm_name || t('clients.noFirm')}</span></div>
              <div className="flex items-center gap-2 border-t border-[#e4e4e7] pt-3 dark:border-white/10">
                <button onClick={() => onOpenClientDetail(client)} className="app-button-primary flex flex-1 items-center justify-center gap-1 rounded-[9px] px-3 py-2 text-sm"><EyeIcon className="w-4 h-4" />{t('common.view')}</button>
                <button onClick={() => onEditClient(client)} className="app-button-secondary flex flex-1 items-center justify-center gap-1 rounded-[9px] px-3 py-2 text-sm"><PencilSquareIcon className="w-4 h-4" />{t('common.edit')}</button>
                <button
                  onClick={() => onDeleteClient(client)}
                  disabled={(client.submissions_count || 0) > 0}
                  className={`p-2 rounded-lg transition-colors ${(client.submissions_count || 0) > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30'}`}
                  title={(client.submissions_count || 0) > 0 ? t('clients.messages.cannotDeleteWithSubmissions') : t('common.delete')}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}

export function ClientsPagination({ currentPage, loading, onPageChange, totalCount, totalPages }: { currentPage: number; loading: boolean; onPageChange: (page: number) => void; totalCount: number; totalPages: number }) {
  const { t } = useTranslation();
  return <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} pageSize={CLIENTS_PAGE_SIZE} onPageChange={onPageChange} loading={loading} itemName={t('clients.results')} />;
}
