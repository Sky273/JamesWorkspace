/**
 * MissionsPage Component
 * TypeScript version
 */

import { useState, useEffect, useRef, useCallback, FormEvent, ChangeEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  PencilSquareIcon, 
  TrashIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  XMarkIcon,
  EyeIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useAuthFetch } from '../hooks/useAuthFetch';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import { formatDate } from '../utils/dateFormatter';
import { createSafeHtml } from '../utils/sanitizer.frontend';

import { StatsCards, SearchAndActions } from '../components/MissionsPage';
import Pagination from '../components/Pagination';
import { loadTinyMCE } from '../utils/lazyTinyMCE';
import { SkeletonMissionList } from '../components/ui/Skeleton';
import Breadcrumbs from '../components/Breadcrumbs';

interface Mission {
  id: string;
  Title?: string;
  Content?: string;
  Firm?: string;
  'Created At'?: string;
  Status?: 'Active' | 'Closed' | 'Draft';
  'Client ID'?: string;
  'Client Name'?: string;
  'Client Type'?: string;
  'Contact ID'?: string;
  'Contact Name'?: string;
  'Contact Email'?: string;
  'Contact Role'?: string;
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

interface FormData {
  Title: string;
  Content: string;
  Status: 'Active' | 'Closed' | 'Draft';
  'Client ID': string;
  'Contact ID': string;
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
    'Contact ID': ''
  });
  const editorRef = useRef<{ setContent: (content: string) => void; getContent: () => string } | null>(null);
  const [editorReady, setEditorReady] = useState<boolean>(false);
  const [tinymceLoaded, setTinymceLoaded] = useState<boolean>(false);
  const [previewMission, setPreviewMission] = useState<Mission | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingClients, setLoadingClients] = useState<boolean>(false);
  const [loadingContacts, setLoadingContacts] = useState<boolean>(false);

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

  // Load clients when modal opens
  useEffect(() => {
    if (showModal) {
      fetchClients();
    }
  }, [showModal, fetchClients]);

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
      const dataToSend = {
        Title: formData.Title,
        Content: formData.Content,
        Status: formData.Status,
        'Client ID': formData['Client ID'] || null,
        'Contact ID': formData['Contact ID'] || null
      };

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
      'Contact ID': mission['Contact ID'] || ''
    });
    setShowModal(true);
  };

  const resetForm = (): void => {
    setEditingMission(null);
    setFormData({ Title: '', Content: '', Status: 'Active', 'Client ID': '', 'Contact ID': '' });
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
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {mission.Title}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        mission.Status === 'Closed' 
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : mission.Status === 'Draft'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {t(`missions.status.${mission.Status || 'Active'}`)}
                      </span>
                    </div>
                    {/* Client/Prospect info */}
                    {mission['Client Name'] && (
                      <div className="flex items-center gap-1 mt-1">
                        <BuildingOfficeIcon className="w-4 h-4 text-purple-500" />
                        <span className="text-sm text-purple-600 dark:text-purple-400 font-medium truncate">
                          {mission['Client Name']}
                        </span>
                        <span className={`ml-1 px-1.5 py-0.5 text-xs rounded ${
                          mission['Client Type'] === 'prospect' 
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {mission['Client Type'] === 'prospect' ? t('clients.prospect', 'Prospect') : t('clients.client', 'Client')}
                        </span>
                      </div>
                    )}
                    {/* Contact info */}
                    {mission['Contact Name'] && (
                      <div className="flex items-center gap-1 mt-1">
                        <UserIcon className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600 dark:text-green-400 truncate">
                          {mission['Contact Name']}
                          {mission['Contact Role'] && <span className="text-gray-400 dark:text-gray-500"> - {mission['Contact Role']}</span>}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4">
                {mission.Content ? (
                  <div 
                    className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={createSafeHtml(mission.Content)}
                  />
                ) : (
                  <p className="text-sm text-gray-400 italic">{t('missions.noDescription')}</p>
                )}
              </div>

              <div className="flex items-center gap-2 p-4 pt-0">
                <button
                  onClick={() => navigate(`/missions/${mission.id}`)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <EyeIcon className="w-4 h-4" />
                  {t('missions.view')}
                </button>
                <button
                  onClick={() => handleEdit(mission)}
                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  title={t('common.edit')}
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(mission.id)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  title={t('common.delete')}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {previewMission.Title}
                </h3>
                {previewMission.Firm && (
                  <p className="text-sm text-blue-600 dark:text-blue-400">{previewMission.Firm}</p>
                )}
              </div>
              <button onClick={() => setPreviewMission(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[60vh]">
              {previewMission.Content ? (
                <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={createSafeHtml(previewMission.Content)} />
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">{t('missions.noDescription')}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setPreviewMission(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                {t('common.close')}
              </button>
              <button onClick={() => { handleEdit(previewMission); setPreviewMission(null); }} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                <PencilSquareIcon className="w-4 h-4" />
                {t('common.edit')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingMission ? t('missions.editMission') : t('missions.addMission')}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('missions.missionTitle')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.Title}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, Title: e.target.value })}
                    placeholder={t('missions.titlePlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('missions.missionStatus')}
                  </label>
                  <select
                    value={formData.Status}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, Status: e.target.value as 'Active' | 'Closed' | 'Draft' })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Active">{t('missions.status.Active')}</option>
                    <option value="Draft">{t('missions.status.Draft')}</option>
                    <option value="Closed">{t('missions.status.Closed')}</option>
                  </select>
                </div>
              </div>

              {/* Client and Contact Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('missions.client', 'Client / Prospect')}
                  </label>
                  <select
                    value={formData['Client ID']}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                      setFormData({ ...formData, 'Client ID': e.target.value, 'Contact ID': '' });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    disabled={loadingClients}
                  >
                    <option value="">{loadingClients ? t('common.loading', 'Chargement...') : t('missions.selectClient', 'Sélectionner un client')}</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} ({client.type === 'prospect' ? t('clients.prospect', 'Prospect') : t('clients.client', 'Client')})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('missions.contact', 'Interlocuteur')}
                  </label>
                  <select
                    value={formData['Contact ID']}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, 'Contact ID': e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    disabled={!formData['Client ID'] || loadingContacts}
                  >
                    <option value="">
                      {!formData['Client ID'] 
                        ? t('missions.selectClientFirst', 'Sélectionner d\'abord un client') 
                        : loadingContacts 
                        ? t('common.loading', 'Chargement...') 
                        : t('missions.selectContact', 'Sélectionner un interlocuteur')}
                    </option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}{contact.role ? ` - ${contact.role}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('missions.missionContent')} *
                </label>
                <div id="missionContentEditor" className="border border-gray-300 dark:border-gray-600 rounded-lg"></div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {t('missions.editorHelp')}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                  {editingMission ? t('missions.update') : t('missions.create')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default MissionsPage;
