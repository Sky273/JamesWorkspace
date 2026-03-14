/**
 * Adaptations Page Component
 * TypeScript version
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SparklesIcon, EyeIcon, ArrowDownTrayIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAuthFetch } from '../hooks/useAuthFetch';
import resumeAdaptationService from '../utils/resumeAdaptationService';
import { templateService } from '../utils/templateService';
import toast from 'react-hot-toast';
import { createSafeHtml } from '../utils/sanitizer.frontend';
import ExportModal from './AdaptationsPage_ExportModal';
import AdaptationAnalysisView from '../components/AdaptationAnalysisView';
import { createAuthOptionsWithCsrf, fetchWithAuth } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';
import { formatDateTime } from '../utils/dateFormatter';

import { StatsCards, SearchAndFilters } from '../components/AdaptationsPage';
import Pagination from '../components/Pagination';
import { loadTinyMCE } from '../utils/lazyTinyMCE';
import { SkeletonAdaptationList } from '../components/ui/Skeleton';
import Breadcrumbs from '../components/Breadcrumbs';
import { removeSuggestionMarkers } from '../utils/tinymceSuggestionsPlugin';

interface Adaptation {
  id: string;
  Resume?: string[];
  Mission?: string[];
  'Resume ID'?: string;
  'Mission ID'?: string;
  'Resume Name'?: string;
  'Candidate Name'?: string;
  'Adapted Title'?: string;
  'Adapted Text'?: string;
  'Match Score'?: number;
  'Match Analysis'?: string;
  'Mission Title'?: string;
  'Mission Content'?: string;
  Status?: string;
  'Created At'?: string;
  [key: string]: unknown;
}

interface Resume {
  id: string;
  Name?: string;
  Title?: string;
  [key: string]: unknown;
}

interface Mission {
  id: string;
  Title?: string;
  Content?: string;
  Client?: string;
  Location?: string;
  [key: string]: unknown;
}

interface Template {
  id: string;
  Name: string;
  Status?: string;
  TemplateContent?: string;
  Stylesheet?: string;
  HeaderContent?: string;
  FooterContent?: string;
  FooterHeight?: number;
}

interface Stats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  avgScore: number;
}

const AdaptationsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authGet } = useAuthFetch();
  const [adaptations, setAdaptations] = useState<Adaptation[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const pageSize = 12;
  const [selectedAdaptation, setSelectedAdaptation] = useState<Adaptation | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('analysis');
  const [editedAdaptedText, setEditedAdaptedText] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const editorRef = useRef<any>(null);
  const [editorReady, setEditorReady] = useState<boolean>(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState<boolean>(false);
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [adaptationToExport, setAdaptationToExport] = useState<Adaptation | null>(null);
  const [tinymceLoaded, setTinymceLoaded] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    loadTinyMCE().then(() => { if (mounted) setTinymceLoaded(true); }).catch((err) => { logger.error('Failed to load TinyMCE:', err); });
    return () => { mounted = false; };
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  useEffect(() => { fetchData(); fetchTemplates(); }, [currentPage, debouncedSearch, filterStatus]);

  const fetchTemplates = async (): Promise<void> => {
    try {
      setLoadingTemplates(true);
      const fetchedTemplates = await templateService.getAllTemplates();
      setTemplates(fetchedTemplates.filter((t: Template) => t.Status === 'Active'));
      if (fetchedTemplates.length > 0) setSelectedTemplate(fetchedTemplates[0].id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching templates:', error);
        toast.error('Erreur lors du chargement des templates');
      }
    } finally {
      setLoadingTemplates(false);
    }
  };

  const fetchData = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Build query params for adaptations
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', pageSize.toString());
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filterStatus && filterStatus !== 'all') params.append('status', filterStatus);

      const [adaptationsRes, resumesRes, missionsRes] = await Promise.all([
        authGet(`/api/adaptations?${params.toString()}`),
        authGet('/api/resumes?limit=100'),
        authGet('/api/missions?limit=100')
      ]);
      
      // Handle paginated adaptations response
      if (adaptationsRes.ok) {
        const data = await adaptationsRes.json();
        if (data.data && data.pagination) {
          setAdaptations(data.data);
          setTotalCount(data.pagination.totalCount || data.data.length);
          setHasMore(data.pagination.hasMore || false);
        } else {
          setAdaptations(Array.isArray(data) ? data : []);
          setTotalCount(Array.isArray(data) ? data.length : 0);
          setHasMore(false);
        }
      }
      
      // Handle resumes and missions (for dropdowns)
      if (resumesRes.ok) { 
        const resumesData = await resumesRes.json(); 
        setResumes(resumesData.data || resumesData); 
      }
      if (missionsRes.ok) { 
        const missionsData = await missionsRes.json(); 
        setMissions(missionsData.data || missionsData); 
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching data:', error);
        toast.error('Erreur lors du chargement des adaptations');
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / pageSize);

  // Pagination handler
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleDelete = async (adaptationId: string): Promise<void> => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette adaptation ?')) return;
    try {
      await resumeAdaptationService.deleteAdaptation(adaptationId);
      setAdaptations(adaptations.filter(a => a.id !== adaptationId));
      toast.success('Adaptation supprimée');
    } catch (error) {
      logger.error('Error deleting adaptation:', error);
      toast.error(t('adaptations.messages.deleteError'));
    }
  };

  const handleView = (adaptation: Adaptation): void => {
    setSelectedAdaptation(adaptation);
    setEditedAdaptedText(adaptation['Adapted Text'] || '');
    setShowDetailModal(true);
    setActiveTab('mission');
    setEditorReady(false);
  };

  const handleExportPDF = (adaptation: Adaptation): void => {
    setAdaptationToExport(adaptation);
    setShowExportModal(true);
  };

  const handleConfirmExport = async (): Promise<void> => {
    if (!adaptationToExport || !selectedTemplate) { toast.error('Veuillez sélectionner un template'); return; }
    try {
      setExportLoading(true);
      const template = await templateService.getTemplateById(selectedTemplate);
      if (!template) throw new Error('Template not found');

      const resumeId = adaptationToExport.Resume?.[0];
      const resume = resumes.find(r => r.id === resumeId);
      const candidateName = adaptationToExport['Candidate Name'] || resume?.Name || 'Candidat';
      const candidateTitle = adaptationToExport['Adapted Title'] || resume?.Title || 'Titre Professionnel';
      const customerName = resume?.CustomerName || '';
      // Clean suggestion markers from content before export
      const rawContent = adaptationToExport['Adapted Text'] || '';
      const content = removeSuggestionMarkers(rawContent);
      
      // Use trigram if anonymized, otherwise use candidate name
      const isAnonymized = resume?.Anonymized === true || resume?.Anonymized === 'true';
      const exportName: string = isAnonymized 
        ? (resume?.Trigram as string || candidateName.substring(0, 3).toUpperCase())
        : candidateName;
      
      // Format: CandidateName_CustomerName (no spaces, no dashes)
      const baseFilename = customerName 
        ? `${exportName}_${customerName}`
        : exportName;
      
      const simplifiedFilename = baseFilename.replace(/[^a-zA-Z0-9_]/g, '') + '.pdf';

      const stylesheet = template.Stylesheet || '';
      
      // Process body content
      let processedBody = template.TemplateContent || '';
      processedBody = processedBody.replace(/-name-/g, candidateName);
      processedBody = processedBody.replace(/-title-/g, candidateTitle);
      processedBody = processedBody.replace(/-content-/g, content);
      
      // Process header content (if exists)
      let processedHeader = template.HeaderContent || '';
      if (processedHeader) {
        processedHeader = processedHeader.replace(/-name-/g, candidateName);
        processedHeader = processedHeader.replace(/-title-/g, candidateTitle);
      }
      
      // Process footer content (if exists)
      let processedFooter = template.FooterContent || '';
      if (processedFooter) {
        processedFooter = processedFooter.replace(/-name-/g, candidateName);
        processedFooter = processedFooter.replace(/-title-/g, candidateTitle);
      }

      const response = await fetchWithAuth('/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ 
          htmlContent: processedBody, 
          filename: simplifiedFilename,
          stylesheet: stylesheet,
          headerContent: processedHeader || undefined,
          footerContent: processedFooter || undefined,
          footerHeight: template.FooterHeight || 25
        })
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Clean filename: remove all non-alphanumeric except underscores
      a.download = `${baseFilename.replace(/[^a-zA-Z0-9_]/g, '')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF exporté avec succès');
      setShowExportModal(false);
      setAdaptationToExport(null);
    } catch (error) {
      logger.error('Error exporting PDF:', error);
      toast.error('Erreur lors de l\'export PDF');
    } finally {
      setExportLoading(false);
    }
  };

  const getResumeName = (adaptation: Adaptation): string => {
    // First try direct field from API
    if (adaptation['Resume Name']) return adaptation['Resume Name'];
    // Fallback to lookup by Resume ID or linked array
    const resumeId = adaptation['Resume ID'] || (adaptation.Resume && adaptation.Resume[0]);
    if (resumeId) {
      const resume = resumes.find(r => r.id === resumeId);
      if (resume?.Name) return resume.Name;
    }
    return t('adaptations.card.noName');
  };

  const getMissionTitle = (adaptation: Adaptation): string => {
    // First try direct field from API
    if (adaptation['Mission Title']) return adaptation['Mission Title'];
    // Fallback to lookup by Mission ID or linked array
    const missionId = adaptation['Mission ID'] || (adaptation.Mission && adaptation.Mission[0]);
    if (missionId) {
      const mission = missions.find(m => m.id === missionId);
      if (mission?.Title) return mission.Title;
    }
    return t('adaptations.card.unknownMission');
  };

  const getMissionData = (missionLinks?: string[]): Mission | null => {
    if (!missionLinks || missionLinks.length === 0) return null;
    const missionId = missionLinks[0];
    return missions.find(m => m.id === missionId) || null;
  };

  const initEditor = useCallback((): void => {
    const tinymce = window.tinymce as unknown as { init: (config: Record<string, unknown>) => void; get: (id: string) => { remove: () => void; getContent: () => string; setContent: (content: string) => void; on: (event: string, callback: () => void) => void } | null } | undefined;
    if (tinymceLoaded && tinymce && activeTab === 'adapted' && showDetailModal) {
      try {
        const existingEditor = tinymce.get('adaptedCVEditor');
        if (existingEditor) existingEditor.remove();
        
        tinymce.init({
          selector: '#adaptedCVEditor',
          license_key: 'gpl',
          height: 500,
          menubar: true,
          plugins: 'advlist autolink lists link charmap preview code fullscreen table wordcount',
          toolbar: 'undo redo | formatselect | bold italic | alignleft aligncenter alignright | bullist numlist | link | code fullscreen',
          content_style: 'body { font-family: Arial, sans-serif; font-size: 14px; }',
          setup: (editor: { on: (event: string, callback: () => void) => void; setContent: (content: string) => void; getContent: () => string }) => {
            editorRef.current = editor;
            editor.on('init', () => { setEditorReady(true); editor.setContent(editedAdaptedText || ''); });
            editor.on('change', () => { setEditedAdaptedText(editor.getContent()); });
          }
        });
      } catch (error) {
        logger.error('Error initializing TinyMCE:', error);
      }
    }
  }, [tinymceLoaded, activeTab, showDetailModal, editedAdaptedText]);

  useEffect(() => {
    if (activeTab === 'adapted' && showDetailModal) {
      const timer = setTimeout(() => { initEditor(); }, 100);
      return () => clearTimeout(timer);
    }
    return () => {
      const tinymce = window.tinymce as unknown as { init: (config: Record<string, unknown>) => void; get: (id: string) => { remove: () => void; getContent: () => string; setContent: (content: string) => void; on: (event: string, callback: () => void) => void } | null } | undefined;
      if (tinymce) { const editor = tinymce.get('adaptedCVEditor'); if (editor) editor.remove(); }
      editorRef.current = null;
      setEditorReady(false);
    };
  }, [activeTab, showDetailModal, initEditor]);

  const handleSaveAdaptedCV = async (): Promise<void> => {
    if (!selectedAdaptation || !editorRef.current) return;
    setIsSaving(true);
    try {
      const content = editorRef.current.getContent();
      const authOptions = await createAuthOptionsWithCsrf({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ 'Adapted Text': content }) });
      const response = await fetchWithAuth(`/api/adaptations/${selectedAdaptation.id}`, authOptions);
      if (!response.ok) throw new Error('Failed to save adapted CV');
      setAdaptations(adaptations.map(a => a.id === selectedAdaptation.id ? { ...a, 'Adapted Text': content } : a));
      setSelectedAdaptation({ ...selectedAdaptation, 'Adapted Text': content });
      toast.success(t('adaptations.messages.saveSuccess'));
    } catch (error) {
      logger.error('Error saving adapted CV:', error);
      toast.error(t('adaptations.messages.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  // No client-side filtering needed - server handles it
  const filteredAdaptations = adaptations;

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/20';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  const stats: Stats = {
    total: totalCount,
    completed: adaptations.filter(a => a.Status?.toLowerCase() === 'completed' || a.Status?.toLowerCase() === 'final').length,
    processing: adaptations.filter(a => a.Status?.toLowerCase() === 'processing' || a.Status?.toLowerCase() === 'draft').length,
    failed: adaptations.filter(a => a.Status?.toLowerCase() === 'failed').length,
    avgScore: adaptations.length > 0 ? Math.round(adaptations.reduce((sum, a) => sum + (a['Match Score'] || 0), 0) / adaptations.length) : 0
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="p-6 max-w-7xl mx-auto">
      <Breadcrumbs className="mb-4" />
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('adaptations.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('adaptations.subtitle')}</p>
      </div>

      <StatsCards stats={stats} t={t} />
      <SearchAndFilters searchTerm={searchTerm} onSearchChange={setSearchTerm} filterStatus={filterStatus} onFilterChange={setFilterStatus} onRefresh={fetchData} onReset={() => { setSearchTerm(''); setFilterStatus('all'); }} t={t} />

      {/* Top pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
        loading={loading}
        itemName={t('adaptations.results')}
      />

      {loading ? (
        <SkeletonAdaptationList count={6} />
      ) : filteredAdaptations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <SparklesIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('adaptations.noAdaptations')}</h3>
          <p className="text-gray-600 dark:text-gray-400">{searchTerm || filterStatus !== 'all' ? t('adaptations.noAdaptationsFiltered') : t('adaptations.noAdaptationsPrompt')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAdaptations.map((adaptation, index) => (
            <motion.div key={adaptation.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getScoreBgColor(adaptation['Match Score'] || 0)}`}>
                    <span className={getScoreColor(adaptation['Match Score'] || 0)}>{adaptation['Match Score'] || 0}% Match</span>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    ['completed', 'final'].includes(adaptation.Status?.toLowerCase() || '') 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
                      : ['processing', 'draft'].includes(adaptation.Status?.toLowerCase() || '')
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  }`}>{t(`adaptations.status.${adaptation.Status?.toLowerCase() || 'unknown'}`, adaptation.Status || 'N/A')}</span>
                </div>
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1">{adaptation['Candidate Name'] || getResumeName(adaptation)}</h3>
                  {adaptation['Adapted Title'] && (
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1 line-clamp-1 italic">{adaptation['Adapted Title']}</p>
                  )}
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1"><span className="font-medium">{t('adaptations.mission')}:</span> {getMissionTitle(adaptation)}</p>
                  {adaptation['Created At'] && <p className="text-xs text-gray-500 dark:text-gray-500">{formatDateTime(adaptation['Created At'])}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => navigate(`/adaptations/${adaptation.id}`)} className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"><EyeIcon className="w-4 h-4" />{t('adaptations.viewAdaptation')}</button>
                  <button onClick={() => handleExportPDF(adaptation)} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors" title={t('adaptations.exportPDF')}><ArrowDownTrayIcon className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(adaptation.id)} className="px-3 py-2 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors" title={t('adaptations.delete')}><TrashIcon className="w-4 h-4" /></button>
                </div>
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
        itemName={t('adaptations.results')}
      />

      {showDetailModal && selectedAdaptation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('adaptations.modal.title')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{getResumeName(selectedAdaptation)} → {getMissionTitle(selectedAdaptation)}</p>
              </div>
              <button onClick={() => { setShowDetailModal(false); setActiveTab('mission'); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 px-6">
              <nav className="flex gap-8">
                <button onClick={() => setActiveTab('mission')} className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'mission' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>{t('adaptations.modal.tabs.mission')}</button>
                <button onClick={() => setActiveTab('analysis')} className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'analysis' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>{t('adaptations.modal.tabs.analysis')}</button>
                <button onClick={() => setActiveTab('adapted')} className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'adapted' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>{t('adaptations.modal.tabs.adapted')}</button>
              </nav>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'mission' && (() => {
                const missionTitle = selectedAdaptation['Mission Title'] || getMissionTitle(selectedAdaptation);
                const missionContent = selectedAdaptation['Mission Content'] || '';
                const mission = getMissionData(selectedAdaptation.Mission);
                const missionClient = mission?.Client || '';
                const missionLocation = mission?.Location || '';
                return (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{missionTitle}</h3>
                      {missionClient && <div className="mb-4"><span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('adaptations.modal.mission.client')} : </span><span className="text-sm text-gray-600 dark:text-gray-400">{missionClient}</span></div>}
                      {missionLocation && <div className="mb-4"><span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('adaptations.modal.mission.location')} : </span><span className="text-sm text-gray-600 dark:text-gray-400">{missionLocation}</span></div>}
                    </div>
                    {missionContent ? (
                      <div><h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('adaptations.modal.mission.description')}</h4><div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={createSafeHtml(missionContent)} /></div>
                    ) : (
                      <div className="text-center py-8"><p className="text-gray-500 dark:text-gray-400">{t('adaptations.modal.mission.noDescription')}</p></div>
                    )}
                  </div>
                );
              })()}
              {activeTab === 'analysis' && <AdaptationAnalysisView adaptation={selectedAdaptation} />}
              {activeTab === 'adapted' && <div><textarea id="adaptedCVEditor" defaultValue={editedAdaptedText} className="hidden" /></div>}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              {activeTab === 'adapted' && (
                <button onClick={handleSaveAdaptedCV} disabled={isSaving || !editorReady} className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                  {isSaving ? (<><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>{t('adaptations.modal.saving')}</>) : (<><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>{t('adaptations.modal.save')}</>)}
                </button>
              )}
              <button onClick={() => handleExportPDF(selectedAdaptation)} className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"><ArrowDownTrayIcon className="w-5 h-5" />{t('adaptations.exportPDF')}</button>
              <button onClick={() => { setShowDetailModal(false); setActiveTab('analysis'); }} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors">{t('adaptations.modal.close')}</button>
            </div>
          </motion.div>
        </div>
      )}

      <ExportModal show={showExportModal} onClose={() => { setShowExportModal(false); setAdaptationToExport(null); }} templates={templates} selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate} onConfirm={handleConfirmExport} loading={exportLoading} loadingTemplates={loadingTemplates} />
    </motion.div>
  );
};

export default AdaptationsPage;
