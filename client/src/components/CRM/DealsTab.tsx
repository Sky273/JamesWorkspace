/**
 * DealsTab - Manage deals (affaires) within CRM page
 * Displays deals with filtering by client and status
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BriefcaseIcon,
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useScopedViewRefresh } from '../../hooks/useScopedViewRefresh';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';
import logger from '../../utils/logger.frontend';
import { markDealsViewDirty } from '../../utils/viewRefreshScopes';
import { Deal, Client, Contact, DealFormData, DealsTabProps, STATUS_CONFIG } from './dealsTab.types';
import DealCard from './DealCard';
import DealFormModal from './DealFormModal';
import DealDeleteModal from './DealDeleteModal';
import SearchField from '../page/SearchField';

export function mergePreservedDealIntoResults<T extends { id: string; title?: string; client_id?: string; status?: string }>(
  deals: T[],
  preservedDeal: T | null,
  {
    normalizedSearch,
    clientFilter,
    statusFilter,
    pageSize,
  }: {
    normalizedSearch: string;
    clientFilter: string;
    statusFilter: string;
    pageSize: number;
  }
) {
  const shouldPreserve = preservedDeal != null
    && (statusFilter === 'all' || !statusFilter || preservedDeal.status === statusFilter)
    && (!clientFilter || preservedDeal.client_id === clientFilter)
    && (normalizedSearch.length === 0 || (preservedDeal.title || '').toLowerCase().includes(normalizedSearch))
    && !deals.some((deal) => deal.id === preservedDeal.id);

  return shouldPreserve
    ? [preservedDeal, ...deals].slice(0, pageSize)
    : deals;
}

const DealsTab = ({ preFilterClientId }: DealsTabProps): JSX.Element => {
  const refreshConsumerId = 'deals-tab';
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>(preFilterClientId || searchParams.get('clientId') || '');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 12;

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [formData, setFormData] = useState<DealFormData>({
    title: '',
    status: 'open',
    priority: 'medium'
  });
  const [saving, setSaving] = useState(false);
  const dealsRequestIdRef = useRef(0);
  const clientsRequestIdRef = useRef(0);
  const contactsRequestIdRef = useRef(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch clients for dropdown
  const fetchClients = useCallback(async () => {
    const requestId = ++clientsRequestIdRef.current;
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'GET' });
      const response = await fetchWithAuth('/api/clients?limit=100', options);
      if (response.ok) {
        const data = await response.json();
        if (requestId !== clientsRequestIdRef.current) {
          return;
        }
        setClients(data.data || []);
      }
    } catch (error) {
      logger.error('Error fetching clients:', error);
    }
  }, []);

  // Fetch contacts for selected client
  const fetchContacts = useCallback(async (clientId: string) => {
    const requestId = ++contactsRequestIdRef.current;
    if (!clientId) {
      setContacts([]);
      return;
    }
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'GET' });
      const response = await fetchWithAuth(`/api/clients/${clientId}`, options);
      if (response.ok) {
        const data = await response.json();
        if (requestId !== contactsRequestIdRef.current) {
          return;
        }
        setContacts(data.contacts || []);
      }
    } catch (error) {
      logger.error('Error fetching contacts:', error);
    }
  }, []);

  // Fetch deals
  const fetchDeals = useCallback(async (fetchOptions: { page?: number; search?: string; forceRefresh?: boolean; preserveDeal?: Deal | null } = {}) => {
    const requestId = ++dealsRequestIdRef.current;
    const effectivePage = fetchOptions.page ?? page;
    const effectiveSearch = fetchOptions.search ?? debouncedSearch;
    const normalizedSearch = effectiveSearch.trim().toLowerCase();
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', effectivePage.toString());
      params.set('limit', pageSize.toString());
      if (effectiveSearch) params.set('search', effectiveSearch);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (clientFilter) params.set('clientId', clientFilter);
      if (fetchOptions.forceRefresh) params.set('refresh', '1');

      const requestOptions = await createAuthOptionsWithCsrf({ method: 'GET' });
      const response = await fetchWithAuth(`/api/deals?${params.toString()}`, requestOptions);
      
      if (response.ok) {
        const data = await response.json();
        if (requestId !== dealsRequestIdRef.current) {
          return;
        }
        const nextDeals = mergePreservedDealIntoResults(data.data || [], fetchOptions.preserveDeal || null, {
          normalizedSearch,
          clientFilter,
          statusFilter,
          pageSize,
        });
        setDeals(nextDeals);
        setTotalCount(data.pagination?.totalCount || 0);
      } else {
        throw new Error('Failed to fetch deals');
      }
    } catch (error) {
      if (requestId !== dealsRequestIdRef.current) {
        return;
      }
      logger.error('Error fetching deals:', error);
      toast.error(t('crm.deals.messages.errorFetching'));
    } finally {
      if (requestId === dealsRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [page, debouncedSearch, statusFilter, clientFilter, t]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  useScopedViewRefresh({
    consumerId: refreshConsumerId,
    scopes: ['deals'],
    onRefresh: () => {
      void fetchDeals({ forceRefresh: true });
    },
  });

  // Update URL when client filter changes
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    if (clientFilter) {
      newParams.set('clientId', clientFilter);
    } else {
      newParams.delete('clientId');
    }
    setSearchParams(newParams, { replace: true });
  }, [clientFilter, searchParams, setSearchParams]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error(t('crm.deals.titleRequired'));
      return;
    }

    setSaving(true);
    const toastId = toast.loading(t('crm.deals.messages.saving'));
    
    try {
      const url = selectedDeal ? `/api/deals/${selectedDeal.id}` : '/api/deals';
      const method = selectedDeal ? 'PUT' : 'POST';
      
      // Clean up empty strings to null for optional fields
      const cleanedData = {
        ...formData,
        client_id: formData.client_id || null,
        contact_id: formData.contact_id || null,
        description: formData.description || null,
        expected_start_date: formData.expected_start_date || null,
        expected_end_date: formData.expected_end_date || null,
        budget_min: formData.budget_min === '' ? null : (formData.budget_min ?? null),
        budget_max: formData.budget_max === '' ? null : (formData.budget_max ?? null),
        notes: formData.notes || null
      };
      
      logger.log('Creating deal with data:', cleanedData);
      
      const options = await createAuthOptionsWithCsrf({
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedData)
      });

      logger.log('Sending request to:', url);
      const response = await fetchWithAuth(url, options);
      logger.log('Response received:', response.status);
      
      if (response.ok) {
        const deal = await response.json();
        logger.log('Deal created/updated:', deal);
        dealsRequestIdRef.current += 1;
        setDeals((currentDeals) => {
          const normalizedDeal = deal?.data || deal;
          const existingIndex = currentDeals.findIndex((currentDeal) => currentDeal.id === normalizedDeal.id);
          if (existingIndex >= 0) {
            return currentDeals.map((currentDeal) => (currentDeal.id === normalizedDeal.id ? normalizedDeal : currentDeal));
          }
          return [normalizedDeal, ...currentDeals].slice(0, pageSize);
        });
        if (!selectedDeal) {
          setTotalCount((currentTotal) => currentTotal + 1);
        }
        toast.success(selectedDeal 
          ? t('crm.deals.updated')
          : t('crm.deals.created'),
          { id: toastId }
        );
      markDealsViewDirty();
        setFormModalOpen(false);
        setSelectedDeal(null);
        resetForm();
        if (!selectedDeal) {
          setPage(1);
        }
        void fetchDeals({
          page: selectedDeal ? page : 1,
          search: searchTerm.trim(),
          forceRefresh: true,
          preserveDeal: deal?.data || deal,
        });
      } else {
        const errorData = await response.json();
        logger.error('Server error:', errorData);
        throw new Error(errorData.error || errorData.details || 'Failed to save deal');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      logger.error('Error saving deal:', error);
      toast.error(
        t('crm.deals.errorSaving') + ': ' + errorMessage,
        { id: toastId, duration: 5000 }
      );
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedDeal) return;
    
    setSaving(true);
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'DELETE' });
      const response = await fetchWithAuth(`/api/deals/${selectedDeal.id}`, options);
      
      if (response.ok) {
        dealsRequestIdRef.current += 1;
        setDeals((currentDeals) => currentDeals.filter((deal) => deal.id !== selectedDeal.id));
        setTotalCount((currentTotal) => Math.max(0, currentTotal - 1));
        toast.success(t('crm.deals.deleted'));
      markDealsViewDirty();
        setDeleteModalOpen(false);
        setSelectedDeal(null);
        void fetchDeals({
          page,
          search: searchTerm.trim(),
          forceRefresh: true,
        });
      } else {
        throw new Error('Failed to delete deal');
      }
    } catch (error) {
      logger.error('Error deleting deal:', error);
      toast.error(t('crm.deals.errorDeleting'));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      client_id: '',
      contact_id: '',
      status: 'open',
      priority: 'medium',
      expected_start_date: '',
      expected_end_date: '',
      budget_min: '',
      budget_max: '',
      notes: ''
    });
    setContacts([]);
  };

  const openEditModal = useCallback((deal: Deal) => {
    setSelectedDeal(deal);
    setFormData({
      title: deal.title,
      description: deal.description || '',
      client_id: deal.client_id || '',
      contact_id: deal.contact_id || '',
      status: deal.status,
      priority: deal.priority,
      expected_start_date: deal.expected_start_date?.split('T')[0] || '',
      expected_end_date: deal.expected_end_date?.split('T')[0] || '',
      budget_min: deal.budget_min ?? '',
      budget_max: deal.budget_max ?? '',
      notes: deal.notes || ''
    });
    if (deal.client_id) {
      fetchContacts(deal.client_id);
    }
    setFormModalOpen(true);
  }, [fetchContacts]);

  const openCreateModal = () => {
    setSelectedDeal(null);
    resetForm();
    // Pre-fill client if filtered
    if (clientFilter) {
      setFormData(prev => ({ ...prev, client_id: clientFilter }));
      fetchContacts(clientFilter);
    }
    setFormModalOpen(true);
  };

  const openDealView = (deal: Deal) => {
    navigate(`/deals/${deal.id}`);
  };

  const openEditModalById = useCallback(async (dealId: string) => {
    const existingDeal = deals.find((deal) => deal.id === dealId);
    if (existingDeal) {
      openEditModal(existingDeal);
      return;
    }

    try {
      const options = await createAuthOptionsWithCsrf({ method: 'GET' });
      const response = await fetchWithAuth(`/api/deals/${dealId}`, options);
      if (!response.ok) {
        throw new Error('Failed to fetch deal');
      }

      const data = await response.json();
      openEditModal({
        id: data.id,
        title: data.title || data.Title || '',
        description: data.description || data.Description || '',
        status: data.status || data.Status || 'open',
        priority: data.priority || data.Priority || 'medium',
        client_id: data.client_id || data.clientId || '',
        client_name: data.client_name || data.clientName,
        client_type: data.client_type || data.clientType,
        contact_id: data.contact_id || data.contactId || '',
        contact_name: data.contact_name || data.contactName,
        contact_email: data.contact_email || data.contactEmail,
        contact_role: data.contact_role || data.contactRole,
        expected_start_date: data.expected_start_date || data.expectedStartDate || '',
        expected_end_date: data.expected_end_date || data.expectedEndDate || '',
        budget_min: data.budget_min ?? data.budgetMin,
        budget_max: data.budget_max ?? data.budgetMax,
        notes: data.notes || data.Notes || '',
        resumes_count: data.resumes_count || data.resumesCount || 0,
        missions_count: data.missions_count || data.missionsCount || 0,
        created_at: data.created_at || data.createdAt || '',
        updated_at: data.updated_at || data.updatedAt || ''
      });
    } catch (error) {
      logger.error('Error fetching deal for edit:', error);
      toast.error(t('crm.deals.messages.errorFetching'));
    }
  }, [deals, openEditModal, t]);

  useEffect(() => {
    const editDealId = (location.state as { editDealId?: string } | null)?.editDealId;
    if (!editDealId) {
      return;
    }

    void openEditModalById(editDealId);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate, openEditModalById]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const handleRefresh = useCallback(() => {
    const normalizedSearch = searchTerm.trim();
    const nextPage = normalizedSearch === debouncedSearch ? page : 1;

    dealsRequestIdRef.current += 1;
    if (normalizedSearch !== debouncedSearch) {
      setDebouncedSearch(normalizedSearch);
    }
    if (nextPage !== page) {
      setPage(nextPage);
    }
    void fetchDeals({ page: nextPage, search: normalizedSearch, forceRefresh: true });
  }, [debouncedSearch, fetchDeals, page, searchTerm]);

  return (
    <div>
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="all">{t('crm.deals.allStatuses')}</option>
              <option value="open">{STATUS_CONFIG.open.label}</option>
              <option value="won">{STATUS_CONFIG.won.label}</option>
              <option value="lost">{STATUS_CONFIG.lost.label}</option>
              <option value="on_hold">{STATUS_CONFIG.on_hold.label}</option>
            </select>

            {/* Client filter */}
            <select
              value={clientFilter}
              onChange={(e) => { setClientFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm min-w-[200px]"
            >
              <option value="">{t('crm.deals.allClients')}</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.type === 'client' ? t('clients.types.client') : t('clients.types.prospect')})
                </option>
              ))}
            </select>

            {(statusFilter !== 'all' || clientFilter) && (
              <button
                onClick={() => { setStatusFilter('all'); setClientFilter(''); setPage(1); }}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <XMarkIcon className="w-4 h-4" />
                {t('common.resetFilters')}
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={t('common.refresh')}
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
            <button
              onClick={openCreateModal}
              className="btn btn-primary flex items-center gap-2 px-4 py-2"
            >
              <PlusIcon className="w-5 h-5" />
              {t('crm.deals.add')}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4">
          <SearchField
            containerClassName="relative"
            placeholder={t('crm.deals.searchPlaceholder')}
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {totalCount} {t('crm.deals.results')}
      </div>

      {/* Deals grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 animate-pulse">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <BriefcaseIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {t('crm.deals.noDeals')}
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <PlusIcon className="w-5 h-5" />
            {t('crm.deals.createFirst')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((deal, index) => (
            <DealCard
              key={deal.id}
              deal={deal}
              index={index}
              onView={openDealView}
              onEdit={openEditModal}
              onDelete={(d) => { setSelectedDeal(d); setDeleteModalOpen(true); }}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
          >
            {t('common.previous')}
          </button>
          <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
          >
            {t('common.next')}
          </button>
        </div>
      )}

      {/* Form Modal */}
      <DealFormModal
        open={formModalOpen}
        isEditing={!!selectedDeal}
        formData={formData}
        setFormData={setFormData}
        clients={clients}
        contacts={contacts}
        saving={saving}
        onSubmit={handleSubmit}
        onClose={() => setFormModalOpen(false)}
        onClientChange={fetchContacts}
      />

      {/* Delete Confirmation Modal */}
      <DealDeleteModal
        open={deleteModalOpen}
        deal={selectedDeal}
        saving={saving}
        onDelete={handleDelete}
        onClose={() => setDeleteModalOpen(false)}
      />
    </div>
  );
};

export default DealsTab;

