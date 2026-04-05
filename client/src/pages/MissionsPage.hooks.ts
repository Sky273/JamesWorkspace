import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useAuthFetch } from '../hooks/useAuthFetch';
import logger from '../utils/logger.frontend';

export interface Mission {
  id: string;
  Title?: string;
  Content?: string;
  Firm?: string;
  'Firm ID'?: string;
  'Created At'?: string;
  Status?: 'Active' | 'Closed' | 'Draft';
  'Client ID'?: string;
  'Client Name'?: string;
  'Client Type'?: string;
  'Contact ID'?: string;
  'Contact Name'?: string;
  'Contact Email'?: string;
  'Contact Role'?: string;
  'Deal ID'?: string;
  'Deal Title'?: string;
  'Deal Status'?: string;
  [key: string]: unknown;
}

export interface Client {
  id: string;
  name: string;
  type: string;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

export interface Deal {
  id: string;
  title: string;
  status: string;
  client_name?: string;
}

export interface MissionFormData {
  Title: string;
  Content: string;
  Status: 'Active' | 'Closed' | 'Draft';
  'Client ID': string;
  'Contact ID': string;
  'Firm ID': string;
  'Deal ID': string;
}

export interface MissionStats {
  total: number;
  firms: number;
  linkedDeals: number;
  active: number;
  draft: number;
  closed: number;
}

export type MissionViewMode = 'list' | 'byDeal';
export const MISSIONS_PAGE_SIZE = 12;

const EMPTY_FORM: MissionFormData = {
  Title: '',
  Content: '',
  Status: 'Active',
  'Client ID': '',
  'Contact ID': '',
  'Firm ID': '',
  'Deal ID': '',
};

export function useMissionsDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { authDelete, authGet, authPost, authPut } = useAuthFetch();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [, setHasMore] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [missionPendingDelete, setMissionPendingDelete] = useState<Mission | null>(null);
  const [isDeletingMission, setIsDeletingMission] = useState(false);
  const [formData, setFormData] = useState<MissionFormData>(EMPTY_FORM);
  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [viewMode, setViewMode] = useState<MissionViewMode>(
    (location.state as { viewMode?: string } | null)?.viewMode === 'list' ? 'list' : 'byDeal'
  );
  const editorReadyRef = useRef(false);

  const fetchClients = useCallback(async () => {
    try {
      setLoadingClients(true);
      const response = await authGet('/api/clients?limit=100&status=active');
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setClients(data.data || data || []);
    } catch (error) {
      logger.error('Error fetching clients:', error);
    } finally {
      setLoadingClients(false);
    }
  }, [authGet]);

  const fetchDeals = useCallback(async () => {
    try {
      setLoadingDeals(true);
      const response = await authGet('/api/deals?limit=100');
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setDeals(data.data || []);
    } catch (error) {
      logger.error('Error fetching deals:', error);
    } finally {
      setLoadingDeals(false);
    }
  }, [authGet]);

  const fetchContacts = useCallback(async (clientId: string) => {
    if (!clientId) {
      setContacts([]);
      return;
    }

    try {
      setLoadingContacts(true);
      const response = await authGet(`/api/clients/${clientId}/contacts`);
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setContacts(data || []);
    } catch (error) {
      logger.error('Error fetching contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  }, [authGet]);

  useEffect(() => {
    if (!showModal) {
      return;
    }

    void fetchClients();
    void fetchDeals();
  }, [fetchClients, fetchDeals, showModal]);

  useEffect(() => {
    if (!formData['Client ID']) {
      setContacts([]);
      return;
    }

    void fetchContacts(formData['Client ID']);
  }, [fetchContacts, formData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const fetchMissions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', String(MISSIONS_PAGE_SIZE));
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const response = await authGet(`/api/missions?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch missions');
      }

      const data = await response.json();
      if (data.data && data.pagination) {
        setMissions(data.data);
        setTotalCount(data.pagination.totalCount || data.data.length);
        setHasMore(data.pagination.hasMore || false);
      } else {
        setMissions(Array.isArray(data) ? data : []);
        setTotalCount(Array.isArray(data) ? data.length : 0);
        setHasMore(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching missions:', error);
        toast.error(t('missions.messages.loadError', 'Erreur lors du chargement des missions'));
      }
    } finally {
      setLoading(false);
    }
  }, [authGet, currentPage, debouncedSearch, t]);

  useEffect(() => {
    void fetchMissions();
  }, [fetchMissions]);

  const resetForm = useCallback(() => {
    setEditingMission(null);
    setFormData(EMPTY_FORM);
    setContacts([]);
    editorReadyRef.current = false;
  }, []);

  const openCreateModal = useCallback(() => {
    resetForm();
    setShowModal(true);
  }, [resetForm]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    resetForm();
  }, [resetForm]);

  const handleEdit = useCallback((mission: Mission) => {
    setEditingMission(mission);
    setFormData({
      Title: mission.Title || '',
      Content: mission.Content || '',
      Status: mission.Status || 'Active',
      'Client ID': mission['Client ID'] || '',
      'Contact ID': mission['Contact ID'] || '',
      'Firm ID': mission['Firm ID'] || '',
      'Deal ID': mission['Deal ID'] || '',
    });
    setShowModal(true);
  }, []);

  useEffect(() => {
    const state = location.state as { editMissionId?: string } | null;
    if (!state?.editMissionId || missions.length === 0) {
      return;
    }

    const missionToEdit = missions.find((mission) => mission.id === state.editMissionId);
    if (!missionToEdit) {
      return;
    }

    handleEdit(missionToEdit);
    navigate(location.pathname, { replace: true, state: {} });
  }, [handleEdit, location.pathname, location.state, missions, navigate]);

  const totalPages = Math.max(1, Math.ceil(totalCount / MISSIONS_PAGE_SIZE)) || 1;

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const dataToSend: Record<string, unknown> = {
        Title: formData.Title,
        Content: formData.Content,
        Status: formData.Status,
        'Client ID': formData['Client ID'] || null,
        'Contact ID': formData['Contact ID'] || null,
        'Deal ID': formData['Deal ID'] || null,
      };

      if (formData['Firm ID']) {
        dataToSend.firm_id = formData['Firm ID'];
      }

      const response = editingMission
        ? await authPut(`/api/missions/${editingMission.id}`, dataToSend)
        : await authPost('/api/missions', dataToSend);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save mission');
      }

      toast.success(editingMission ? t('missions.messages.updateSuccess', 'Mission mise a jour') : t('missions.messages.createSuccess', 'Mission creee'));
      setShowModal(false);
      resetForm();
      await fetchMissions();
    } catch (error) {
      logger.error('Error saving mission:', error);
      const errorMessage = error instanceof Error ? error.message : t('missions.messages.saveError', 'Erreur lors de la sauvegarde');
      toast.error(errorMessage);
    }
  }, [authPost, authPut, editingMission, fetchMissions, formData, resetForm, t]);

  const requestDelete = useCallback((mission: Mission) => {
    setMissionPendingDelete(mission);
  }, []);

  const cancelDelete = useCallback(() => {
    if (isDeletingMission) {
      return;
    }

    setMissionPendingDelete(null);
  }, [isDeletingMission]);

  const confirmDelete = useCallback(async () => {
    if (!missionPendingDelete?.id || isDeletingMission) {
      return;
    }

    try {
      setIsDeletingMission(true);
      const response = await authDelete(`/api/missions/${missionPendingDelete.id}`);
      if (!response.ok) {
        throw new Error('Failed to delete mission');
      }

      toast.success(t('missions.messages.deleteSuccess', 'Mission supprimée'));
      setMissionPendingDelete(null);

      const isLastMissionOnPage = missions.length === 1;
      if (isLastMissionOnPage && currentPage > 1) {
        setCurrentPage((previousPage) => previousPage - 1);
        return;
      }

      await fetchMissions();
    } catch (error) {
      logger.error('Error deleting mission:', error);
      toast.error(t('missions.messages.deleteError', 'Erreur lors de la suppression'));
    } finally {
      setIsDeletingMission(false);
    }
  }, [authDelete, currentPage, fetchMissions, isDeletingMission, missionPendingDelete, missions.length, t]);

  const deleteDialogDescription = useMemo(() => {
    if (!missionPendingDelete) {
      return '';
    }

    const missionTitle = missionPendingDelete.Title?.trim() || t('missions.untitled', 'Mission sans titre');
    return t('missions.messages.deleteConfirmNamed', { defaultValue: 'Supprimer définitivement la mission « {{title}} » ?', title: missionTitle });
  }, [missionPendingDelete, t]);

  const stats: MissionStats = {
    total: totalCount,
    firms: [...new Set(missions.map((mission) => mission.Firm).filter(Boolean))].length,
    linkedDeals: missions.filter((mission) => Boolean(mission['Deal ID'])).length,
    active: missions.filter((mission) => mission.Status === 'Active').length,
    draft: missions.filter((mission) => mission.Status === 'Draft').length,
    closed: missions.filter((mission) => mission.Status === 'Closed').length,
  };

  return {
    clients,
    closeModal,
    contacts,
    currentPage,
    deals,
    editingMission,
    fetchMissions,
    formData,
    goToPage,
    cancelDelete,
    confirmDelete,
    deleteDialogDescription,
    handleEdit,
    handleSubmit,
    loading,
    loadingClients,
    loadingContacts,
    loadingDeals,
    isDeletingMission,
    missionPendingDelete,
    missions,
    openCreateModal,
    requestDelete,
    resetSearch: () => setSearchTerm(''),
    setEditorReady: (isReady: boolean) => {
      editorReadyRef.current = isReady;
    },
    setFormData,
    setShowModal,
    setSearchTerm,
    setViewMode,
    searchTerm,
    showModal,
    stats,
    totalCount,
    totalPages,
    viewMode,
  };
}

