/**
 * DealsTab - Manage deals (affaires) within CRM page
 * Displays deals with filtering by client and status
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BriefcaseIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';
import logger from '../../utils/logger.frontend';
import { Deal, Client, Contact, DealFormData, DealsTabProps, STATUS_CONFIG } from './dealsTab.types';
import DealCard from './DealCard';
import DealFormModal from './DealFormModal';
import DealDeleteModal from './DealDeleteModal';

const DealsTab = ({ preFilterClientId }: DealsTabProps): JSX.Element => {
  const { t } = useTranslation();
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
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'GET' });
      const response = await fetchWithAuth('/api/clients?limit=100', options);
      if (response.ok) {
        const data = await response.json();
        setClients(data.data || []);
      }
    } catch (error) {
      logger.error('Error fetching clients:', error);
    }
  }, []);

  // Fetch contacts for selected client
  const fetchContacts = useCallback(async (clientId: string) => {
    if (!clientId) {
      setContacts([]);
      return;
    }
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'GET' });
      const response = await fetchWithAuth(`/api/clients/${clientId}`, options);
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
      }
    } catch (error) {
      logger.error('Error fetching contacts:', error);
    }
  }, []);

  // Fetch deals
  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', pageSize.toString());
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (clientFilter) params.set('clientId', clientFilter);

      const options = await createAuthOptionsWithCsrf({ method: 'GET' });
      const response = await fetchWithAuth(`/api/deals?${params.toString()}`, options);
      
      if (response.ok) {
        const data = await response.json();
        setDeals(data.data || []);
        setTotalCount(data.pagination?.totalCount || 0);
      } else {
        throw new Error('Failed to fetch deals');
      }
    } catch (error) {
      logger.error('Error fetching deals:', error);
      toast.error(t('crm.deals.errorFetching', 'Erreur lors du chargement des affaires'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, clientFilter, t]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

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
      toast.error(t('crm.deals.titleRequired', 'Le nom de l\'affaire est requis'));
      return;
    }

    setSaving(true);
    const toastId = toast.loading(t('crm.deals.messages.saving', 'Enregistrement en cours...'));
    
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
        toast.success(selectedDeal 
          ? t('crm.deals.updated', 'Affaire mise à jour')
          : t('crm.deals.created', 'Affaire créée'),
          { id: toastId }
        );
        setFormModalOpen(false);
        setSelectedDeal(null);
        resetForm();
        fetchDeals();
      } else {
        const errorData = await response.json();
        logger.error('Server error:', errorData);
        throw new Error(errorData.error || errorData.details || 'Failed to save deal');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      logger.error('Error saving deal:', error);
      toast.error(
        t('crm.deals.errorSaving', 'Erreur lors de la sauvegarde') + ': ' + errorMessage,
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
        toast.success(t('crm.deals.deleted', 'Affaire supprimée'));
        setDeleteModalOpen(false);
        setSelectedDeal(null);
        fetchDeals();
      } else {
        throw new Error('Failed to delete deal');
      }
    } catch (error) {
      logger.error('Error deleting deal:', error);
      toast.error(t('crm.deals.errorDeleting', 'Erreur lors de la suppression'));
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
      notes: ''
    });
    setContacts([]);
  };

  const openEditModal = (deal: Deal) => {
    setSelectedDeal(deal);
    setFormData({
      title: deal.title,
      description: deal.description || '',
      client_id: deal.client_id || '',
      contact_id: deal.contact_id || '',
      status: deal.status,
      priority: deal.priority,
      expected_start_date: deal.expected_start_date?.split('T')[0] || '',
      expected_end_date: deal.expected_end_date?.split('T')[0] || ''
    });
    if (deal.client_id) {
      fetchContacts(deal.client_id);
    }
    setFormModalOpen(true);
  };

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

  const totalPages = Math.ceil(totalCount / pageSize);

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
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="all">{t('crm.deals.allStatuses', 'Tous les statuts')}</option>
              <option value="open">{STATUS_CONFIG.open.label}</option>
              <option value="won">{STATUS_CONFIG.won.label}</option>
              <option value="lost">{STATUS_CONFIG.lost.label}</option>
              <option value="on_hold">{STATUS_CONFIG.on_hold.label}</option>
            </select>

            {/* Client filter */}
            <select
              value={clientFilter}
              onChange={(e) => { setClientFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-w-[200px]"
            >
              <option value="">{t('crm.deals.allClients', 'Tous les clients')}</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.type === 'client' ? 'Client' : 'Prospect'})
                </option>
              ))}
            </select>

            {(statusFilter !== 'all' || clientFilter) && (
              <button
                onClick={() => { setStatusFilter('all'); setClientFilter(''); setPage(1); }}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <XMarkIcon className="w-4 h-4" />
                {t('common.resetFilters', 'Réinitialiser')}
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchDeals}
              className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={t('common.refresh', 'Actualiser')}
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              {t('crm.deals.add', 'Nouvelle affaire')}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('crm.deals.searchPlaceholder', 'Rechercher une affaire...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {totalCount} {t('crm.deals.results', 'affaire(s)')}
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
            {t('crm.deals.noDeals', 'Aucune affaire trouvée')}
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <PlusIcon className="w-5 h-5" />
            {t('crm.deals.createFirst', 'Créer une affaire')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((deal, index) => (
            <DealCard
              key={deal.id}
              deal={deal}
              index={index}
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
            {t('common.previous', 'Précédent')}
          </button>
          <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
          >
            {t('common.next', 'Suivant')}
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
