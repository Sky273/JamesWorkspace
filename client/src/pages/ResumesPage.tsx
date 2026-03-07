/**
 * ResumesPage Component
 * TypeScript version
 */

import { useEffect, useState, useMemo, useCallback, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResume } from '../context/ResumeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useAuthFetch } from '../hooks/useAuthFetch';
import logger from '../utils/logger.frontend';
import { 
  DocumentTextIcon, 
  CalendarIcon, 
  ChartBarIcon,
  XMarkIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { formatDate } from '../utils/dateFormatter';

import { StatsCards, SearchAndActions } from '../components/ResumesPage';
import Pagination from '../components/Pagination';
import { SkeletonResumeList } from '../components/ui/Skeleton';
import Breadcrumbs from '../components/Breadcrumbs';
import ConsentBadge from '../components/ConsentBadge';

// Import centralized types
import { Resume } from '../types/entities';

interface TagsByCategory {
  Skills: string[];
  Industries: string[];
  Tools: string[];
  'Soft Skills': string[];
  [key: string]: string[];
}

interface ExpandedCategories {
  [key: string]: boolean;
}

interface Stats {
  total: number;
  improved: number;
  processing: number;
  avgScore: number;
}

const filterContentVariants = {
  expanded: {
    height: "auto",
    opacity: 1,
    marginBottom: "2rem",
    transition: {
      height: { duration: 0.3 },
      opacity: { duration: 0.2 }
    }
  },
  collapsed: {
    height: 0,
    opacity: 0,
    marginBottom: 0,
    transition: {
      height: { duration: 0.3 },
      opacity: { duration: 0.2 }
    }
  }
};

const tagColorMap: Record<string, string> = {
  'Skills': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'Industries': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'Tools': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'Soft Skills': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
};

const tagFilterColors: Record<string, { selected: string; unselected: string }> = {
  'Skills': {
    selected: 'bg-blue-500 text-white ring-2 ring-blue-300 dark:ring-blue-700',
    unselected: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
  },
  'Industries': {
    selected: 'bg-purple-500 text-white ring-2 ring-purple-300 dark:ring-purple-700',
    unselected: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50'
  },
  'Tools': {
    selected: 'bg-green-500 text-white ring-2 ring-green-300 dark:ring-green-700',
    unselected: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50'
  },
  'Soft Skills': {
    selected: 'bg-yellow-500 text-white ring-2 ring-yellow-300 dark:ring-yellow-700',
    unselected: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/50'
  }
};

function classNames(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

const ResumesPage = (): JSX.Element => {
  const { user: authUser } = useAuth();
  const { deleteResume, deleting } = useResume();
  const { authGet } = useAuthFetch();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Server-side pagination state
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const pageSize = 20;

  // Filter state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [resumeToDelete, setResumeToDelete] = useState<Resume | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<ExpandedCategories>({});
  const [allTags, setAllTags] = useState<TagsByCategory>({ Skills: [], Industries: [], Tools: [], 'Soft Skills': [] });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch resumes with server-side pagination
  const fetchResumes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', pageSize.toString());
      if (debouncedSearch) params.append('search', debouncedSearch);

      const response = await authGet(`/api/resumes?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch resumes');
      
      const data = await response.json();
      
      // Handle paginated response
      if (data.data && data.pagination) {
        setResumes(data.data);
        setTotalCount(data.pagination.totalCount || data.data.length);
        setHasMore(data.pagination.hasMore || false);
      } else {
        // Fallback for non-paginated response
        setResumes(Array.isArray(data) ? data : []);
        setTotalCount(Array.isArray(data) ? data.length : 0);
        setHasMore(false);
      }
    } catch (error) {
      // Don't log session expiration errors - user will be redirected
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching resumes:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [authGet, currentPage, debouncedSearch]);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  // Fetch all available cleaned tags from backend (once on mount)
  // Uses /api/tags/cleaned which has optimized SQL aggregation and caching
  useEffect(() => {
    const fetchAllTags = async () => {
      try {
        const response = await authGet('/api/tags/cleaned');
        if (response.ok) {
          const tags = await response.json();
          setAllTags(tags);
        }
      } catch (error) {
        logger.error('Error fetching cleaned tags:', error);
      }
    };
    fetchAllTags();
  }, [authGet]);

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / pageSize);

  // Use tags from backend API instead of extracting from current page
  const tagsByCategory = allTags;

  // Client-side tag filtering (tags are complex to filter server-side)
  // Priority: Cleaned tags > Raw tags
  const filteredResumes = useMemo((): Resume[] => {
    if (selectedTags.length === 0) return resumes;
    
    return resumes.filter(resume => {
      // Helper to parse JSON tags safely
      const parseTags = (value: unknown): string[] => {
        if (!value) return [];
        try {
          if (typeof value === 'string') {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map(t => String(t).toLowerCase().trim()) : [];
          }
          if (Array.isArray(value)) {
            return value.map(t => String(t).toLowerCase().trim());
          }
        } catch {
          // Skip invalid JSON
        }
        return [];
      };
      
      // Get tags from cleaned fields first (with underscore), fallback to raw
      // Backend returns: Skills_cleaned, Industries_cleaned, Tools_cleaned, Soft Skills_cleaned
      const skills = parseTags(resume['Skills_cleaned' as keyof Resume]) || parseTags(resume['Skills' as keyof Resume]);
      const industries = parseTags(resume['Industries_cleaned' as keyof Resume]) || parseTags(resume['Industries' as keyof Resume]);
      const tools = parseTags(resume['Tools_cleaned' as keyof Resume]) || parseTags(resume['Tools' as keyof Resume]);
      const softSkills = parseTags(resume['Soft Skills_cleaned' as keyof Resume]) || parseTags(resume['Soft Skills' as keyof Resume]);
      
      const resumeTags = [...skills, ...industries, ...tools, ...softSkills];
      
      // Compare in lowercase for case-insensitive matching
      return selectedTags.every(selectedTag => 
        resumeTags.some(resumeTag => resumeTag === selectedTag.toLowerCase().trim())
      );
    });
  }, [resumes, selectedTags]);

  const handleTagClick = (tag: string): void => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleResumeClick = (resume: Resume): void => {
    navigate(`/resumes/${resume.id}/analysis`);
  };

  const openDeleteConfirm = (resume: Resume, event: MouseEvent): void => {
    event.stopPropagation();
    setResumeToDelete(resume);
    setShowDeleteConfirm(true);
  };

  const closeDeleteConfirm = (): void => {
    setShowDeleteConfirm(false);
    setResumeToDelete(null);
  };

  const confirmDeleteResume = async (): Promise<void> => {
    if (resumeToDelete) {
      try {
        await deleteResume(resumeToDelete.id);
        // Refresh the list after successful deletion
        await fetchResumes();
      } catch (error) {
        logger.error("Failed to delete resume from page:", error);
      }
      closeDeleteConfirm();
    }
  };

  const clearFilters = (): void => {
    setSelectedTags([]);
    setSearchQuery('');
  };

  const handleDownloadResume = async (resume: Resume, event: MouseEvent): Promise<void> => {
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
      const a = document.createElement('a');
      a.href = url;
      a.download = resume['Resume File']?.[0]?.filename || resume['File Name'] || 'resume';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Error downloading resume:', error);
    }
  };

  const getTagCategory = (tag: string): string => {
    for (const [category, tags] of Object.entries(tagsByCategory)) {
      if (tags.includes(tag)) return category;
    }
    return 'Skills';
  };

  const formatResumeDate = (dateString?: string): string => {
    return formatDate(dateString, 'medium') || 'Invalid date';
  };

  // Stats based on current page data (case-insensitive status comparison)
  const stats: Stats = {
    total: totalCount,
    improved: resumes.filter(r => r.Status?.toLowerCase() === 'improved').length,
    processing: resumes.filter(r => r.Status?.toLowerCase() === 'processing' || r.Status?.toLowerCase() === 'analyzing').length,
    avgScore: resumes.length > 0 
      ? Math.round(resumes.reduce((sum, r) => {
          // Use improved rating if available, otherwise use global rating
          const rating = r['Improved Global Rating'] || r['Global Rating'];
          const score = typeof rating === 'number' ? rating : parseInt(String(rating || '0').replace('%', '')) || 0;
          return sum + score;
        }, 0) / resumes.length)
      : 0
  };

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
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
          {t('resumes.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('resumes.subtitle')}
        </p>
      </div>

      <StatsCards stats={stats} t={t} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <SearchAndActions
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isFilterExpanded={isFilterExpanded}
          onToggleFilter={() => setIsFilterExpanded(!isFilterExpanded)}
          selectedTagsCount={selectedTags.length}
          onRefresh={fetchResumes}
          onUpload={() => navigate('/upload?new')}
          onReset={clearFilters}
          t={t}
        />

        <AnimatePresence>
          {isFilterExpanded && (
            <motion.div
              variants={filterContentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="pt-4 space-y-4">
                {selectedTags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('resumes.activeFilters')}:</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map(tag => {
                        const category = getTagCategory(tag);
                        return (
                          <span key={tag} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${tagColorMap[category]}`}>
                            {tag}
                            <button onClick={() => handleTagClick(tag)} className="hover:opacity-70">
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    </div>
                )}
                {Object.entries(tagsByCategory).map(([category, tags]) => {
                  const isExpanded = expandedCategories[category];
                  const displayedTags = isExpanded ? tags : tags.slice(0, 15);
                  const hasMore = tags.length > 15;
                  
                  return tags.length > 0 && (
                    <div key={category}>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t(`resumes.filters.${category.toLowerCase().replace(' ', '')}`)}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {displayedTags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => handleTagClick(tag)}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm transition-all ${
                              selectedTags.includes(tag)
                                ? tagFilterColors[category]?.selected || 'bg-blue-500 text-white'
                                : tagFilterColors[category]?.unselected || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                        {hasMore && (
                          <button
                            onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !isExpanded }))}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline py-1 font-medium"
                          >
                            {isExpanded ? t('resumes.showLess') : `+${tags.length - 15} ${t('resumes.more')}`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Top pagination info */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
        loading={loading}
        itemName={t('resumes.results')}
      />

      {loading ? (
        <SkeletonResumeList count={6} />
      ) : filteredResumes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('resumes.noResults')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery || selectedTags.length > 0 ? t('resumes.noResultsFiltered') : t('resumes.uploadFirst')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResumes.map((resume, index) => (
            <motion.div
              key={resume.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow overflow-hidden cursor-pointer"
              onClick={() => handleResumeClick(resume)}
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <DocumentTextIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {resume.Name || resume['Resume File']?.[0]?.filename || t('resumes.untitled')}
                      </h3>
                    </div>
                    {resume.Title && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">{resume.Title}</p>
                    )}
                  </div>
                  <span className={classNames(
                    'ml-2 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0',
                    resume.Status?.toLowerCase() === 'improved' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : resume.Status?.toLowerCase() === 'analyzed'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      : resume.Status?.toLowerCase() === 'processing'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      : resume.Status?.toLowerCase() === 'pending'
                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                      : resume.Status?.toLowerCase() === 'error' || resume.Status?.toLowerCase() === 'failed'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      : resume.Status?.toLowerCase() === 'archived'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  )}>
                    {t(`resumes.status.${resume.Status?.toLowerCase() || 'new'}`)}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ChartBarIcon className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('resumes.score_label')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {resume['Improved Global Rating'] && resume['Improved Global Rating'] !== resume['Global Rating'] ? (
                      <>
                        <span className="text-sm text-gray-400 line-through">{resume['Global Rating'] != null ? `${resume['Global Rating']}%` : '0%'}</span>
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">{resume['Improved Global Rating'] != null ? `${resume['Improved Global Rating']}%` : '0%'}</span>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-gray-900 dark:text-white">{resume['Global Rating'] != null ? `${resume['Global Rating']}%` : '0%'}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {formatResumeDate(resume['Created At'])}
                  </div>
                  {resume.consent_status && (
                    <ConsentBadge
                      status={resume.consent_status}
                      candidateName={resume.candidate_name}
                      candidateEmail={resume.candidate_email}
                      consentTokenExpiresAt={resume.consent_token_expires_at}
                      retentionUntil={resume.retention_until}
                      compact={true}
                    />
                  )}
                </div>
                
                {/* Firm badge */}
                {resume.FirmName && (
                  <div className="flex items-center gap-1 mb-3">
                    <BuildingOfficeIcon className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {resume.FirmName}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-1">
                  {(['Skills', 'Industries', 'Tools', 'Soft Skills'] as const).map(category => {
                    let tags: string[] = [];
                    try {
                      // Try cleaned tags first
                      const cleanedField = `${category} Cleaned`;
                      const cleanedValue = resume[cleanedField as keyof Resume];
                      if (cleanedValue && typeof cleanedValue === 'string') {
                        const cleanedTags = JSON.parse(cleanedValue);
                        if (Array.isArray(cleanedTags) && cleanedTags.length > 0) {
                          tags = cleanedTags;
                        }
                      }
                      // Fallback to raw tags
                      if (tags.length === 0) {
                        const rawValue = resume[category];
                        if (rawValue && typeof rawValue === 'string') {
                          tags = JSON.parse(rawValue);
                        }
                      }
                    } catch {
                      tags = [];
                    }
                    return tags.slice(0, 2).map((tag, idx) => (
                      <span key={`${category}-${idx}`} className={`text-xs px-2 py-0.5 rounded-full ${tagColorMap[category]}`}>
                        {tag}
                      </span>
                    ));
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 p-4 pt-0">
                <button
                  onClick={(e) => { e.stopPropagation(); handleResumeClick(resume); }}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <EyeIcon className="w-4 h-4" />
                  {t('resumes.view')}
                </button>
                {resume['Resume File']?.[0]?.filename && (
                  <button
                    onClick={(e) => handleDownloadResume(resume, e)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    title={t('resumes.downloadResume')}
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => openDeleteConfirm(resume, e)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  title={t('resumes.deleteResume')}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Bottom pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
        loading={loading}
        itemName={t('resumes.results')}
      />

      {showDeleteConfirm && resumeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('resumes.confirmDeleteTitle')}</h3>
              <button onClick={closeDeleteConfirm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                {t('resumes.confirmDeleteMessage', { filename: resumeToDelete['Resume File']?.[0]?.filename || resumeToDelete.Name || 'this resume' })}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeDeleteConfirm}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmDeleteResume}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? t('common.deleting') : t('common.delete')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default ResumesPage;
