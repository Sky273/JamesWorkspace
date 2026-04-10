import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import clientService from '../utils/clientService';
import logger from '../utils/logger.frontend';
import type { Client, ClientContact } from '../types/entities';
import {
  buildCrmTabSearchParams,
  computeClientsStats,
  getClientTypeFilter,
  getInitialCrmTab,
  type ClientFilter,
  type ClientsStats,
  type CRMTab,
} from './ClientsPage.data';

export interface DeleteTarget {
  id: string;
  name?: string;
  type: 'client' | 'contact';
  clientId?: string;
}
export const CLIENTS_PAGE_SIZE = 12;
export type { ClientFilter, ClientsStats, CRMTab };

export function useClientsDashboard() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [crmTab, setCrmTab] = useState<CRMTab>(getInitialCrmTab(searchParams.get('tab')));
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ClientFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [, setHasMore] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedContact, setSelectedContact] = useState<ClientContact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const typeFilter = getClientTypeFilter(activeTab);
      const result = await clientService.getClients({
        page,
        pageSize: CLIENTS_PAGE_SIZE,
        search: debouncedSearch,
        type: typeFilter,
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
  }, [activeTab, debouncedSearch, page, t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const stats = useMemo<ClientsStats>(() => computeClientsStats(clients), [clients]);

  const totalPages = Math.ceil(totalCount / CLIENTS_PAGE_SIZE);

  const goToPage = useCallback(
    (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
        setPage(newPage);
      }
    },
    [totalPages]
  );

  const handleClientSubmit = useCallback(
    async (formData: Partial<Client>): Promise<void> => {
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
        toast.error(selectedClient ? t('clients.messages.errorUpdatingClient') : t('clients.messages.errorCreatingClient'));
      }
    },
    [fetchData, selectedClient, t]
  );

  const handleContactSubmit = useCallback(
    async (formData: Partial<ClientContact>): Promise<void> => {
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
        toast.error(selectedContact ? t('clients.messages.errorUpdatingContact') : t('clients.messages.errorCreatingContact'));
      }
    },
    [fetchData, selectedClient, selectedContact, t]
  );

  const handleDelete = useCallback(async (): Promise<void> => {
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
  }, [deleteTarget, fetchData, t]);

  const openClientDetail = useCallback(
    async (client: Client) => {
      try {
        const fullClient = await clientService.getClient(client.id);
        setSelectedClient(fullClient);
        setDetailModalOpen(true);
      } catch (error) {
        logger.error('Error fetching client details:', error);
        toast.error(t('clients.messages.errorFetching'));
      }
    },
    [t]
  );

  const goToClientsTab = useCallback(() => {
    setCrmTab('clients');
    setSearchParams(buildCrmTabSearchParams(searchParams, 'clients', { removeClientId: true }));
  }, [searchParams, setSearchParams]);

  const goToDealsTab = useCallback(() => {
    setCrmTab('deals');
    setSearchParams(buildCrmTabSearchParams(searchParams, 'deals'));
  }, [searchParams, setSearchParams]);

  const goToInterviewsTab = useCallback(() => {
    setCrmTab('interviews');
    setSearchParams(buildCrmTabSearchParams(searchParams, 'interviews', { removeClientId: true }));
  }, [searchParams, setSearchParams]);

  return {
    activeTab,
    clientModalOpen,
    clients,
    contactModalOpen,
    crmTab,
    debouncedSearch,
    deleteModalOpen,
    deleteTarget,
    detailModalOpen,
    fetchData,
    goToClientsTab,
    goToDealsTab,
    goToInterviewsTab,
    goToPage,
    handleClientSubmit,
    handleContactSubmit,
    handleDelete,
    loading,
    openClientDetail,
    page,
    searchParams,
    searchTerm,
    selectedClient,
    selectedContact,
    setActiveTab,
    setClientModalOpen,
    setContactModalOpen,
    setDeleteModalOpen,
    setDeleteTarget,
    setDetailModalOpen,
    setPage,
    setSearchTerm,
    setSelectedClient,
    setSelectedContact,
    stats,
    totalCount,
    totalPages,
  };
}
