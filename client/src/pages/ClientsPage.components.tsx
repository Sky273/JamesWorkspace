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
import SearchField from '../components/page/SearchField';
import { SkeletonClientList } from '../components/ui/Skeleton';
import type { CRMTab, ClientFilter, ClientsStats } from './ClientsPage.hooks';
import { CLIENTS_PAGE_SIZE } from './ClientsPage.hooks';

function getTypeColor(type: ClientType): string {
  return type === 'client'
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
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
    <div className="app-tab-strip mb-6">
      <button onClick={onClientsClick} className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${crmTab === 'clients' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
        <BuildingOfficeIcon className="w-5 h-5" />
        {t('crm.tabs.clients')}
      </button>
      <button onClick={onDealsClick} className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${crmTab === 'deals' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
        <FolderIcon className="w-5 h-5" />
        {t('crm.tabs.deals')}
      </button>
      <button onClick={onInterviewsClick} className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${crmTab === 'interviews' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
        <CalendarDaysIcon className="w-5 h-5" />
        {t('crm.tabs.interviews')}
      </button>
    </div>
  );
}

export function CRMStatsCards({ stats }: { stats: ClientsStats }) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">
      <div className="lux-card flex items-center gap-3 rounded-[1.75rem] p-4">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg"><BuildingOfficeIcon className="w-6 h-6 text-green-600 dark:text-green-400" /></div>
        <div><div className="text-sm text-gray-600 dark:text-gray-400">{t('clients.stats.clients')}</div><div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalClients}</div></div>
      </div>
      <div className="lux-card flex items-center gap-3 rounded-[1.75rem] p-4">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><BriefcaseIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" /></div>
        <div><div className="text-sm text-gray-600 dark:text-gray-400">{t('clients.stats.prospects')}</div><div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalProspects}</div></div>
      </div>
      <div className="lux-card flex items-center gap-3 rounded-[1.75rem] p-4">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg"><UserGroupIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" /></div>
        <div><div className="text-sm text-gray-600 dark:text-gray-400">{t('clients.stats.contacts')}</div><div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalContacts}</div></div>
      </div>
      <div className="lux-card flex items-center gap-3 rounded-[1.75rem] p-4">
        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg"><PaperAirplaneIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" /></div>
        <div><div className="text-sm text-gray-600 dark:text-gray-400">{t('clients.stats.submissions')}</div><div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalSubmissions}</div></div>
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
    <div className="section-shell mb-6 rounded-[2rem]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--cv-outline)] p-4">
        <div className="flex items-center gap-2">
          <button onClick={() => onSetActiveTab('all')} className={`app-tab-button ${activeTab === 'all' ? 'app-tab-button-active' : ''}`}>{t('clients.tabs.all')}</button>
          <button onClick={() => onSetActiveTab('client')} className={`app-tab-button ${activeTab === 'client' ? 'app-tab-button-active' : ''}`}><BuildingOfficeIcon className="w-5 h-5" />{t('clients.tabs.clients')}</button>
          <button onClick={() => onSetActiveTab('prospect')} className={`app-tab-button ${activeTab === 'prospect' ? 'app-tab-button-active' : ''}`}><BriefcaseIcon className="w-5 h-5" />{t('clients.tabs.prospects')}</button>
        </div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="app-button-secondary rounded-2xl p-2.5" title={t('common.refresh')}><ArrowPathIcon className="w-5 h-5" /></button>
          <button onClick={onCreateClient} className="app-button-primary flex items-center gap-2 rounded-2xl px-4 py-2.5"><PlusIcon className="w-5 h-5" />{t('clients.addClient')}</button>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <SearchField
            containerClassName="relative flex-1"
            placeholder={t('clients.searchPlaceholder')}
            value={searchTerm}
            onChange={onSearchTermChange}
          />
          {searchTerm && <button onClick={() => onSearchTermChange('')} className="app-button-secondary inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-medium" title={t('common.resetFilters')}><XMarkIcon className="w-4 h-4" /></button>}
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
        <div className="section-shell col-span-full rounded-[2rem] p-12 text-center">
          <BuildingOfficeIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{t('clients.noClients')}</p>
        </div>
      ) : (
        clients.map((client, index) => (
          <motion.div key={client.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="lux-card rounded-[1.75rem] transition-all hover:-translate-y-0.5">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg"><BuildingOfficeIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" /></div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{client.name}</h3>
                    {client.industry && <p className="text-sm text-gray-500 dark:text-gray-400">{client.industry}</p>}
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(client.type)}`}>{t(`clients.types.${client.type}`)}</span>
              </div>
              <div className="space-y-2 mb-4">
                {client.website && <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><GlobeAltIcon className="w-4 h-4" /><a href={client.website} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 truncate">{client.website}</a></div>}
                {client.address && <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><MapPinIcon className="w-4 h-4 flex-shrink-0" /><span className="truncate">{client.address}</span></div>}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
                <div className="flex items-center gap-1"><UserGroupIcon className="w-4 h-4" /><span>{client.contacts_count || 0} {t('clients.contactsLabel')}</span></div>
                <div className="flex items-center gap-1"><PaperAirplaneIcon className="w-4 h-4" /><span>{client.submissions_count || 0} {t('clients.submissionsLabel')}</span></div>
              </div>
              <div className="flex items-center gap-1 mb-4"><BuildingOfficeIcon className="w-3 h-3 text-gray-400" /><span className="text-xs text-gray-400 dark:text-gray-500">{client.firm_name || t('clients.noFirm')}</span></div>
              <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button onClick={() => onOpenClientDetail(client)} className="app-button-primary flex flex-1 items-center justify-center gap-1 rounded-2xl px-3 py-2 text-sm"><EyeIcon className="w-4 h-4" />{t('common.view')}</button>
                <button onClick={() => onEditClient(client)} className="app-button-secondary flex flex-1 items-center justify-center gap-1 rounded-2xl px-3 py-2 text-sm"><PencilSquareIcon className="w-4 h-4" />{t('common.edit')}</button>
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
