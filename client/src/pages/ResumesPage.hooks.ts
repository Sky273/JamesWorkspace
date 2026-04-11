import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useResume } from '../context/ResumeContext';
import { useAuthFetch } from '../hooks/useAuthFetch';
import type { Resume } from '../types/entities';
import { formatDate } from '../utils/dateFormatter';
import logger from '../utils/logger.frontend';
import {
  buildResumesSearchParams,
  computeResumeStats,
  EMPTY_TAGS,
  filterResumesByTags,
  getResumePreviewTags,
  normalizeResumeStatsResponse,
  type ResumeStats,
  type TagsByCategory,
} from './ResumesPage.data';

export type ResumeViewMode = 'list' | 'byDeal';
const RESUMES_VIEW_MODE_STORAGE_KEY = 'resumesViewMode';

export const RESUMES_PAGE_SIZE = 20;
export { getResumePreviewTags };
export type { ResumeStats, TagsByCategory };

export function useResumesDashboard() {
  const { user: authUser } = useAuth();
  const { deleteResume, deleting } = useResume();
  const { authGet } = useAuthFetch();
  const navigate = useNavigate();
  const location = useLocation();

  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [, setHasMore] = useState(false);
  const [globalStats, setGlobalStats] = useState<ResumeStats>({ total: 0, improved: 0, processing: 0, avgScore: 0 });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [resumeToDelete, setResumeToDelete] = useState<Resume | null>(null);
  const [allTags, setAllTags] = useState<TagsByCategory>(EMPTY_TAGS);
  const [viewMode, setViewMode] = useState<ResumeViewMode>(() => {
    const routeViewMode = (location.state as { viewMode?: string } | null)?.viewMode;
    if (routeViewMode === 'list' || routeViewMode === 'byDeal') {
      return routeViewMode;
    }

    if (typeof window !== 'undefined') {
      const storedViewMode = window.sessionStorage.getItem(RESUMES_VIEW_MODE_STORAGE_KEY);
      if (storedViewMode === 'list' || storedViewMode === 'byDeal') {
        return storedViewMode;
      }
    }

    return 'list';
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const fetchResumes = useCallback(async () => {
    try {
      setLoading(true);
      const params = buildResumesSearchParams(currentPage, RESUMES_PAGE_SIZE, debouncedSearch);

      const response = await authGet(`/api/resumes?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch resumes');
      }

      const data = await response.json();
      if (data.data && data.pagination) {
        setResumes(data.data);
        setTotalCount(data.pagination.totalCount || data.data.length);
        setHasMore(data.pagination.hasMore || false);
      } else {
        setResumes(Array.isArray(data) ? data : []);
        setTotalCount(Array.isArray(data) ? data.length : 0);
        setHasMore(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching resumes:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [authGet, currentPage, debouncedSearch]);

  useEffect(() => {
    void fetchResumes();
  }, [fetchResumes]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(RESUMES_VIEW_MODE_STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  const fetchGlobalStats = useCallback(async () => {
    try {
      const response = await authGet('/api/resumes/stats');
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setGlobalStats(normalizeResumeStatsResponse(data as Record<string, unknown>));
    } catch (error) {
      logger.error('Error fetching global stats:', error);
    }
  }, [authGet]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchGlobalStats();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [fetchGlobalStats]);

  useEffect(() => {
    if (viewMode !== 'byDeal' && !isFilterExpanded) {
      return;
    }

    const fetchAllTags = async () => {
      try {
        const scope = viewMode === 'byDeal' ? 'grouped-by-deal' : 'default';
        const response = await authGet(`/api/tags/cleaned?scope=${scope}`);
        if (!response.ok) {
          return;
        }

        const tags = await response.json();
        setAllTags(tags);
      } catch (error) {
        logger.error('Error fetching cleaned tags:', error);
      }
    };

    void fetchAllTags();
  }, [authGet, isFilterExpanded, viewMode]);

  const filteredResumes = useMemo(() => {
    return filterResumesByTags(resumes, selectedTags);
  }, [resumes, selectedTags]);

  const stats = useMemo<ResumeStats>(
    () => computeResumeStats(resumes, globalStats, totalCount),
    [globalStats, resumes, totalCount]
  );

  const totalPages = Math.ceil(totalCount / RESUMES_PAGE_SIZE);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTags((previousTags) =>
      previousTags.includes(tag)
        ? previousTags.filter((previousTag) => previousTag !== tag)
        : [...previousTags, tag]
    );
  }, []);

  const handleResumeClick = useCallback((resume: Resume) => {
    navigate(`/resumes/${resume.id}/analysis`);
  }, [navigate]);

  const openDeleteConfirm = useCallback((resume: Resume, event: MouseEvent) => {
    event.stopPropagation();
    setResumeToDelete(resume);
    setShowDeleteConfirm(true);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setShowDeleteConfirm(false);
    setResumeToDelete(null);
  }, []);

  const confirmDeleteResume = useCallback(async () => {
    if (!resumeToDelete) {
      return;
    }

    try {
      await deleteResume(resumeToDelete.id);
      await fetchResumes();
      await fetchGlobalStats();
    } catch (error) {
      logger.error('Failed to delete resume from page:', error);
    }

    closeDeleteConfirm();
  }, [closeDeleteConfirm, deleteResume, fetchGlobalStats, fetchResumes, resumeToDelete]);

  const clearFilters = useCallback(() => {
    setSelectedTags([]);
    setSearchQuery('');
  }, []);

  const handleDownloadResume = useCallback(async (resume: Resume, event: MouseEvent) => {
    event.stopPropagation();

    try {
      const response = await authGet(`/api/resumes/${resume.id}/download`);
      if (!response.ok) {
        const error = await response.json();
        logger.error('Download failed:', error);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = resume['Resume File']?.[0]?.filename || resume['File Name'] || resume.Name || 'resume';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (match) {
          filename = decodeURIComponent(match[1]);
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Error downloading resume:', error);
    }
  }, [authGet]);

  const getTagCategory = useCallback((tag: string) => {
    for (const [category, tags] of Object.entries(allTags)) {
      if (tags.includes(tag)) {
        return category;
      }
    }

    return 'Skills';
  }, [allTags]);

  const formatResumeDate = useCallback((dateString?: string) => {
    return formatDate(dateString, 'medium') || 'Invalid date';
  }, []);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  return {
    allTags,
    authUser,
    clearFilters,
    closeDeleteConfirm,
    confirmDeleteResume,
    currentPage,
    deleting,
    fetchResumes,
    filteredResumes,
    formatResumeDate,
    getTagCategory,
    goToBatchUpload: authUser?.role === 'admin' ? () => navigate('/batch-upload') : undefined,
    goToPage,
    goToUpload: () => navigate('/upload?new'),
    handleDownloadResume,
    handleResumeClick,
    handleTagClick,
    isFilterExpanded,
    loading,
    resumeToDelete,
    searchQuery,
    selectedTags,
    setIsFilterExpanded,
    setSearchQuery,
    setViewMode,
    showDeleteConfirm,
    stats,
    tagsByCategory: allTags,
    totalCount,
    totalPages,
    viewMode,
    openDeleteConfirm,
  };
}
