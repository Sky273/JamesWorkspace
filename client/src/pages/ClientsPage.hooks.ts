import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import clientService from '../utils/clientService';
import logger from '../utils/logger.frontend';
import {
  consumeDirtyViewScopesForConsumer,
  markViewScopesDirty,
  subscribeToViewRefreshForConsumer,
} from '../utils/viewRefresh';
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
type ClientWithDetails = Client & { contacts?: ClientContact[] };
export const CLIENTS_PAGE_SIZE = 12;
export type { ClientFilter, ClientsStats, CRMTab };
type FetchClientsOptions = {
  page?: number;
  search?: string;
  forceRefresh?: boolean;
  preserveClient?: Client | null;
};

export function mergePreservedClientIntoResults({
  clients,
  preservedClient,
  typeFilter,
  normalizedSearch,
}: {
  clients: Client[];
  preservedClient?: Client | null;
  typeFilter: string;
  normalizedSearch: string;
}) {
  const shouldPreserveClient = preservedClient != null
    && (typeFilter === '' || preservedClient.type === typeFilter)
    && (normalizedSearch.length === 0 || preservedClient.name.toLowerCase().includes(normalizedSearch))
    && !clients.some((client) => client.id === preservedClient.id);

  return shouldPreserveClient
    ? [preservedClient, ...clients].slice(0, CLIENTS_PAGE_SIZE)
    : clients;
}

export function useClientsDashboard() {
  const refreshConsumerId = 'clients-page';
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
  const [selectedClient, setSelectedClient] = useState<ClientWithDetails | null>(null);
  const [selectedContact, setSelectedContact] = useState<ClientContact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [detailRefreshing, setDetailRefreshing] = useState(false);
  const [returnToDetailAfterContact, setReturnToDetailAfterContact] = useState(false);
  const clientsRequestIdRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchData = useCallback(async (options: FetchClientsOptions = {}): Promise<void> => {
    const requestId = ++clientsRequestIdRef.current;
    const effectivePage = options.page ?? page;
    const effectiveSearch = options.search ?? debouncedSearch;
    const normalizedSearch = effectiveSearch.trim().toLowerCase();
    try {
      setLoading(true);
      const typeFilter = getClientTypeFilter(activeTab);
      const result = await clientService.getClients({
        page: effectivePage,
        pageSize: CLIENTS_PAGE_SIZE,
        search: effectiveSearch,
        type: typeFilter,
        forceRefresh: options.forceRefresh,
      });

      if (requestId !== clientsRequestIdRef.current) {
        return;
      }
      const nextClients = mergePreservedClientIntoResults({
        clients: result.clients,
        preservedClient: options.preserveClient,
        typeFilter,
        normalizedSearch,
      });
      setClients(nextClients);
      setTotalCount(result.pagination?.totalCount || nextClients.length);
      setHasMore(result.pagination?.hasMore || false);
    } catch (error) {
      if (requestId !== clientsRequestIdRef.current) {
        return;
      }
      logger.error('Error fetching clients:', error);
      toast.error(t('clients.messages.errorFetching'));
    } finally {
      if (requestId === clientsRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [activeTab, debouncedSearch, page, t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!consumeDirtyViewScopesForConsumer(refreshConsumerId, ['clients'])) {
      return;
    }

    void fetchData({ forceRefresh: true });
  }, [fetchData]);

  useEffect(() => {
    return subscribeToViewRefreshForConsumer(refreshConsumerId, ['clients'], () => {
      void fetchData({ forceRefresh: true });
    });
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
          const updatedClient = await clientService.updateClient(selectedClient.id, formData);
          clientsRequestIdRef.current += 1;
          setClients((currentClients) => currentClients.map((client) => (
            client.id === selectedClient.id ? updatedClient : client
          )));
          setSelectedClient(updatedClient);
          toast.success(t('clients.messages.clientUpdated'));
          markViewScopesDirty(['clients', 'deals', 'missions']);
          await fetchData({
            page,
            search: searchTerm.trim(),
            forceRefresh: true,
            preserveClient: updatedClient,
          });
        } else {
          const createdClient = await clientService.createClient(formData);
          clientsRequestIdRef.current += 1;
          setClients((currentClients) => [createdClient, ...currentClients].slice(0, CLIENTS_PAGE_SIZE));
          setTotalCount((currentTotal) => currentTotal + 1);
          setPage(1);
          toast.success(t('clients.messages.clientCreated'));
          markViewScopesDirty(['clients', 'deals', 'missions']);
          await fetchData({
            page: 1,
            search: searchTerm.trim(),
            forceRefresh: true,
            preserveClient: createdClient,
          });
        }
        setClientModalOpen(false);
        setSelectedClient(null);
      } catch (error) {
        logger.error('Error saving client:', error);
        toast.error(selectedClient ? t('clients.messages.errorUpdatingClient') : t('clients.messages.errorCreatingClient'));
      }
    },
    [fetchData, page, searchTerm, selectedClient, t]
  );

  const handleContactSubmit = useCallback(
    async (formData: Partial<ClientContact>): Promise<void> => {
      try {
        if (!selectedClient) return;

        if (selectedContact) {
          const updatedContact = await clientService.updateContact(selectedClient.id, selectedContact.id, formData);
          setSelectedClient((currentClient) => currentClient ? {
            ...currentClient,
            contacts: (currentClient.contacts || []).map((contact) => (
              contact.id === selectedContact.id ? updatedContact : contact
            )),
          } : currentClient);
          toast.success(t('clients.messages.contactUpdated'));
          markViewScopesDirty(['clients', 'deals', 'missions']);
        } else {
          const createdContact = await clientService.createContact(selectedClient.id, formData);
          setSelectedClient((currentClient) => currentClient ? {
            ...currentClient,
            contacts: [createdContact, ...(currentClient.contacts || [])],
          } : currentClient);
          toast.success(t('clients.messages.contactCreated'));
          markViewScopesDirty(['clients', 'deals', 'missions']);
        }
        setContactModalOpen(false);
        setSelectedContact(null);
        const refreshedClient = await clientService.getClient(selectedClient.id, { forceRefresh: true });
        setSelectedClient(refreshedClient);
        if (returnToDetailAfterContact) {
          setDetailModalOpen(true);
          setReturnToDetailAfterContact(false);
        }
        await fetchData({
          page,
          search: searchTerm.trim(),
          forceRefresh: true,
        });
      } catch (error) {
        logger.error('Error saving contact:', error);
        toast.error(selectedContact ? t('clients.messages.errorUpdatingContact') : t('clients.messages.errorCreatingContact'));
      }
    },
    [fetchData, page, returnToDetailAfterContact, searchTerm, selectedClient, selectedContact, t]
  );

  const handleDelete = useCallback(async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'client') {
        await clientService.deleteClient(deleteTarget.id);
        clientsRequestIdRef.current += 1;
        setClients((currentClients) => currentClients.filter((client) => client.id !== deleteTarget.id));
        setTotalCount((currentTotal) => Math.max(0, currentTotal - 1));
        toast.success(t('clients.messages.clientDeleted'));
        markViewScopesDirty(['clients', 'deals', 'missions']);
      } else if (deleteTarget.type === 'contact' && deleteTarget.clientId) {
        await clientService.deleteContact(deleteTarget.clientId, deleteTarget.id);
        setSelectedClient((currentClient) => currentClient ? {
          ...currentClient,
          contacts: (currentClient.contacts || []).filter((contact) => contact.id !== deleteTarget.id),
        } : currentClient);
        const refreshedClient = await clientService.getClient(deleteTarget.clientId, { forceRefresh: true });
        setSelectedClient(refreshedClient);
        toast.success(t('clients.messages.contactDeleted'));
        markViewScopesDirty(['clients', 'deals', 'missions']);
      }
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      await fetchData({
        page,
        search: searchTerm.trim(),
        forceRefresh: true,
      });
    } catch (error: unknown) {
      logger.error('Error deleting:', error);
      if (error instanceof Error && error.message.includes('submission')) {
        toast.error(t('clients.messages.cannotDeleteWithSubmissions'));
      } else {
        toast.error(t('clients.messages.errorDeleting'));
      }
    }
  }, [deleteTarget, fetchData, page, searchTerm, t]);

  const refreshSelectedClient = useCallback(async (): Promise<void> => {
    if (!selectedClient) {
      return;
    }

    try {
      setDetailRefreshing(true);
      const refreshedClient = await clientService.getClient(selectedClient.id, { forceRefresh: true });
      setSelectedClient(refreshedClient);
      await fetchData({
        page,
        search: searchTerm.trim(),
        forceRefresh: true,
      });
    } catch (error) {
      logger.error('Error refreshing client details:', error);
      toast.error(t('clients.messages.errorFetching'));
    } finally {
      setDetailRefreshing(false);
    }
  }, [fetchData, page, searchTerm, selectedClient, t]);

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

  const refreshData = useCallback(async (): Promise<void> => {
    const normalizedSearch = searchTerm.trim();
    const nextPage = normalizedSearch === debouncedSearch ? page : 1;

    clientsRequestIdRef.current += 1;
    if (normalizedSearch !== debouncedSearch) {
      setDebouncedSearch(normalizedSearch);
    }
    if (nextPage !== page) {
      setPage(nextPage);
    }

    await fetchData({ page: nextPage, search: normalizedSearch, forceRefresh: true });
  }, [debouncedSearch, fetchData, page, searchTerm]);

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
    detailRefreshing,
    fetchData: refreshData,
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
    refreshSelectedClient,
    returnToDetailAfterContact,
    setActiveTab,
    setClientModalOpen,
    setContactModalOpen,
    setDeleteModalOpen,
    setDeleteTarget,
    setDetailModalOpen,
    setPage,
    setReturnToDetailAfterContact,
    setSearchTerm,
    setSelectedClient,
    setSelectedContact,
    stats,
    totalCount,
    totalPages,
  };
}
