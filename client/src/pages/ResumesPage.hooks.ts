import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useResume } from '../context/ResumeContext';
import { useAuthFetch } from '../hooks/useAuthFetch';
import type { Resume } from '../types/entities';
import { formatDate } from '../utils/dateFormatter';
import logger from '../utils/logger.frontend';

export interface TagsByCategory {
  Skills: string[];
  Industries: string[];
  Tools: string[];
  'Soft Skills': string[];
  [key: string]: string[];
}

export interface ResumeStats {
  total: number;
  improved: number;
  processing: number;
  avgScore: number;
}

export type ResumeViewMode = 'list' | 'byDeal';

export const RESUMES_PAGE_SIZE = 20;

const EMPTY_TAGS: TagsByCategory = {
  Skills: [],
  Industries: [],
  Tools: [],
  'Soft Skills': [],
};

function parseResumeTags(value: unknown): string[] {
  if (!value) return [];

  try {
    if (typeof value === 'string') {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((tag) => String(tag)) : [];
    }

    if (Array.isArray(value)) {
      return value.map((tag) => String(tag));
    }
  } catch {
    return [];
  }

  return [];
}

export function getResumePreviewTags(resume: Resume, category: 'Skills' | 'Industries' | 'Tools' | 'Soft Skills'): string[] {
  const cleanedField = `${category} Cleaned` as keyof Resume;
  const cleanedTags = parseResumeTags(resume[cleanedField]);
  if (cleanedTags.length > 0) {
    return cleanedTags;
  }

  return parseResumeTags(resume[category]);
}

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
  const [viewMode, setViewMode] = useState<ResumeViewMode>(
    (location.state as { viewMode?: string } | null)?.viewMode === 'list' ? 'list' : 'byDeal'
  );

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
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', String(RESUMES_PAGE_SIZE));
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

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

  const fetchGlobalStats = useCallback(async () => {
    try {
      const response = await authGet('/api/resumes/stats');
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setGlobalStats({
        total: data.resumes?.total || 0,
        improved: data.resumes?.improved || 0,
        processing: 0,
        avgScore: data.scores?.averageImproved || data.scores?.averageOriginal || 0,
      });
    } catch (error) {
      logger.error('Error fetching global stats:', error);
    }
  }, [authGet]);

  useEffect(() => {
    void fetchGlobalStats();
  }, [fetchGlobalStats]);

  useEffect(() => {
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
  }, [authGet, viewMode]);

  const filteredResumes = useMemo(() => {
    if (selectedTags.length === 0) {
      return resumes;
    }

    return resumes.filter((resume) => {
      const skills = parseResumeTags(resume['Skills_cleaned' as keyof Resume]) || parseResumeTags(resume['Skills' as keyof Resume]);
      const industries = parseResumeTags(resume['Industries_cleaned' as keyof Resume]) || parseResumeTags(resume['Industries' as keyof Resume]);
      const tools = parseResumeTags(resume['Tools_cleaned' as keyof Resume]) || parseResumeTags(resume['Tools' as keyof Resume]);
      const softSkills = parseResumeTags(resume['Soft Skills_cleaned' as keyof Resume]) || parseResumeTags(resume['Soft Skills' as keyof Resume]);
      const resumeTags = [...skills, ...industries, ...tools, ...softSkills].map((tag) => tag.toLowerCase().trim());

      return selectedTags.every((selectedTag) =>
        resumeTags.some((resumeTag) => resumeTag === selectedTag.toLowerCase().trim())
      );
    });
  }, [resumes, selectedTags]);

  const stats = useMemo<ResumeStats>(() => ({
    total: globalStats.total || totalCount,
    improved: globalStats.improved,
    processing: resumes.filter((resume) => {
      const status = resume.Status?.toLowerCase();
      return status === 'processing' || status === 'analyzing';
    }).length,
    avgScore: globalStats.avgScore,
  }), [globalStats, resumes, totalCount]);

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
