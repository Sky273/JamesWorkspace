import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useScopedViewRefresh } from '../hooks/useScopedViewRefresh';
import { useAuthFetch } from '../hooks/useAuthFetch';
import type { Resume as ResumeEntity } from '../types/entities';
import { createAuthOptionsWithCsrf, fetchWithCsrfRetry, prepareLongRunningRequest } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';
import resumeAdaptationService from '../utils/resumeAdaptationService';
import { templateService } from '../utils/templateService';
import { markAdaptationsViewDirty } from '../utils/viewRefreshScopes';
import { removeSuggestionMarkers } from '../components/TiptapEditor/suggestionsHtml';
import {
  applyTemplatePlaceholders,
  normalizeTemplateFragment,
  normalizeTemplateStylesheet,
  summarizeTemplatePayload,
} from '../utils/templateFragments';
import type { ExportFormat } from '../components/ResumeAnalysis/ExportTab';

export interface Adaptation {
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

export interface Resume extends ResumeEntity {
  CustomerName?: string;
  Anonymized?: boolean | string;
  Trigram?: string;
}

export interface Mission {
  id: string;
  Title?: string;
  Content?: string;
  Client?: string;
  Location?: string;
  [key: string]: unknown;
}

export interface Template {
  id: string;
  Name: string;
  Status?: string;
  TemplateContent?: string;
  Stylesheet?: string;
  HeaderContent?: string;
  FooterContent?: string;
  FooterHeight?: number;
}

export interface AdaptationStats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  avgScore: number;
}

export type AdaptationsViewMode = 'list' | 'byDeal';
export const ADAPTATIONS_PAGE_SIZE = 12;
type FetchAdaptationsOptions = {
  page?: number;
  search?: string;
  forceRefresh?: boolean;
};

export function useAdaptationsDashboard() {
  const refreshConsumerId = 'adaptations-page';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authGet } = useAuthFetch();

  const [adaptations, setAdaptations] = useState<Adaptation[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<AdaptationsViewMode>('byDeal');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [, setHasMore] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedExportFormat, setSelectedExportFormat] = useState<ExportFormat>('pdf');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [adaptationToExport, setAdaptationToExport] = useState<Adaptation | null>(null);
  const [groupedRefreshToken, setGroupedRefreshToken] = useState(0);
  const adaptationsRequestIdRef = useRef(0);
  const referenceDataRequestIdRef = useRef(0);
  const templatesRequestIdRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  const fetchTemplates = useCallback(async () => {
    const requestId = ++templatesRequestIdRef.current;
    try {
      setLoadingTemplates(true);
      const fetchedTemplates = await templateService.getAllTemplates();
      const activeTemplates = fetchedTemplates.filter((template: Template) => template.Status === 'Active');
      if (requestId !== templatesRequestIdRef.current) {
        return;
      }
      setTemplates(activeTemplates);
      if (!selectedTemplate && activeTemplates.length > 0) {
        setSelectedTemplate(activeTemplates[0].id);
      }
    } catch (error) {
      if (requestId !== templatesRequestIdRef.current) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching templates:', error);
        toast.error(t('templates.status.error'));
      }
    } finally {
      if (requestId === templatesRequestIdRef.current) {
        setLoadingTemplates(false);
      }
    }
  }, [selectedTemplate, t]);

  const fetchReferenceData = useCallback(async () => {
    const requestId = ++referenceDataRequestIdRef.current;
    try {
      const [resumesResponse, missionsResponse] = await Promise.all([
        authGet('/api/resumes?limit=100'),
        authGet('/api/missions?limit=100'),
      ]);

      if (resumesResponse.ok) {
        const resumesData = await resumesResponse.json();
        if (requestId !== referenceDataRequestIdRef.current) {
          return;
        }
        setResumes(resumesData.data || resumesData);
      }

      if (missionsResponse.ok) {
        const missionsData = await missionsResponse.json();
        if (requestId !== referenceDataRequestIdRef.current) {
          return;
        }
        setMissions(missionsData.data || missionsData);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching reference data:', error);
      }
    }
  }, [authGet]);

  const fetchAdaptations = useCallback(async (options: FetchAdaptationsOptions = {}) => {
    const requestId = ++adaptationsRequestIdRef.current;
    const effectivePage = options.page ?? currentPage;
    const effectiveSearch = options.search ?? debouncedSearch;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', String(effectivePage));
      params.append('limit', String(ADAPTATIONS_PAGE_SIZE));
      if (effectiveSearch) {
        params.append('search', effectiveSearch);
      }
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      if (options.forceRefresh) {
        params.append('refresh', '1');
      }

      const response = await authGet(`/api/adaptations?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch adaptations');
      }

      const data = await response.json();
      if (requestId !== adaptationsRequestIdRef.current) {
        return;
      }
      if (data.data && data.pagination) {
        setAdaptations(data.data);
        setTotalCount(data.pagination.totalCount || data.data.length);
        setHasMore(data.pagination.hasMore || false);
      } else {
        setAdaptations(Array.isArray(data) ? data : []);
        setTotalCount(Array.isArray(data) ? data.length : 0);
        setHasMore(false);
      }
    } catch (error) {
      if (requestId !== adaptationsRequestIdRef.current) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching adaptations:', error);
        toast.error(t('adaptations.messages.loadError', 'Erreur lors du chargement des adaptations'));
      }
    } finally {
      if (requestId === adaptationsRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [authGet, currentPage, debouncedSearch, filterStatus, t]);

  useEffect(() => {
    void fetchReferenceData();
    void fetchTemplates();
  }, [fetchReferenceData, fetchTemplates]);

  useEffect(() => {
    void fetchAdaptations();
  }, [fetchAdaptations]);

  useScopedViewRefresh({
    consumerId: refreshConsumerId,
    scopes: ['adaptations'],
    onRefresh: () => {
      setGroupedRefreshToken((currentToken) => currentToken + 1);
      void fetchAdaptations({ forceRefresh: true });
    },
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / ADAPTATIONS_PAGE_SIZE)) || 1;

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const handleDelete = useCallback(async (adaptationId: string) => {
    const confirmed = window.confirm(t('adaptations.messages.deleteConfirm', 'Etes-vous sur de vouloir supprimer cette adaptation ?'));
    if (!confirmed) {
      return;
    }

    try {
      adaptationsRequestIdRef.current += 1;
      await resumeAdaptationService.deleteAdaptation(adaptationId);
      setAdaptations((currentAdaptations) => currentAdaptations.filter((adaptation) => adaptation.id !== adaptationId));
      setTotalCount((count) => Math.max(0, count - 1));
      setGroupedRefreshToken((currentToken) => currentToken + 1);
      markAdaptationsViewDirty();
      toast.success(t('adaptations.messages.deleteSuccess', 'Adaptation supprimee'));
      await fetchAdaptations({ forceRefresh: true });
    } catch (error) {
      logger.error('Error deleting adaptation:', error);
      toast.error(t('adaptations.messages.deleteError'));
    }
  }, [t]);

  const handleExportPDF = useCallback((adaptation: Adaptation) => {
    setAdaptationToExport(adaptation);
    setShowExportModal(true);
  }, []);

  const closeExportModal = useCallback(() => {
    setShowExportModal(false);
    setAdaptationToExport(null);
  }, []);

  const handleConfirmExport = useCallback(async () => {
    if (!adaptationToExport || !selectedTemplate) {
      toast.error(t('common.export'));
      return;
    }

    try {
      setExportLoading(true);
      const template = await templateService.getTemplateById(selectedTemplate);
      if (!template) {
        throw new Error('Template not found');
      }

      const resumeId = adaptationToExport.Resume?.[0];
      const resume = resumes.find((item) => item.id === resumeId);
      const candidateName = adaptationToExport['Resume Name'] || resume?.Name || adaptationToExport['Candidate Name'] || 'Candidat';
      const candidateTitle = adaptationToExport['Adapted Title'] || resume?.Title || 'Titre Professionnel';
      const customerName = resume?.CustomerName || '';
      const rawContent = adaptationToExport['Adapted Text'] || '';
      const content = removeSuggestionMarkers(rawContent);

      const isAnonymized = resume?.Anonymized === true || resume?.Anonymized === 'true';
      const exportName = isAnonymized
        ? (resume?.Trigram || candidateName.substring(0, 3).toUpperCase())
        : candidateName;

      const baseFilename = customerName ? `${exportName}_${customerName}` : exportName;
      const stylesheet = normalizeTemplateStylesheet(template.Stylesheet);
      const processedBody = applyTemplatePlaceholders(template.TemplateContent, {
        name: candidateName,
        title: candidateTitle,
        content,
      });
      const processedHeader = applyTemplatePlaceholders(
        normalizeTemplateFragment(template.HeaderContent, 'header'),
        { name: candidateName, title: candidateTitle }
      );
      const processedFooter = applyTemplatePlaceholders(
        normalizeTemplateFragment(template.FooterContent, 'footer'),
        { name: candidateName, title: candidateTitle }
      );
      logger.warn('Adaptation export payload normalized', {
        templateId: template.id,
        filename: `${baseFilename.replace(/[^a-zA-Z0-9_]/g, '')}.${selectedExportFormat}`,
        htmlLength: processedBody.length,
        ...summarizeTemplatePayload(template),
      });

      const endpoint = selectedExportFormat === 'pdf' ? '/generate-pdf' : '/generate-docx';
      const fileExtension = selectedExportFormat === 'pdf' ? 'pdf' : selectedExportFormat;

      await prepareLongRunningRequest(300000, { requiresCsrf: true });
      const exportOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          htmlContent: processedBody,
          filename: `${baseFilename.replace(/[^a-zA-Z0-9_]/g, '')}.${fileExtension}`,
          stylesheet,
          headerContent: processedHeader || undefined,
          footerContent: processedFooter || undefined,
          footerHeight: template.FooterHeight || 25,
          format: selectedExportFormat,
        }),
      }, true);

      const response = await fetchWithCsrfRetry(endpoint, exportOptions, 300000);
      if (!response.ok) {
        throw new Error(`Failed to generate ${selectedExportFormat.toUpperCase()}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseFilename.replace(/[^a-zA-Z0-9_]/g, '')}.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('adaptations.messages.exportSuccess', 'Export effectue avec succes'));
      closeExportModal();
    } catch (error) {
      logger.error('Error exporting PDF:', error);
      toast.error(t('adaptations.messages.exportError', 'Erreur lors de l export'));
    } finally {
      setExportLoading(false);
    }
  }, [adaptationToExport, closeExportModal, resumes, selectedExportFormat, selectedTemplate, t]);

  const getResumeName = useCallback((adaptation: Adaptation) => {
    if (adaptation['Resume Name']) {
      return adaptation['Resume Name'];
    }

    const resumeId = adaptation['Resume ID'] || adaptation.Resume?.[0];
    if (!resumeId) {
      return t('adaptations.card.noName');
    }

    const resume = resumes.find((item) => item.id === resumeId);
    return resume?.Name || t('adaptations.card.noName');
  }, [resumes, t]);

  const getMissionTitle = useCallback((adaptation: Adaptation) => {
    if (adaptation['Mission Title']) {
      return adaptation['Mission Title'];
    }

    const missionId = adaptation['Mission ID'] || adaptation.Mission?.[0];
    if (!missionId) {
      return t('adaptations.card.unknownMission');
    }

    const mission = missions.find((item) => item.id === missionId);
    return mission?.Title || t('adaptations.card.unknownMission');
  }, [missions, t]);

  const stats = useMemo<AdaptationStats>(() => ({
    total: totalCount,
    completed: adaptations.filter((adaptation) => ['completed', 'final'].includes(adaptation.Status?.toLowerCase() || '')).length,
    processing: adaptations.filter((adaptation) => ['processing', 'draft'].includes(adaptation.Status?.toLowerCase() || '')).length,
    failed: adaptations.filter((adaptation) => adaptation.Status?.toLowerCase() === 'failed').length,
    avgScore: adaptations.length > 0
      ? Math.round(adaptations.reduce((sum, adaptation) => sum + (adaptation['Match Score'] || 0), 0) / adaptations.length)
      : 0,
  }), [adaptations, totalCount]);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterStatus('all');
  }, []);

  const refreshAdaptations = useCallback(async (): Promise<void> => {
    const normalizedSearch = searchTerm.trim();
    const nextPage = normalizedSearch === debouncedSearch ? currentPage : 1;

    adaptationsRequestIdRef.current += 1;
    if (normalizedSearch !== debouncedSearch) {
      setDebouncedSearch(normalizedSearch);
    }
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage);
    }

    await fetchAdaptations({ page: nextPage, search: normalizedSearch, forceRefresh: true });
  }, [currentPage, debouncedSearch, fetchAdaptations, searchTerm]);

  return {
    adaptationToExport,
    adaptations,
    clearFilters,
    closeExportModal,
    currentPage,
    exportLoading,
    fetchAdaptations: refreshAdaptations,
    filterStatus,
    getMissionTitle,
    getResumeName,
    goToPage,
    handleConfirmExport,
    handleDelete,
    handleExportPDF,
    loading,
    loadingTemplates,
    navigateToAdaptation: (adaptationId: string) => navigate(`/adaptations/${adaptationId}`),
    searchTerm,
    selectedExportFormat,
    selectedTemplate,
    setFilterStatus,
    setSearchTerm,
    setSelectedExportFormat,
    setSelectedTemplate,
    setViewMode,
    showExportModal,
    stats,
    templates,
    totalCount,
    totalPages,
    viewMode,
    groupedRefreshToken,
  };
}
