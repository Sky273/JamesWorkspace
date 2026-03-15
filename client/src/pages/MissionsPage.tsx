/**
 * MissionsPage Component
 * TypeScript version
 */

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BriefcaseIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useAuthFetch } from '../hooks/useAuthFetch';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import { formatDate } from '../utils/dateFormatter';
import { createSafeHtml } from '../utils/sanitizer.frontend';

import { StatsCards, SearchAndActions } from '../components/MissionsPage';
import Pagination from '../components/Pagination';
import AdminFirmSelector from '../components/AdminFirmSelector';
import { loadTinyMCE } from '../utils/lazyTinyMCE';
import { SkeletonMissionList } from '../components/ui/Skeleton';
import Breadcrumbs from '../components/Breadcrumbs';
import MissionCard from './MissionCard';
import MissionFormModal from './MissionFormModal';
import MissionPreviewModal from './MissionPreviewModal';

interface Mission {
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

interface Client {
  id: string;
  name: string;
  type: string;
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

interface Deal {
  id: string;
  title: string;
  status: string;
  client_name?: string;
}

interface FormData {
  Title: string;
  Content: string;
  Status: 'Active' | 'Closed' | 'Draft';
  'Client ID': string;
  'Contact ID': string;
  'Firm ID': string;
  'Deal ID': string;
}

interface Stats {
  total: number;
  firms: number;
}

// TinyMCE types are declared in src/types/tinymce.d.ts

const MissionsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { authGet, authPost, authPut, authDelete } = useAuthFetch();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  
  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const pageSize = 12;
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [formData, setFormData] = useState<FormData>({
    Title: '',
    Content: '',
    Status: 'Active',
    'Client ID': '',
    'Contact ID': '',
    'Firm ID': '',
    'Deal ID': ''
  });
  const editorRef = useRef<{ setContent: (content: string) => void; getContent: () => string } | null>(null);
  const [editorReady, setEditorReady] = useState<boolean>(false);
  const [tinymceLoaded, setTinymceLoaded] = useState<boolean>(false);
  const [previewMission, setPreviewMission] = useState<Mission | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingClients, setLoadingClients] = useState<boolean>(false);
  const [loadingContacts, setLoadingContacts] = useState<boolean>(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    loadTinyMCE()
      .then(() => {
        if (mounted) setTinymceLoaded(true);
      })
      .catch((err) => {
        logger.error('Failed to load TinyMCE:', err);
      });
    return () => { mounted = false; };
  }, []);

  // Fetch clients when modal opens
  const fetchClients = useCallback(async (): Promise<void> => {
    try {
      setLoadingClients(true);
      const response = await authGet('/api/clients?limit=100&status=active');
      if (response.ok) {
        const data = await response.json();
        setClients(data.data || data || []);
      }
    } catch (error) {
      logger.error('Error fetching clients:', error);
    } finally {
      setLoadingClients(false);
    }
  }, [authGet]);

  // Fetch deals
  const fetchDeals = useCallback(async (): Promise<void> => {
    try {
      setLoadingDeals(true);
      const response = await authGet('/api/deals?limit=100');
      if (response.ok) {
        const data = await response.json();
        setDeals(data.data || []);
      }
    } catch (error) {
      logger.error('Error fetching deals:', error);
    } finally {
      setLoadingDeals(false);
    }
  }, [authGet]);

  // Fetch contacts when client changes
  const fetchContacts = useCallback(async (clientId: string): Promise<void> => {
    if (!clientId) {
      setContacts([]);
      return;
    }
    try {
      setLoadingContacts(true);
      const response = await authGet(`/api/clients/${clientId}/contacts`);
      if (response.ok) {
        const data = await response.json();
        setContacts(data || []);
      }
    } catch (error) {
      logger.error('Error fetching contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  }, [authGet]);

  // Load clients and deals when modal opens
  useEffect(() => {
    if (showModal) {
      fetchClients();
      fetchDeals();
    }
  }, [showModal, fetchClients, fetchDeals]);

  // Load contacts when client changes
  useEffect(() => {
    if (formData['Client ID']) {
      fetchContacts(formData['Client ID']);
    } else {
      setContacts([]);
    }
  }, [formData['Client ID'], fetchContacts]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchMissions = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', pageSize.toString());
      if (debouncedSearch) params.append('search', debouncedSearch);

      const response = await authGet(`/api/missions?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch missions');
      const data = await response.json();
      
      // Handle paginated response
      if (data.data && data.pagination) {
        setMissions(data.data);
        setTotalCount(data.pagination.totalCount || data.data.length);
        setHasMore(data.pagination.hasMore || false);
      } else {
        // Fallback for non-paginated response
        setMissions(Array.isArray(data) ? data : []);
        setTotalCount(Array.isArray(data) ? data.length : 0);
        setHasMore(false);
      }
    } catch (error) {
      // Don't log or show toast for session expiration - user will be redirected
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching missions:', error);
        toast.error('Erreur lors du chargement des missions');
      }
    } finally {
      setLoading(false);
    }
  }, [authGet, currentPage, debouncedSearch]);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  // Handle navigation state for editing a mission from MissionViewPage
  useEffect(() => {
    const state = location.state as { editMissionId?: string } | null;
    if (state?.editMissionId && missions.length > 0) {
      const missionToEdit = missions.find(m => m.id === state.editMissionId);
      if (missionToEdit) {
        handleEdit(missionToEdit);
        // Clear the state to prevent re-opening on refresh
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, missions, navigate, location.pathname]);

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / pageSize);

  // Pagination handler
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    try {
      // Prepare data - convert empty strings to null for optional fields
      const dataToSend: Record<string, unknown> = {
        Title: formData.Title,
        Content: formData.Content,
        Status: formData.Status,
        'Client ID': formData['Client ID'] || null,
        'Contact ID': formData['Contact ID'] || null,
        'Deal ID': formData['Deal ID'] || null
      };
      
      // Add firm_id if admin selected a firm (for both new and edited missions)
      if (formData['Firm ID']) {
        dataToSend['firm_id'] = formData['Firm ID'];
      }

      const response = editingMission
        ? await authPut(`/api/missions/${editingMission.id}`, dataToSend)
        : await authPost('/api/missions', dataToSend);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save mission');
      }

      toast.success(editingMission ? 'Mission mise à jour' : 'Mission créée');
      setShowModal(false);
      resetForm();
      fetchMissions();
    } catch (error) {
      logger.error('Error saving mission:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la sauvegarde';
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette mission ?')) {
      return;
    }
    try {
      const response = await authDelete(`/api/missions/${id}`);
      if (!response.ok) throw new Error('Failed to delete mission');
      toast.success('Mission supprimée');
      fetchMissions();
    } catch (error) {
      logger.error('Error deleting mission:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleEdit = (mission: Mission): void => {
    setEditingMission(mission);
    setFormData({
      Title: mission.Title || '',
      Content: mission.Content || '',
      Status: mission.Status || 'Active',
      'Client ID': mission['Client ID'] || '',
      'Contact ID': mission['Contact ID'] || '',
      'Firm ID': mission['Firm ID'] || '',
      'Deal ID': mission['Deal ID'] || ''
    });
    setShowModal(true);
  };

  const resetForm = (): void => {
    setEditingMission(null);
    setFormData({ Title: '', Content: '', Status: 'Active', 'Client ID': '', 'Contact ID': '', 'Firm ID': '', 'Deal ID': '' });
    setContacts([]);
    const tinymce = window.tinymce as unknown as { init: (config: Record<string, unknown>) => void; get: (id: string) => { remove: () => void; getContent: () => string; setContent: (content: string) => void } | null } | undefined;
    if (tinymce && tinymce.get('missionContentEditor')) {
      tinymce.get('missionContentEditor')?.remove();
    }
    setEditorReady(false);
  };

  // No client-side filtering needed - server handles it
  const filteredMissions = missions;

  const formatMissionDate = (dateString?: string): string => {
    return formatDate(dateString, 'medium') || 'Non définie';
  };

  useEffect(() => {
    const tinymce = window.tinymce as unknown as { init: (config: Record<string, unknown>) => void; get: (id: string) => { remove: () => void; getContent: () => string; setContent: (content: string) => void } | null } | undefined;
    if (!showModal || !tinymceLoaded || !tinymce) return;

    const initEditor = async (): Promise<void> => {
      try {
        if (tinymce.get('missionContentEditor')) {
          tinymce.get('missionContentEditor')?.remove();
        }
        await new Promise(resolve => setTimeout(resolve, 100));

        await tinymce.init({
          selector: '#missionContentEditor',
          height: 400,
          menubar: false,
          plugins: [
            'advlist', 'autolink', 'lists', 'link', 'charmap', 'preview',
            'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'table', 'help', 'wordcount'
          ],
          toolbar: 'undo redo | formatselect | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link | removeformat | code | help',
          content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 14px; }',
          branding: false,
          promotion: false,
          license_key: 'gpl',
          setup: (editor: { on: (event: string, callback: () => void) => void; setContent: (content: string) => void; getContent: () => string }) => {
            editorRef.current = editor;
            editor.on('init', () => {
              setEditorReady(true);
              editor.setContent(formData.Content || '');
            });
            editor.on('change', () => {
              setFormData(prev => ({ ...prev, Content: editor.getContent() }));
            });
          }
        });
      } catch (error) {
        logger.error('TinyMCE initialization error:', error);
        toast.error('Erreur lors de l\'initialisation de l\'éditeur');
      }
    };

    initEditor();

    return () => {
      const tinymceCleanup = window.tinymce as unknown as { get: (id: string) => { remove: () => void } | null } | undefined;
      if (tinymceCleanup && tinymceCleanup.get('missionContentEditor')) {
        tinymceCleanup.get('missionContentEditor')?.remove();
      }
    };
  }, [showModal, tinymceLoaded]);

  useEffect(() => {
    if (editorReady && editorRef.current && showModal) {
      const currentContent = editorRef.current.getContent();
      if (currentContent !== formData.Content) {
        editorRef.current.setContent(formData.Content || '');
      }
    }
  }, [formData.Content, editorReady, showModal]);

  const stats: Stats = {
    total: missions.length,
    firms: [...new Set(missions.map(m => m.Firm).filter(Boolean))].length
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-6 max-w-7xl mx-auto"
    >
      <Breadcrumbs className="mb-4" />
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {t('missions.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('missions.subtitle')}
        </p>
      </div>

      <StatsCards stats={stats} missionsCount={totalCount} t={t} />

      <SearchAndActions
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onRefresh={fetchMissions}
        onAddMission={() => { resetForm(); setShowModal(true); }}
        onReset={() => setSearchTerm('')}
        t={t}
      />

      {/* Top pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
        loading={loading}
        itemName={t('missions.results')}
      />

      {loading ? (
        <SkeletonMissionList count={6} />
      ) : filteredMissions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <BriefcaseIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('missions.noMissions')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm ? t('missions.noResults') : t('missions.createFirst')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMissions.map((mission, index) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              index={index}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Pagination controls */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
        loading={loading}
        itemName={t('missions.results')}
      />

      {previewMission && (
        <MissionPreviewModal
          mission={previewMission}
          onClose={() => setPreviewMission(null)}
          onEdit={handleEdit}
        />
      )}

      {showModal && (
        <MissionFormModal
          isEditing={!!editingMission}
          formData={formData}
          setFormData={setFormData}
          clients={clients}
          contacts={contacts}
          deals={deals}
          loadingClients={loadingClients}
          loadingContacts={loadingContacts}
          loadingDeals={loadingDeals}
          onSubmit={handleSubmit}
          onClose={() => { setShowModal(false); resetForm(); }}
        />
      )}
    </motion.div>
  );
};

export default MissionsPage;
