import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import logger from '../utils/logger.frontend';
import { templateService } from '../utils/templateService';

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

export function useTemplatesDashboard() {
  const navigate = useNavigate();
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

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await templateService.getTemplatesPaginated({
        page: currentPage,
        pageSize: TEMPLATES_PAGE_SIZE,
        search: debouncedSearch,
      });

      setTemplates(data.templates);
      setTotalCount(data.pagination.totalCount || data.templates.length);
      setHasMore(data.pagination.hasMore || false);
    } catch (err) {
      const message = t('templates.status.error');
      setError(message);
      toast.error(message);
      logger.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, t]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

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
      await templateService.deleteTemplate(templateToDelete.id);
      setTemplates((previousTemplates) => previousTemplates.filter((template) => template.id !== templateToDelete.id));
      setTotalCount((count) => Math.max(0, count - 1));
      toast.success(t('templates.status.deleteSuccess'));
    } catch (err) {
      logger.error('Error deleting template:', err);
      toast.error(t('templates.status.deleteError'));
    } finally {
      setIsDeleting(false);
      closeDeleteConfirmModal();
    }
  }, [closeDeleteConfirmModal, t, templateToDelete]);

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

  return {
    closeDeleteConfirmModal,
    currentPage,
    error,
    fetchTemplates,
    filteredTemplates,
    goToEditTemplate: (templateId: string) => navigate(`/templates/edit/${templateId}`),
    goToNewTemplate: () => navigate('/templates/new'),
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
