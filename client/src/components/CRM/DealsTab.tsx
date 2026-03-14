/**
 * DealsTab - Manage deals (affaires) within CRM page
 * Displays deals with filtering by client and status
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BriefcaseIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  UserIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  CalendarIcon,
  FlagIcon,
  ChevronDownIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';
import logger from '../../utils/logger.frontend';

// Types
interface Deal {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'won' | 'lost' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  client_id?: string;
  client_name?: string;
  client_type?: string;
  contact_id?: string;
  contact_name?: string;
  contact_email?: string;
  contact_role?: string;
  expected_start_date?: string;
  expected_end_date?: string;
  budget_min?: number;
  budget_max?: number;
  resumes_count: number;
  created_at: string;
  updated_at: string;
}

interface Client {
  id: string;
  name: string;
  type: 'client' | 'prospect';
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

interface DealFormData {
  title: string;
  description?: string;
  client_id?: string;
  contact_id?: string;
  status: string;
  priority: string;
  expected_start_date?: string;
  expected_end_date?: string;
  notes?: string;
}

interface DealsTabProps {
  preFilterClientId?: string;
}

const STATUS_CONFIG = {
  open: { label: 'En cours', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  won: { label: 'Gagnée', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  lost: { label: 'Perdue', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  on_hold: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' }
};

const PRIORITY_CONFIG = {
  low: { label: 'Basse', color: 'text-gray-500', icon: '○' },
  medium: { label: 'Moyenne', color: 'text-blue-500', icon: '●' },
  high: { label: 'Haute', color: 'text-orange-500', icon: '●●' },
  urgent: { label: 'Urgente', color: 'text-red-500', icon: '●●●' }
};

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
    if (clientFilter) {
      searchParams.set('clientId', clientFilter);
    } else {
      searchParams.delete('clientId');
    }
    setSearchParams(searchParams, { replace: true });
  }, [clientFilter]);

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
            <motion.div
              key={deal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow"
            >
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {deal.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_CONFIG[deal.status].color}`}>
                        {STATUS_CONFIG[deal.status].label}
                      </span>
                      <span className={`text-xs ${PRIORITY_CONFIG[deal.priority].color}`} title={PRIORITY_CONFIG[deal.priority].label}>
                        {PRIORITY_CONFIG[deal.priority].icon}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Client */}
                {deal.client_name && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <BuildingOfficeIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{deal.client_name}</span>
                    {deal.client_type && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        deal.client_type === 'client' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {deal.client_type === 'client' ? 'Client' : 'Prospect'}
                      </span>
                    )}
                  </div>
                )}

                {/* Contact */}
                {deal.contact_name && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <UserIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">
                      {deal.contact_name}
                      {deal.contact_role && <span className="text-gray-400"> • {deal.contact_role}</span>}
                    </span>
                  </div>
                )}

                {/* CVs count */}
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <DocumentTextIcon className="w-4 h-4 flex-shrink-0" />
                  <span>{deal.resumes_count} CV(s) associé(s)</span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => openEditModal(deal)}
                    className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                    title={t('common.edit', 'Modifier')}
                  >
                    <PencilSquareIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => { setSelectedDeal(deal); setDeleteModalOpen(true); }}
                    className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                    title={t('common.delete', 'Supprimer')}
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
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
      <AnimatePresence>
        {formModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setFormModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  {selectedDeal 
                    ? t('crm.deals.editTitle', 'Modifier l\'affaire')
                    : t('crm.deals.createTitle', 'Nouvelle affaire')
                  }
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('crm.deals.name', 'Nom de l\'affaire')} *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  {/* Client */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('crm.deals.client', 'Client / Prospect')}
                    </label>
                    <select
                      value={formData.client_id || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, client_id: e.target.value, contact_id: '' });
                        fetchContacts(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">{t('crm.deals.selectClient', 'Sélectionner...')}</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} ({client.type === 'client' ? 'Client' : 'Prospect'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Contact */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('crm.deals.contact', 'Interlocuteur')}
                    </label>
                    <select
                      value={formData.contact_id || ''}
                      onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={!formData.client_id}
                    >
                      <option value="">{t('crm.deals.selectContact', 'Sélectionner...')}</option>
                      {contacts.map(contact => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name} {contact.role ? `(${contact.role})` : ''}
                        </option>
                      ))}
                    </select>
                    {!formData.client_id && (
                      <p className="text-xs text-gray-500 mt-1">
                        {t('crm.deals.selectClientFirst', 'Sélectionnez d\'abord un client')}
                      </p>
                    )}
                  </div>

                  {/* Status & Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('crm.deals.status', 'Statut')}
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="open">{STATUS_CONFIG.open.label}</option>
                        <option value="won">{STATUS_CONFIG.won.label}</option>
                        <option value="lost">{STATUS_CONFIG.lost.label}</option>
                        <option value="on_hold">{STATUS_CONFIG.on_hold.label}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('crm.deals.priority', 'Priorité')}
                      </label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="low">{PRIORITY_CONFIG.low.label}</option>
                        <option value="medium">{PRIORITY_CONFIG.medium.label}</option>
                        <option value="high">{PRIORITY_CONFIG.high.label}</option>
                        <option value="urgent">{PRIORITY_CONFIG.urgent.label}</option>
                      </select>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('crm.deals.startDate', 'Date début prévue')}
                      </label>
                      <input
                        type="date"
                        value={formData.expected_start_date || ''}
                        onChange={(e) => setFormData({ ...formData, expected_start_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('crm.deals.endDate', 'Date fin prévue')}
                      </label>
                      <input
                        type="date"
                        value={formData.expected_end_date || ''}
                        onChange={(e) => setFormData({ ...formData, expected_end_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('crm.deals.description', 'Description')}
                    </label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setFormModalOpen(false)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      {t('common.cancel', 'Annuler')}
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                    >
                      {saving ? t('common.saving', 'Enregistrement...') : t('common.save', 'Enregistrer')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModalOpen && selectedDeal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setDeleteModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {t('crm.deals.confirmDelete', 'Confirmer la suppression')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {t('crm.deals.deleteWarning', 'Êtes-vous sûr de vouloir supprimer l\'affaire')} <strong>{selectedDeal.title}</strong> ?
              </p>
              {selectedDeal.resumes_count > 0 && (
                <p className="text-amber-600 dark:text-amber-400 text-sm mb-4">
                  ⚠️ {selectedDeal.resumes_count} CV(s) sont associés à cette affaire.
                </p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  {t('common.cancel', 'Annuler')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {saving ? t('common.deleting', 'Suppression...') : t('common.delete', 'Supprimer')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DealsTab;
