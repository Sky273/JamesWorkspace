/**
 * ClientsPage - Manage clients and prospects
 * TypeScript version
 */

import { useState, useEffect, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import clientService from '../utils/clientService';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import logger from '../utils/logger.frontend';
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon,
  GlobeAltIcon,
  MapPinIcon,
  BriefcaseIcon,
  PaperAirplaneIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

import {
  ClientFormModal,
  ContactFormModal,
  ClientDetailModal,
  ConfirmDeleteModal
} from '../components/ClientsPage';
import Pagination from '../components/Pagination';
import { Client, ClientContact, ClientType } from '../types/entities';
import { SkeletonClientList } from '../components/ui/Skeleton';
import Breadcrumbs from '../components/Breadcrumbs';

interface Stats {
  totalClients: number;
  totalProspects: number;
  totalContacts: number;
  totalSubmissions: number;
}

interface DeleteTarget {
  id: string;
  name?: string;
  type: 'client' | 'contact';
  clientId?: string;
}

const ClientsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'client' | 'prospect'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  
  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const pageSize = 12;
  
  // Modal states
  const [clientModalOpen, setClientModalOpen] = useState<boolean>(false);
  const [contactModalOpen, setContactModalOpen] = useState<boolean>(false);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedContact, setSelectedContact] = useState<ClientContact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch data
  const fetchData = async (): Promise<void> => {
    try {
      setLoading(true);
      const typeFilter = activeTab === 'all' ? '' : activeTab;
      const result = await clientService.getClients({
        page,
        pageSize,
        search: debouncedSearch,
        type: typeFilter
      });
      
      setClients(result.clients);
      setTotalCount(result.pagination?.totalCount || result.clients.length);
      setHasMore(result.pagination?.hasMore || false);
    } catch (error) {
      logger.error('Error fetching clients:', error);
      toast.error(t('clients.messages.errorFetching'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, debouncedSearch, activeTab]);

  // Calculate stats - ensure numeric addition (API may return strings)
  const stats: Stats = {
    totalClients: clients.filter(c => c.type === 'client').length,
    totalProspects: clients.filter(c => c.type === 'prospect').length,
    totalContacts: clients.reduce((sum, c) => sum + Number(c.contacts_count || 0), 0),
    totalSubmissions: clients.reduce((sum, c) => sum + Number(c.submissions_count || 0), 0)
  };

  // Pagination
  const totalPages = Math.ceil(totalCount / pageSize);
  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
  };

  // Handlers
  const handleClientSubmit = async (formData: Partial<Client>): Promise<void> => {
    try {
      if (selectedClient) {
        await clientService.updateClient(selectedClient.id, formData);
        toast.success(t('clients.messages.clientUpdated'));
      } else {
        await clientService.createClient(formData);
        toast.success(t('clients.messages.clientCreated'));
      }
      setClientModalOpen(false);
      setSelectedClient(null);
      await fetchData();
    } catch (error) {
      logger.error('Error saving client:', error);
      toast.error(selectedClient 
        ? t('clients.messages.errorUpdatingClient') 
        : t('clients.messages.errorCreatingClient'));
    }
  };

  const handleContactSubmit = async (formData: Partial<ClientContact>): Promise<void> => {
    try {
      if (!selectedClient) return;
      
      if (selectedContact) {
        await clientService.updateContact(selectedClient.id, selectedContact.id, formData);
        toast.success(t('clients.messages.contactUpdated'));
      } else {
        await clientService.createContact(selectedClient.id, formData);
        toast.success(t('clients.messages.contactCreated'));
      }
      setContactModalOpen(false);
      setSelectedContact(null);
      await fetchData();
    } catch (error) {
      logger.error('Error saving contact:', error);
      toast.error(selectedContact 
        ? t('clients.messages.errorUpdatingContact') 
        : t('clients.messages.errorCreatingContact'));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'client') {
        await clientService.deleteClient(deleteTarget.id);
        toast.success(t('clients.messages.clientDeleted'));
      } else if (deleteTarget.type === 'contact' && deleteTarget.clientId) {
        await clientService.deleteContact(deleteTarget.clientId, deleteTarget.id);
        toast.success(t('clients.messages.contactDeleted'));
      }
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      await fetchData();
    } catch (error: unknown) {
      logger.error('Error deleting:', error);
      if (error instanceof Error && error.message.includes('submission')) {
        toast.error(t('clients.messages.cannotDeleteWithSubmissions'));
      } else {
        toast.error(t('clients.messages.errorDeleting'));
      }
    }
  };

  const openClientDetail = async (client: Client) => {
    try {
      const fullClient = await clientService.getClient(client.id);
      setSelectedClient(fullClient);
      setDetailModalOpen(true);
    } catch (error) {
      logger.error('Error fetching client details:', error);
      toast.error(t('clients.messages.errorFetching'));
    }
  };

  const getTypeColor = (type: ClientType): string => {
    return type === 'client' 
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 max-w-7xl mx-auto"
    >
      <Breadcrumbs className="mb-4" />
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {t('clients.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('clients.subtitle')}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <BuildingOfficeIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('clients.stats.clients')}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalClients}</div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <BriefcaseIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('clients.stats.prospects')}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalProspects}</div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <UserGroupIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('clients.stats.contacts')}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalContacts}</div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <PaperAirplaneIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('clients.stats.submissions')}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalSubmissions}</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('all'); setPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('clients.tabs.all')}
            </button>
            <button
              onClick={() => { setActiveTab('client'); setPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'client'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <BuildingOfficeIcon className="w-5 h-5" />
              {t('clients.tabs.clients')}
            </button>
            <button
              onClick={() => { setActiveTab('prospect'); setPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'prospect'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <BriefcaseIcon className="w-5 h-5" />
              {t('clients.tabs.prospects')}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={t('common.refresh')}
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setSelectedClient(null);
                setClientModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              {t('clients.addClient')}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('clients.searchPlaceholder')}
                value={searchTerm}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title={t('common.resetFilters')}
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pagination top */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
        loading={loading}
        itemName={t('clients.results')}
      />

      {/* Client cards */}
      {loading ? (
        <SkeletonClientList count={6} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {clients.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <BuildingOfficeIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">{t('clients.noClients')}</p>
          </div>
        ) : (
          clients.map((client, index) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <BuildingOfficeIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{client.name}</h3>
                      {client.industry && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{client.industry}</p>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(client.type)}`}>
                    {t(`clients.types.${client.type}`)}
                  </span>
                </div>

                {/* Info */}
                <div className="space-y-2 mb-4">
                  {client.website && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <GlobeAltIcon className="w-4 h-4" />
                      <a href={client.website} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 truncate">
                        {client.website}
                      </a>
                    </div>
                  )}
                  {client.address && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <MapPinIcon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{client.address}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <div className="flex items-center gap-1">
                    <UserGroupIcon className="w-4 h-4" />
                    <span>{client.contacts_count || 0} {t('clients.contactsLabel')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <PaperAirplaneIcon className="w-4 h-4" />
                    <span>{client.submissions_count || 0} {t('clients.submissionsLabel')}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => openClientDetail(client)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <EyeIcon className="w-4 h-4" />
                    {t('common.view')}
                  </button>
                  <button
                    onClick={() => { setSelectedClient(client); setClientModalOpen(true); }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => { 
                      setDeleteTarget({ id: client.id, name: client.name, type: 'client' }); 
                      setDeleteModalOpen(true); 
                    }}
                    disabled={(client.submissions_count || 0) > 0}
                    className={`p-2 rounded-lg transition-colors ${
                      (client.submissions_count || 0) > 0
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30'
                    }`}
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
      )}

      {/* Pagination bottom */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
        loading={loading}
        itemName={t('clients.results')}
      />

      {/* Modals */}
      <ClientFormModal
        isOpen={clientModalOpen}
        onClose={() => { setClientModalOpen(false); setSelectedClient(null); }}
        onSubmit={handleClientSubmit}
        client={selectedClient}
        t={t}
      />

      <ContactFormModal
        isOpen={contactModalOpen}
        onClose={() => { setContactModalOpen(false); setSelectedContact(null); }}
        onSubmit={handleContactSubmit}
        contact={selectedContact}
        t={t}
      />

      <ClientDetailModal
        isOpen={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedClient(null); }}
        client={selectedClient}
        onEditClient={() => { setDetailModalOpen(false); setClientModalOpen(true); }}
        onAddContact={() => { setDetailModalOpen(false); setSelectedContact(null); setContactModalOpen(true); }}
        onEditContact={(contact: ClientContact) => { setDetailModalOpen(false); setSelectedContact(contact); setContactModalOpen(true); }}
        onDeleteContact={(contact: ClientContact) => { 
          setDeleteTarget({ id: contact.id, name: contact.name, type: 'contact', clientId: selectedClient?.id }); 
          setDeleteModalOpen(true); 
        }}
        t={t}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeleteTarget(null); }}
        onConfirm={handleDelete}
        message={deleteTarget?.type === 'client' 
          ? t('clients.messages.confirmDeleteClient', { name: deleteTarget?.name })
          : t('clients.messages.confirmDeleteContact', { name: deleteTarget?.name })
        }
        t={t}
      />
    </motion.div>
  );
};

export default ClientsPage;
