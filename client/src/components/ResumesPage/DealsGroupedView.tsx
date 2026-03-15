/**
 * DealsGroupedView - Display resumes grouped by deal
 * Collapsible accordion sections for each deal + unassigned resumes
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BriefcaseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  BuildingOfficeIcon,
  FolderOpenIcon,
  UserIcon,
  ChartBarIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { useResume } from '../../context/ResumeContext';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import logger from '../../utils/logger.frontend';
import { SkeletonResumeList } from '../ui/Skeleton';
import SearchAndActions from './SearchAndActions';
import DealExportModal from './DealExportModal';
import DealResumeCard from './DealResumeCard';
import { useDealDragDrop } from './useDealDragDrop';
import {
  type ResumeBasic,
  type DealGroup,
  type GroupedData,
  type DealsGroupedViewProps,
  STATUS_COLORS,
  STATUS_LABELS,
  PRIORITY_ICONS,
  TAG_FILTER_COLORS,
  FILTER_CONTENT_VARIANTS,
  INITIAL_RESUMES_LIMIT
} from './dealsGrouped.types';

const DealsGroupedView = ({ allTags }: DealsGroupedViewProps): JSX.Element => {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const { deleteResume, deleting } = useResume();
  const { authGet } = useAuthFetch();
  const navigate = useNavigate();
  const [data, setData] = useState<GroupedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set());
  const [unassignedExpanded, setUnassignedExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [resumeToDelete, setResumeToDelete] = useState<ResumeBasic | null>(null);

  // Deal export modal state
  const [exportingDeal, setExportingDeal] = useState<{ id: string; title: string; resumeCount: number; adaptationCount: number } | null>(null);

  const isInitialLoadRef = useRef(true);

  // "Show more" state for each deal section (key: deal id or 'unassigned')
  const [expandedResumeSections, setExpandedResumeSections] = useState<Set<string>>(new Set());

  // Save current view state to sessionStorage before navigating away
  const saveViewState = useCallback(() => {
    const state = {
      expandedDeals: Array.from(expandedDeals),
      unassignedExpanded,
      scrollY: window.scrollY
    };
    sessionStorage.setItem('dealsGroupedViewState', JSON.stringify(state));
  }, [expandedDeals, unassignedExpanded]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchGroupedData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authGet('/api/resumes/grouped-by-deal');
      if (response.ok) {
        const result = await response.json();
        setData(result);
        // On first load, try to restore saved state, otherwise auto-expand deals with resumes
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
          const savedState = sessionStorage.getItem('dealsGroupedViewState');
          if (savedState) {
            try {
              const parsed = JSON.parse(savedState);
              setExpandedDeals(new Set(parsed.expandedDeals || []));
              setUnassignedExpanded(parsed.unassignedExpanded || false);
              // Restore scroll position after render
              if (parsed.scrollY != null) {
                requestAnimationFrame(() => {
                  setTimeout(() => window.scrollTo(0, parsed.scrollY), 50);
                });
              }
              sessionStorage.removeItem('dealsGroupedViewState');
            } catch {
              // Fallback: expand deals with resumes
              const dealsWithResumes = new Set<string>(
                result.deals.filter((d: DealGroup) => d.resumes.length > 0).map((d: DealGroup) => d.id)
              );
              setExpandedDeals(dealsWithResumes);
            }
          } else {
            const dealsWithResumes = new Set<string>(
              result.deals.filter((d: DealGroup) => d.resumes.length > 0).map((d: DealGroup) => d.id)
            );
            setExpandedDeals(dealsWithResumes);
          }
        }
      }
    } catch (error) {
      logger.error('Error fetching grouped resumes:', error);
    } finally {
      setLoading(false);
    }
  }, [authGet]);

  useEffect(() => {
    fetchGroupedData();
  }, [fetchGroupedData]);

  const clearFilters = (): void => {
    setSearchQuery('');
    setSelectedTags([]);
  };

  const toggleDeal = (dealId: string) => {
    setExpandedDeals(prev => {
      const next = new Set(prev);
      if (next.has(dealId)) {
        next.delete(dealId);
      } else {
        next.add(dealId);
      }
      return next;
    });
  };

  // Drag & Drop (extracted hook)
  const {
    draggedResume,
    dragOverDealId,
    dropping,
    handleDragStart,
    handleDragEnd,
    handleDragEnterDeal,
    handleDragLeaveDeal,
    handleDragOverDeal,
    handleDropOnDeal
  } = useDealDragDrop({ data, fetchGroupedData });

  const handleResumeClick = (resumeId: string) => {
    saveViewState();
    navigate(`/resumes/${resumeId}/analysis`, { state: { from: 'dealsGroupedView' } });
  };

  const openDeleteConfirm = (resume: ResumeBasic, e: React.MouseEvent): void => {
    e.stopPropagation();
    setResumeToDelete(resume);
    setShowDeleteConfirm(true);
  };

  const closeDeleteConfirm = (): void => {
    setShowDeleteConfirm(false);
    setResumeToDelete(null);
  };

  const confirmDeleteResume = async (): Promise<void> => {
    if (!resumeToDelete) return;
    try {
      await deleteResume(resumeToDelete.id);
      await fetchGroupedData();
    } catch (error) {
      logger.error('Failed to delete resume from grouped view:', error);
    }
    closeDeleteConfirm();
  };

  const handleDownload = async (resume: ResumeBasic, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await authGet(`/api/resumes/${resume.id}/download`);
      if (!response.ok) return;
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resume.file_name || resume.name || 'resume';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Error downloading resume:', error);
    }
  };

  const parseTags = (value: unknown): string[] => {
    if (!value) return [];
    try {
      if (typeof value === 'string') {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(tag => String(tag).toLowerCase().trim()) : [];
      }

      if (Array.isArray(value)) {
        return value.map(tag => String(tag).toLowerCase().trim());
      }

      return [];
    } catch {
      return [];
    }
  };

  const getResumeTags = (resume: ResumeBasic): Record<string, string[]> => {
    const skills = parseTags(resume.skills_cleaned);
    const industries = parseTags(resume.industries_cleaned);
    const tools = parseTags(resume.tools_cleaned);
    const softSkills = parseTags(resume.soft_skills_cleaned);

    return {
      skills: skills.length > 0 ? skills : parseTags(resume.skills),
      industries: industries.length > 0 ? industries : parseTags(resume.industries),
      tools: tools.length > 0 ? tools : parseTags(resume.tools),
      soft_skills: softSkills.length > 0 ? softSkills : parseTags(resume.soft_skills)
    };
  };

  const getTagCategory = (tag: string): string => {
    for (const [category, tags] of Object.entries(allTags)) {
      if (tags.includes(tag)) return category;
    }
    return 'Skills';
  };

  const handleTagClick = (tag: string): void => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(current => current !== tag)
        : [...prev, tag]
    );
  };

  const hasMatchingSearch = (resume: ResumeBasic, deal: DealGroup): boolean => {
    if (!debouncedSearch) return true;
    const searchableParts = [
      resume.name,
      resume.title,
      resume.file_name,
      resume.original_name,
      resume.relative_path,
      deal.title,
      deal.client_name,
      deal.contact_name,
      ...(deal.missions || []).map(mission => mission.title)
    ];

    return searchableParts
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(debouncedSearch));
  };

  const matchesSelectedTags = (resume: ResumeBasic): boolean => {
    if (selectedTags.length === 0) return true;
    const tags = getResumeTags(resume);
    const resumeTags = [...tags.skills, ...tags.industries, ...tags.tools, ...tags.soft_skills];

    return selectedTags.every(selectedTag => resumeTags.includes(selectedTag.toLowerCase().trim()));
  };

  const filteredData = useMemo(() => {
    if (!data) return null;
    const hasSearchFilter = debouncedSearch !== '';
    const hasTagFilters = selectedTags.length > 0;

    if (!hasSearchFilter && !hasTagFilters) {
      return data;
    }

    const filteredDeals = data.deals
      .map(deal => {
        const filteredResumes = deal.resumes.filter(resume =>
          hasMatchingSearch(resume, deal) && matchesSelectedTags(resume)
        );

        const dealMatchesSearch = hasSearchFilter && [
          deal.title,
          deal.client_name,
          deal.contact_name,
          ...(deal.missions || []).map(mission => mission.title)
        ]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(debouncedSearch));

        if (!dealMatchesSearch && filteredResumes.length === 0) {
          return null;
        }

        return {
          ...deal,
          resumes: filteredResumes
        };
      })
      .filter((deal): deal is DealGroup => deal !== null);

    const filteredUnassigned = data.unassigned.filter(resume =>
      hasMatchingSearch(resume, {
        id: '',
        title: '',
        status: '',
        priority: '',
        resumes_count: 0,
        resumes: [],
        missions: []
      }) && matchesSelectedTags(resume)
    );

    return {
      deals: filteredDeals,
      unassigned: filteredUnassigned,
      totalDeals: filteredDeals.length,
      totalAssigned: filteredDeals.reduce((sum, deal) => sum + deal.resumes.length, 0),
      totalUnassigned: filteredUnassigned.length
    };
  }, [data, debouncedSearch, selectedTags]);

  const hasActiveFilters = debouncedSearch !== '' || selectedTags.length > 0;
  const visibleData = filteredData || data;
  const autoExpandedDealIds = useMemo(
    () => new Set((visibleData?.deals || []).map(deal => deal.id)),
    [visibleData]
  );

  const getDownloadTitle = (resume: ResumeBasic): string => {
    const lines = [t('resumes.downloadResume')];

    if (resume.relative_path) {
      lines.push(resume.relative_path);
    } else if (resume.original_name) {
      lines.push(resume.original_name);
    }

    return lines.join('\n');
  };

  const renderResumeCard = (resume: ResumeBasic, sourceDealId: string | null) => (
    <DealResumeCard
      key={resume.id}
      resume={resume}
      sourceDealId={sourceDealId}
      isDragging={draggedResume?.resumeId === resume.id}
      dropping={dropping}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleResumeClick}
      onDownload={handleDownload}
      onDelete={openDeleteConfirm}
      onDealChange={fetchGroupedData}
      getResumeTags={getResumeTags}
      getDownloadTitle={getDownloadTitle}
    />
  );

  if (loading) {
    return <SkeletonResumeList count={6} />;
  }

  if (!data || !visibleData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <BriefcaseIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">{t('resumes.groupedView.errorLoading', 'Erreur lors du chargement')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <SearchAndActions
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isFilterExpanded={isFilterExpanded}
          onToggleFilter={() => setIsFilterExpanded(!isFilterExpanded)}
          selectedTagsCount={selectedTags.length}
          onRefresh={fetchGroupedData}
          onUpload={() => navigate('/upload?new')}
          onBatchUpload={authUser?.role?.toLowerCase() === 'admin' ? () => navigate('/batch-upload') : undefined}
          onReset={clearFilters}
          t={t}
        />

        <AnimatePresence>
          {isFilterExpanded && (visibleData.totalAssigned > 0 || visibleData.totalUnassigned > 0 || Object.values(allTags).some(tags => tags.length > 0)) && (
            <motion.div
              variants={FILTER_CONTENT_VARIANTS}
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
                        const colorClass = TAG_FILTER_COLORS[category]?.selected || 'bg-blue-500 text-white';
                        return (
                          <span key={tag} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${colorClass}`}>
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

                {Object.entries(allTags).map(([category, tags]) => {
                  const isExpandedCategory = expandedCategories[category];
                  const displayedTags = isExpandedCategory ? tags : tags.slice(0, 15);
                  const canExpand = tags.length > 15;

                  return tags.length > 0 ? (
                    <div key={category}>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t(`resumes.filters.${category.toLowerCase().replace(' ', '')}`)}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {displayedTags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => handleTagClick(tag)}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm transition-all ${
                              selectedTags.includes(tag)
                                ? TAG_FILTER_COLORS[category]?.selected || 'bg-blue-500 text-white'
                                : TAG_FILTER_COLORS[category]?.unselected || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                        {canExpand && (
                          <button
                            onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !isExpandedCategory }))}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline py-1 font-medium"
                          >
                            {isExpandedCategory ? t('resumes.showLess') : `+${tags.length - 15} ${t('resumes.more')}`}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3">
        <div className="flex items-center gap-1.5">
          <BriefcaseIcon className="w-4 h-4" />
          <span><strong>{visibleData.totalDeals}</strong> {t('resumes.groupedView.deals', 'affaires')}</span>
        </div>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <div className="flex items-center gap-1.5">
          <DocumentTextIcon className="w-4 h-4" />
          <span><strong>{visibleData.totalAssigned}</strong> {t('resumes.groupedView.assigned', 'CVs affectés')}</span>
        </div>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <div className="flex items-center gap-1.5">
          <FolderOpenIcon className="w-4 h-4" />
          <span><strong>{visibleData.totalUnassigned}</strong> {t('resumes.groupedView.unassigned', 'non affectés')}</span>
        </div>
      </div>

      {/* Deal sections */}
      {visibleData.deals.map(deal => {
        const originalDeal = data.deals.find(candidate => candidate.id === deal.id) || deal;
        const isExpanded = hasActiveFilters ? autoExpandedDealIds.has(deal.id) : expandedDeals.has(deal.id);
        const priorityInfo = PRIORITY_ICONS[deal.priority] || PRIORITY_ICONS.medium;
        const isDragOver = dragOverDealId === deal.id;
        const isSourceDeal = draggedResume?.sourceDealId === deal.id;

        return (
          <div
            key={deal.id}
            className={`rounded-lg shadow overflow-hidden transition-all duration-200 ${
              isDragOver
                ? 'bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-400 dark:ring-purple-500 ring-offset-1'
                : isSourceDeal && draggedResume
                  ? 'bg-white dark:bg-gray-800 opacity-60'
                  : 'bg-white dark:bg-gray-800'
            }`}
            onDragEnter={(e) => handleDragEnterDeal(e, deal.id)}
            onDragLeave={(e) => handleDragLeaveDeal(e, deal.id)}
            onDragOver={handleDragOverDeal}
            onDrop={(e) => handleDropOnDeal(e, deal.id)}
          >
            {/* Deal header */}
            <button
              onClick={() => toggleDeal(deal.id)}
              className={`w-full flex items-center justify-between px-4 py-3 transition-colors text-left ${
                isDragOver
                  ? 'bg-purple-100/50 dark:bg-purple-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {isExpanded ? (
                  <ChevronDownIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
                <BriefcaseIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{deal.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[deal.status] || STATUS_COLORS.open}`}>
                      {t(`crm.deals.statuses.${deal.status}`, STATUS_LABELS[deal.status] || deal.status)}
                    </span>
                    <span className={`text-xs ${priorityInfo.color}`}>{priorityInfo.icon}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {deal.client_name && (
                      <span className="flex items-center gap-1">
                        <BuildingOfficeIcon className="w-3 h-3" />
                        {deal.client_name}
                        {deal.client_type && <span className="text-gray-400">({deal.client_type})</span>}
                      </span>
                    )}
                    {deal.contact_name && (
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3 h-3" />
                        {deal.contact_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="ml-4 flex items-center gap-2 flex-shrink-0">
                {deal.missions && deal.missions.length > 0 && (
                  <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full text-sm font-medium">
                    {deal.missions.length} mission{deal.missions.length !== 1 ? 's' : ''}
                  </span>
                )}
                <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full text-sm font-medium">
                  {hasActiveFilters && deal.resumes.length !== originalDeal.resumes.length
                    ? `${deal.resumes.length} / ${originalDeal.resumes.length} CV${originalDeal.resumes.length !== 1 ? 's' : ''}`
                    : `${deal.resumes.length} CV${deal.resumes.length !== 1 ? 's' : ''}`}
                </span>
                {/* Export button */}
                <span
                  role="button"
                  tabIndex={0}
                  title={t('dealExport.buttonTitle', 'Exporter cette affaire')}
                  onClick={(e) => {
                    e.stopPropagation();
                    const adaptationCount = (deal.missions || []).reduce(
                      (sum, m) => sum + (m.adaptations?.length || 0), 0
                    );
                    setExportingDeal({
                      id: originalDeal.id,
                      title: originalDeal.title,
                      resumeCount: originalDeal.resumes.length,
                      adaptationCount
                    });
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.currentTarget.click(); } }}
                  className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors cursor-pointer"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                </span>
              </div>
            </button>

            {/* Drop indicator when dragging over collapsed deal */}
            {isDragOver && !isExpanded && (
              <div className="px-4 py-3 border-t border-purple-200 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/20">
                <p className="text-center text-sm text-purple-600 dark:text-purple-400 font-medium">
                  ↓ {t('resumes.groupedView.dropHere', 'Déposer ici pour ajouter à cette affaire')}
                </p>
              </div>
            )}

            {/* Deal resumes */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className={`px-4 pb-4 border-t ${isDragOver ? 'border-purple-200 dark:border-purple-700' : 'border-gray-100 dark:border-gray-700'}`}>
                    {isDragOver && (
                      <div className="mt-3 mb-2 py-2 border-2 border-dashed border-purple-300 dark:border-purple-600 rounded-lg bg-purple-50/50 dark:bg-purple-900/10">
                        <p className="text-center text-sm text-purple-500 dark:text-purple-400">
                          ↓ {t('resumes.groupedView.dropHere', 'Déposer ici pour ajouter à cette affaire')}
                        </p>
                      </div>
                    )}
                    {/* Missions section */}
                    {deal.missions && deal.missions.length > 0 && (
                      <div className="pt-3 mb-3">
                        <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <BriefcaseIcon className="w-3.5 h-3.5" />
                          {t('resumes.groupedView.missions', 'Missions')} ({deal.missions.length})
                        </h4>
                        <div className="space-y-2">
                          {deal.missions.map(mission => (
                            <div key={mission.id} className="border border-indigo-100 dark:border-indigo-800/30 rounded-lg overflow-hidden">
                              {/* Mission header */}
                              <div
                                onClick={() => navigate(`/missions/${mission.id}`)}
                                className="flex items-center justify-between px-3 py-2 bg-indigo-50 dark:bg-indigo-900/10 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <BriefcaseIcon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{mission.title}</span>
                                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                    mission.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    mission.status === 'closed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  }`}>
                                    {t(`missions.status.${mission.status || 'active'}`, mission.status)}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                  {mission.adaptations_count || 0} {t('resumes.groupedView.adaptations', 'adaptation(s)')}
                                </span>
                              </div>
                              {/* Adaptations under this mission */}
                              {mission.adaptations && mission.adaptations.length > 0 && (
                                <div className="px-3 py-2 bg-white dark:bg-gray-800/50 space-y-1.5">
                                  {mission.adaptations.map(adaptation => {
                                    const scoreColor = (adaptation.match_score || 0) >= 80
                                      ? 'text-green-600 dark:text-green-400'
                                      : (adaptation.match_score || 0) >= 60
                                      ? 'text-yellow-600 dark:text-yellow-400'
                                      : 'text-red-600 dark:text-red-400';
                                    const scoreBg = (adaptation.match_score || 0) >= 80
                                      ? 'bg-green-100 dark:bg-green-900/30'
                                      : (adaptation.match_score || 0) >= 60
                                      ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                      : 'bg-red-100 dark:bg-red-900/30';
                                    return (
                                      <div
                                        key={adaptation.id}
                                        onClick={(e) => { e.stopPropagation(); saveViewState(); navigate(`/adaptations/${adaptation.id}`, { state: { from: 'dealsGroupedView' } }); }}
                                        className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-md cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                                      >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <DocumentTextIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {adaptation.candidate_name || adaptation.resume_name || t('adaptations.card.noName', 'Sans nom')}
                                          </span>
                                          {adaptation.adapted_title && (
                                            <span className="text-xs text-blue-600 dark:text-blue-400 italic truncate max-w-[200px]">
                                              {adaptation.adapted_title}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          {adaptation.match_score != null && (
                                            <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold ${scoreBg} ${scoreColor}`}>
                                              <ChartBarIcon className="w-3 h-3" />
                                              {adaptation.match_score}%
                                            </span>
                                          )}
                                          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                            adaptation.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            adaptation.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                          }`}>
                                            {t(`adaptations.status.${adaptation.status || 'completed'}`, adaptation.status)}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resumes section */}
                    {deal.resumes.length === 0 && !isDragOver && (!deal.missions || deal.missions.length === 0) ? (
                      <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                        {t('resumes.groupedView.noResumes', 'Aucun CV associé à cette affaire')}
                      </p>
                    ) : deal.resumes.length > 0 ? (
                      <div className="space-y-2 pt-3">
                        {deal.resumes.length > 0 && deal.missions && deal.missions.length > 0 && (
                          <h4 className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <DocumentTextIcon className="w-3.5 h-3.5" />
                            {t('resumes.groupedView.cvs', 'CVs')} ({deal.resumes.length})
                          </h4>
                        )}
                        {(() => {
                          const isFullyExpanded = expandedResumeSections.has(deal.id);
                          const displayedResumes = isFullyExpanded ? deal.resumes : deal.resumes.slice(0, INITIAL_RESUMES_LIMIT);
                          const hiddenCount = deal.resumes.length - INITIAL_RESUMES_LIMIT;
                          return (
                            <>
                              {displayedResumes.map(resume => renderResumeCard(resume, deal.id))}
                              {!isFullyExpanded && hiddenCount > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedResumeSections(prev => new Set([...prev, deal.id]));
                                  }}
                                  className="w-full py-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors font-medium"
                                >
                                  {t('resumes.groupedView.showMore', 'Voir {{count}} CV(s) supplémentaire(s)').replace('{{count}}', String(hiddenCount))}
                                </button>
                              )}
                              {isFullyExpanded && deal.resumes.length > INITIAL_RESUMES_LIMIT && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedResumeSections(prev => {
                                      const next = new Set(prev);
                                      next.delete(deal.id);
                                      return next;
                                    });
                                  }}
                                  className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors"
                                >
                                  {t('resumes.groupedView.showLess', 'Voir moins')}
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Empty deals message */}
      {visibleData.deals.length === 0 && !hasActiveFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <BriefcaseIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-400">{t('resumes.groupedView.noDeals', 'Aucune affaire créée')}</p>
        </div>
      )}

      {visibleData.deals.length === 0 && visibleData.unassigned.length === 0 && hasActiveFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('resumes.noResults')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {t('resumes.noResultsFiltered')}
          </p>
        </div>
      )}

      {/* Unassigned resumes section */}
      {visibleData.unassigned.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <button
            onClick={() => {
              if (!hasActiveFilters) {
                setUnassignedExpanded(!unassignedExpanded);
              }
            }}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              {hasActiveFilters || unassignedExpanded ? (
                <ChevronDownIcon className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRightIcon className="w-5 h-5 text-gray-400" />
              )}
              <FolderOpenIcon className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">
                {t('resumes.groupedView.unassignedTitle', 'CVs non affectés à une affaire')}
              </h3>
            </div>
            <span className="ml-4 flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full text-sm font-medium">
              {hasActiveFilters && visibleData.unassigned.length !== data.unassigned.length
                ? `${visibleData.unassigned.length} / ${data.unassigned.length} CV${data.unassigned.length !== 1 ? 's' : ''}`
                : `${visibleData.unassigned.length} CV${visibleData.unassigned.length !== 1 ? 's' : ''}`}
            </span>
          </button>

          <AnimatePresence>
            {(hasActiveFilters || unassignedExpanded) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="space-y-2 pt-3">
                    {(() => {
                      const isFullyExpanded = expandedResumeSections.has('unassigned');
                      const displayedResumes = isFullyExpanded ? visibleData.unassigned : visibleData.unassigned.slice(0, INITIAL_RESUMES_LIMIT);
                      const hiddenCount = visibleData.unassigned.length - INITIAL_RESUMES_LIMIT;
                      return (
                        <>
                          {displayedResumes.map(resume => renderResumeCard(resume, null))}
                          {!isFullyExpanded && hiddenCount > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedResumeSections(prev => new Set([...prev, 'unassigned']));
                              }}
                              className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors font-medium"
                            >
                              {t('resumes.groupedView.showMore', 'Voir {{count}} CV(s) supplémentaire(s)').replace('{{count}}', String(hiddenCount))}
                            </button>
                          )}
                          {isFullyExpanded && visibleData.unassigned.length > INITIAL_RESUMES_LIMIT && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedResumeSections(prev => {
                                  const next = new Set(prev);
                                  next.delete('unassigned');
                                  return next;
                                });
                              }}
                              className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors"
                            >
                              {t('resumes.groupedView.showLess', 'Voir moins')}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Deal Export Modal */}
      {exportingDeal && (
        <DealExportModal
          dealId={exportingDeal.id}
          dealTitle={exportingDeal.title}
          resumeCount={exportingDeal.resumeCount}
          adaptationCount={exportingDeal.adaptationCount}
          onClose={() => setExportingDeal(null)}
        />
      )}

      {showDeleteConfirm && resumeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('resumes.confirmDelete')}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                {t('resumes.confirmDeleteMessage', { filename: resumeToDelete.name || t('resumes.untitled') })}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeDeleteConfirm}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
    </div>
  );
};

export default DealsGroupedView;
