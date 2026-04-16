import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useScopedViewRefresh } from '../hooks/useScopedViewRefresh';
import logger from '../utils/logger.frontend';
import { templateService } from '../utils/templateService';
import { markTemplatesViewDirty } from '../utils/viewRefreshScopes';

export interface Template {
  id: string;
  Name: string;
  Description?: string;
  HeaderContent?: string;
  TemplateContent?: string;
  FooterContent?: string;
  Stylesheet?: string;
  Status?: string;
  Popular?: boolean;
  Tags?: string[];
  FirmId?: string;
  FirmName?: string;
}

export interface TemplateStats {
  total: number;
  popular: number;
  active: number;
}

export type TemplateSort = 'popular' | 'name';
export const TEMPLATES_PAGE_SIZE = 12;
type TemplatesNavigationState = {
  createdTemplate?: Template;
  updatedTemplate?: Template;
} | null;
type FetchTemplatesOptions = {
  clearPendingTemplate?: boolean;
  page?: number;
  search?: string;
  forceRefresh?: boolean;
};

function matchesTemplateSearch(template: Template, rawSearch: string): boolean {
  const normalizedSearch = rawSearch.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }

  return [template.Name, template.Description, template.FirmName]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .some((value) => value.toLowerCase().includes(normalizedSearch));
}

export function useTemplatesDashboard(options: { embedded?: boolean } = {}) {
  const refreshConsumerId = options.embedded ? 'admin-workspace:templates-page' : 'templates-page';
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<TemplateSort>('popular');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [, setHasMore] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const templatesRequestIdRef = useRef(0);
  const pendingTemplateRef = useRef<{ template: Template; mode: 'created' | 'updated' } | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const navigationState = location.state as TemplatesNavigationState;
    const navigationTemplate = navigationState?.createdTemplate || navigationState?.updatedTemplate || null;

    if (!navigationTemplate) {
      return;
    }

    pendingTemplateRef.current = {
      template: navigationTemplate,
      mode: navigationState?.createdTemplate ? 'created' : 'updated',
    };
    templatesRequestIdRef.current += 1;
    setCurrentPage(1);
    setTemplates((currentTemplates) => {
      const filteredTemplates = currentTemplates.filter((template) => template.id !== navigationTemplate.id);
      return [navigationTemplate, ...filteredTemplates].slice(0, TEMPLATES_PAGE_SIZE);
    });
    if (navigationState?.createdTemplate) {
      setTotalCount((currentTotal) => currentTotal + 1);
    }
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const fetchTemplates = useCallback(async (options: FetchTemplatesOptions = {}) => {
    const requestId = ++templatesRequestIdRef.current;
    const effectivePage = options.page ?? currentPage;
    const effectiveSearch = options.search ?? debouncedSearch;
    try {
      setLoading(true);
      setError(null);
      const data = await templateService.getTemplatesPaginated({
        page: effectivePage,
        pageSize: TEMPLATES_PAGE_SIZE,
        search: effectiveSearch,
        forceRefresh: options.forceRefresh === true,
      });

      if (requestId !== templatesRequestIdRef.current) {
        return;
      }
      const pendingTemplate = pendingTemplateRef.current;
      const responseIncludesPendingTemplate = Boolean(
        pendingTemplate?.template
        && data.templates.some((template) => template.id === pendingTemplate.template.id),
      );
      const shouldInjectPendingTemplate = Boolean(
        pendingTemplate?.template
        && effectivePage === 1
        && matchesTemplateSearch(pendingTemplate.template, effectiveSearch)
        && !responseIncludesPendingTemplate,
      );
      const mergedTemplates = shouldInjectPendingTemplate
        ? [pendingTemplate!.template, ...data.templates.filter((template) => template.id !== pendingTemplate!.template.id)].slice(0, TEMPLATES_PAGE_SIZE)
        : data.templates;

      setTemplates(mergedTemplates);
      setTotalCount(shouldInjectPendingTemplate
        ? Math.max(
            data.pagination.totalCount || data.templates.length,
            pendingTemplate?.mode === 'created' ? mergedTemplates.length : data.pagination.totalCount || mergedTemplates.length,
          )
        : (data.pagination.totalCount || data.templates.length));
      setHasMore(data.pagination.hasMore || false);
      const shouldClearPendingTemplate = responseIncludesPendingTemplate
        || (pendingTemplate?.template != null && !matchesTemplateSearch(pendingTemplate.template, effectiveSearch))
        || options.clearPendingTemplate === true;
      if (shouldClearPendingTemplate) {
        pendingTemplateRef.current = null;
      }
    } catch (err) {
      if (requestId !== templatesRequestIdRef.current) {
        return;
      }
      const message = t('templates.status.error');
      setError(message);
      toast.error(message);
      logger.error('Error loading templates:', err);
    } finally {
      if (requestId === templatesRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [currentPage, debouncedSearch, t]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  useScopedViewRefresh({
    consumerId: refreshConsumerId,
    scopes: ['templates', 'administration'],
    onRefresh: () => {
      void fetchTemplates({ clearPendingTemplate: true, forceRefresh: true });
    },
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / TEMPLATES_PAGE_SIZE)) || 1;

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const openDeleteConfirmModal = useCallback((template: Template) => {
    setTemplateToDelete(template);
    setIsDeleteModalOpen(true);
  }, []);

  const closeDeleteConfirmModal = useCallback(() => {
    setTemplateToDelete(null);
    setIsDeleteModalOpen(false);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!templateToDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      templatesRequestIdRef.current += 1;
      await templateService.deleteTemplate(templateToDelete.id);
      setTemplates((previousTemplates) => previousTemplates.filter((template) => template.id !== templateToDelete.id));
      setTotalCount((count) => Math.max(0, count - 1));
      toast.success(t('templates.status.deleteSuccess'));
      markTemplatesViewDirty();
      await fetchTemplates({ clearPendingTemplate: true, forceRefresh: true });
    } catch (err) {
      logger.error('Error deleting template:', err);
      toast.error(t('templates.status.deleteError'));
    } finally {
      setIsDeleting(false);
      closeDeleteConfirmModal();
    }
  }, [closeDeleteConfirmModal, fetchTemplates, t, templateToDelete]);

  const filteredTemplates = useMemo(() => {
    const nextTemplates = [...templates];
    if (sortBy === 'popular') {
      return nextTemplates.sort((a, b) => Number(Boolean(b.Popular)) - Number(Boolean(a.Popular)));
    }

    return nextTemplates.sort((a, b) => a.Name.localeCompare(b.Name));
  }, [sortBy, templates]);

  const stats = useMemo<TemplateStats>(() => ({
    total: totalCount,
    popular: templates.filter((template) => template.Popular).length,
    active: templates.length,
  }), [templates, totalCount]);

  const resetSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  const refreshTemplates = useCallback(async (): Promise<void> => {
    const normalizedSearch = searchTerm.trim();
    const nextPage = normalizedSearch === debouncedSearch ? currentPage : 1;

    templatesRequestIdRef.current += 1;
    if (normalizedSearch !== debouncedSearch) {
      setDebouncedSearch(normalizedSearch);
    }
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage);
    }

    await fetchTemplates({
      clearPendingTemplate: true,
      page: nextPage,
      search: normalizedSearch,
      forceRefresh: true,
    });
  }, [currentPage, debouncedSearch, fetchTemplates, searchTerm]);

  return {
    closeDeleteConfirmModal,
    currentPage,
    error,
    fetchTemplates,
    refreshTemplates,
    filteredTemplates,
    goToEditTemplate: (templateId: string) => navigate(`/admin/templates/edit/${templateId}`),
    goToNewTemplate: () => navigate('/admin/templates/new'),
    goToPage,
    handleConfirmDelete,
    isDeleteModalOpen,
    isDeleting,
    isExtractModalOpen,
    loading,
    mounted,
    openDeleteConfirmModal,
    openExtractModal: () => setIsExtractModalOpen(true),
    openPreviewModal: setPreviewTemplate,
    previewTemplate,
    resetSearch,
    searchTerm,
    setIsExtractModalOpen,
    setPreviewTemplate,
    setSearchTerm,
    setSortBy,
    sortBy,
    stats,
    templateToDelete,
    totalCount,
    totalPages,
  };
}
