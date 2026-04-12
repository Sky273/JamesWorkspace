import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useScopedViewRefresh } from '../hooks/useScopedViewRefresh';
import { useAuthFetch } from '../hooks/useAuthFetch';
import logger from '../utils/logger.frontend';
import { markViewScopesDirty } from '../utils/viewRefresh';
import {
  buildMissionFormData,
  buildMissionsSearchParams,
  buildMissionSubmitPayload,
  canDeleteMission,
  computeMissionStats,
  EMPTY_MISSION_FORM,
  getInitialMissionViewMode,
  mergePreservedMissionIntoResults,
  type Client,
  type Contact,
  type Deal,
  type Mission,
  type MissionFormData,
  type MissionStats,
  type MissionViewMode,
} from './MissionsPage.data';
export const MISSIONS_PAGE_SIZE = 12;
export type {
  Client,
  Contact,
  Deal,
  Mission,
  MissionFormData,
  MissionStats,
  MissionViewMode,
};
type FetchMissionsOptions = {
  page?: number;
  search?: string;
  forceRefresh?: boolean;
  preserveMission?: Mission | null;
};

export function useMissionsDashboard() {
  const refreshConsumerId = 'missions-page';
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
  const [formData, setFormData] = useState<MissionFormData>(EMPTY_MISSION_FORM);
  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [viewMode, setViewMode] = useState<MissionViewMode>(
    getInitialMissionViewMode((location.state as { viewMode?: string } | null)?.viewMode)
  );
  const [groupedRefreshToken, setGroupedRefreshToken] = useState(0);
  const editorReadyRef = useRef(false);
  const clientsRequestIdRef = useRef(0);
  const dealsRequestIdRef = useRef(0);
  const contactsRequestIdRef = useRef(0);
  const missionsRequestIdRef = useRef(0);

  const fetchClients = useCallback(async () => {
    const requestId = ++clientsRequestIdRef.current;
    try {
      setLoadingClients(true);
      const response = await authGet('/api/clients?limit=100&status=active');
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (requestId !== clientsRequestIdRef.current) {
        return;
      }
      setClients(data.data || data || []);
    } catch (error) {
      if (requestId !== clientsRequestIdRef.current) {
        return;
      }
      logger.error('Error fetching clients:', error);
    } finally {
      if (requestId === clientsRequestIdRef.current) {
        setLoadingClients(false);
      }
    }
  }, [authGet]);

  const fetchDeals = useCallback(async () => {
    const requestId = ++dealsRequestIdRef.current;
    try {
      setLoadingDeals(true);
      const response = await authGet('/api/deals?limit=100');
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (requestId !== dealsRequestIdRef.current) {
        return;
      }
      setDeals(data.data || []);
    } catch (error) {
      if (requestId !== dealsRequestIdRef.current) {
        return;
      }
      logger.error('Error fetching deals:', error);
    } finally {
      if (requestId === dealsRequestIdRef.current) {
        setLoadingDeals(false);
      }
    }
  }, [authGet]);

  const fetchContacts = useCallback(async (clientId: string) => {
    if (!clientId) {
      contactsRequestIdRef.current += 1;
      setContacts([]);
      return;
    }

    const requestId = ++contactsRequestIdRef.current;
    try {
      setLoadingContacts(true);
      const response = await authGet(`/api/clients/${clientId}/contacts`);
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (requestId !== contactsRequestIdRef.current) {
        return;
      }
      setContacts(data || []);
    } catch (error) {
      if (requestId !== contactsRequestIdRef.current) {
        return;
      }
      logger.error('Error fetching contacts:', error);
    } finally {
      if (requestId === contactsRequestIdRef.current) {
        setLoadingContacts(false);
      }
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

  const fetchMissions = useCallback(async (options: FetchMissionsOptions = {}) => {
    const requestId = ++missionsRequestIdRef.current;
    const effectivePage = options.page ?? currentPage;
    const effectiveSearch = options.search ?? debouncedSearch;
    try {
      setLoading(true);
      const params = buildMissionsSearchParams(effectivePage, MISSIONS_PAGE_SIZE, effectiveSearch);
      if (options.forceRefresh) {
        params.set('refresh', '1');
      }

      const response = await authGet(`/api/missions?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch missions');
      }

      const data = await response.json();
      if (requestId !== missionsRequestIdRef.current) {
        return;
      }
      if (data.data && data.pagination) {
        setMissions(mergePreservedMissionIntoResults(data.data, options.preserveMission, MISSIONS_PAGE_SIZE));
        setTotalCount(data.pagination.totalCount || data.data.length);
        setHasMore(data.pagination.hasMore || false);
      } else {
        const nextMissions = Array.isArray(data) ? data : [];
        setMissions(mergePreservedMissionIntoResults(nextMissions, options.preserveMission, MISSIONS_PAGE_SIZE));
        setTotalCount(nextMissions.length);
        setHasMore(false);
      }
    } catch (error) {
      if (requestId !== missionsRequestIdRef.current) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching missions:', error);
        toast.error(t('missions.messages.loadError', 'Erreur lors du chargement des missions'));
      }
    } finally {
      if (requestId === missionsRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [authGet, currentPage, debouncedSearch, t]);

  useEffect(() => {
    void fetchMissions();
  }, [fetchMissions]);

  useScopedViewRefresh({
    consumerId: refreshConsumerId,
    scopes: ['missions'],
    onRefresh: () => {
      setGroupedRefreshToken((currentToken) => currentToken + 1);
      void fetchMissions({ forceRefresh: true });
    },
  });

  const resetForm = useCallback(() => {
    setEditingMission(null);
    setFormData(EMPTY_MISSION_FORM);
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
    setFormData(buildMissionFormData(mission));
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
      const dataToSend = buildMissionSubmitPayload(formData);

      const response = editingMission
        ? await authPut(`/api/missions/${editingMission.id}`, dataToSend)
        : await authPost('/api/missions', dataToSend);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save mission');
      }

      const result = await response.json().catch(() => null);
      const missionRecord = result?.data || result;
      missionsRequestIdRef.current += 1;
      if (missionRecord?.id) {
        setMissions((currentMissions) => {
          const existingMission = currentMissions.some((mission) => mission.id === missionRecord.id);
          if (existingMission) {
            return currentMissions.map((mission) => (mission.id === missionRecord.id ? missionRecord : mission));
          }

          return [missionRecord, ...currentMissions].slice(0, MISSIONS_PAGE_SIZE);
        });
        if (!editingMission) {
          setTotalCount((currentTotal) => currentTotal + 1);
        }
      }

      toast.success(editingMission ? t('missions.messages.updateSuccess', 'Mission mise a jour') : t('missions.messages.createSuccess', 'Mission creee'));
      markViewScopesDirty(['missions', 'resumes', 'adaptations']);
      setShowModal(false);
      resetForm();
      setGroupedRefreshToken((currentToken) => currentToken + 1);
      const nextPage = editingMission ? currentPage : 1;
      if (nextPage !== currentPage) {
        setCurrentPage(nextPage);
      }
      await fetchMissions({ page: nextPage, forceRefresh: true, preserveMission: missionRecord });
    } catch (error) {
      logger.error('Error saving mission:', error);
      const errorMessage = error instanceof Error ? error.message : t('missions.messages.saveError', 'Erreur lors de la sauvegarde');
      toast.error(errorMessage);
    }
  }, [authPost, authPut, currentPage, editingMission, fetchMissions, formData, resetForm, t]);

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
      const missionId = missionPendingDelete.id;
      const response = await authDelete(`/api/missions/${missionId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete mission');
      }

      toast.success(t('missions.messages.deleteSuccess', 'Mission supprimée'));
      markViewScopesDirty(['missions', 'resumes', 'adaptations']);
      missionsRequestIdRef.current += 1;
      setMissions((currentMissions) => currentMissions.filter((mission) => mission.id !== missionId));
      setTotalCount((currentTotal) => Math.max(0, currentTotal - 1));
      setMissionPendingDelete(null);
      setGroupedRefreshToken((currentToken) => currentToken + 1);

      const isLastMissionOnPage = missions.length === 1;
      if (isLastMissionOnPage && currentPage > 1) {
        setCurrentPage((previousPage) => previousPage - 1);
        return;
      }

      await fetchMissions({ forceRefresh: true });
    } catch (error) {
      logger.error('Error deleting mission:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : t('missions.messages.deleteError', 'Erreur lors de la suppression');
      toast.error(errorMessage);
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

  const stats = useMemo(() => computeMissionStats(missions, totalCount), [missions, totalCount]);

  const refreshMissions = useCallback(async (): Promise<void> => {
    const normalizedSearch = searchTerm.trim();
    const nextPage = normalizedSearch === debouncedSearch ? currentPage : 1;

    missionsRequestIdRef.current += 1;
    if (normalizedSearch !== debouncedSearch) {
      setDebouncedSearch(normalizedSearch);
    }
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage);
    }

    await fetchMissions({ page: nextPage, search: normalizedSearch, forceRefresh: true });
  }, [currentPage, debouncedSearch, fetchMissions, searchTerm]);

  return {
    clients,
    closeModal,
    contacts,
    currentPage,
    deals,
    editingMission,
    fetchMissions: refreshMissions,
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
    canDeleteMission,
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
    groupedRefreshToken,
  };
}

