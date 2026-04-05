import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useAuthFetch } from '../hooks/useAuthFetch';
import type { Resume as ResumeEntity } from '../types/entities';
import { createAuthOptionsWithCsrf, fetchWithCsrfRetry } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';
import resumeAdaptationService from '../utils/resumeAdaptationService';
import { templateService } from '../utils/templateService';
import { removeSuggestionMarkers } from '../components/TiptapEditor';
import {
  applyTemplatePlaceholders,
  normalizeTemplateFragment,
  normalizeTemplateStylesheet,
  summarizeTemplatePayload,
} from '../utils/templateFragments';

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

export function useAdaptationsDashboard() {
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
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [adaptationToExport, setAdaptationToExport] = useState<Adaptation | null>(null);

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
    try {
      setLoadingTemplates(true);
      const fetchedTemplates = await templateService.getAllTemplates();
      const activeTemplates = fetchedTemplates.filter((template: Template) => template.Status === 'Active');
      setTemplates(activeTemplates);
      if (!selectedTemplate && activeTemplates.length > 0) {
        setSelectedTemplate(activeTemplates[0].id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching templates:', error);
        toast.error(t('templates.status.error'));
      }
    } finally {
      setLoadingTemplates(false);
    }
  }, [selectedTemplate, t]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [resumesResponse, missionsResponse] = await Promise.all([
        authGet('/api/resumes?limit=100'),
        authGet('/api/missions?limit=100'),
      ]);

      if (resumesResponse.ok) {
        const resumesData = await resumesResponse.json();
        setResumes(resumesData.data || resumesData);
      }

      if (missionsResponse.ok) {
        const missionsData = await missionsResponse.json();
        setMissions(missionsData.data || missionsData);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching reference data:', error);
      }
    }
  }, [authGet]);

  const fetchAdaptations = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', String(ADAPTATIONS_PAGE_SIZE));
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }

      const response = await authGet(`/api/adaptations?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch adaptations');
      }

      const data = await response.json();
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
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching adaptations:', error);
        toast.error(t('adaptations.messages.loadError', 'Erreur lors du chargement des adaptations'));
      }
    } finally {
      setLoading(false);
    }
  }, [authGet, currentPage, debouncedSearch, filterStatus, t]);

  useEffect(() => {
    void fetchReferenceData();
    void fetchTemplates();
  }, [fetchReferenceData, fetchTemplates]);

  useEffect(() => {
    void fetchAdaptations();
  }, [fetchAdaptations]);

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
      await resumeAdaptationService.deleteAdaptation(adaptationId);
      setAdaptations((currentAdaptations) => currentAdaptations.filter((adaptation) => adaptation.id !== adaptationId));
      setTotalCount((count) => Math.max(0, count - 1));
      toast.success(t('adaptations.messages.deleteSuccess', 'Adaptation supprimee'));
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
      toast.error(t('adaptations.exportPDF'));
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
      logger.warn('PDF export payload normalized', {
        templateId: template.id,
        filename: `${baseFilename.replace(/[^a-zA-Z0-9_]/g, '')}.pdf`,
        htmlLength: processedBody.length,
        ...summarizeTemplatePayload(template),
      });

      const exportOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          htmlContent: processedBody,
          filename: `${baseFilename.replace(/[^a-zA-Z0-9_]/g, '')}.pdf`,
          stylesheet,
          headerContent: processedHeader || undefined,
          footerContent: processedFooter || undefined,
          footerHeight: template.FooterHeight || 25,
        }),
      });

      const response = await fetchWithCsrfRetry('/generate-pdf', exportOptions, 300000);
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseFilename.replace(/[^a-zA-Z0-9_]/g, '')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('adaptations.messages.exportSuccess', 'PDF exporte avec succes'));
      closeExportModal();
    } catch (error) {
      logger.error('Error exporting PDF:', error);
      toast.error(t('adaptations.messages.exportError', 'Erreur lors de l export PDF'));
    } finally {
      setExportLoading(false);
    }
  }, [adaptationToExport, closeExportModal, resumes, selectedTemplate, t]);

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

  return {
    adaptationToExport,
    adaptations,
    clearFilters,
    closeExportModal,
    currentPage,
    exportLoading,
    fetchAdaptations,
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
    selectedTemplate,
    setFilterStatus,
    setSearchTerm,
    setSelectedTemplate,
    setViewMode,
    showExportModal,
    stats,
    templates,
    totalCount,
    totalPages,
    viewMode,
  };
}
