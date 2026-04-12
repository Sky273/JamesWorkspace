/**
 * useDealsGroupedData Hook
 * Data fetching, filtering, and tag helper logic for DealsGroupedView
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import logger from '../../utils/logger.frontend';
import type {
  ResumeBasic,
  DealGroup,
  GroupedData,
  TagsByCategory
} from './dealsGrouped.types';

interface UseDealsGroupedDataParams {
  allTags: TagsByCategory;
}

export function useDealsGroupedData({ allTags }: UseDealsGroupedDataParams) {
  const { authGet } = useAuthFetch();
  const [data, setData] = useState<GroupedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set());
  const [unassignedExpanded, setUnassignedExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const isInitialLoadRef = useRef(true);
  const groupedRequestIdRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchGroupedData = useCallback(async (options: { forceRefresh?: boolean } = {}) => {
    const requestId = ++groupedRequestIdRef.current;
    try {
      setLoading(true);
      const suffix = options.forceRefresh ? '?refresh=1' : '';
      const response = await authGet(`/api/resumes/grouped-by-deal${suffix}`);
      if (response.ok) {
        const result = await response.json();
        if (requestId !== groupedRequestIdRef.current) {
          return;
        }
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
      if (requestId !== groupedRequestIdRef.current) {
        return;
      }
      logger.error('Error fetching grouped resumes:', error);
    } finally {
      if (requestId === groupedRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [authGet]);

  const refreshGroupedData = useCallback(async (): Promise<void> => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    groupedRequestIdRef.current += 1;
    if (normalizedSearch !== debouncedSearch) {
      setDebouncedSearch(normalizedSearch);
    }
    await fetchGroupedData({ forceRefresh: true });
  }, [debouncedSearch, fetchGroupedData, searchQuery]);

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

  // Save current view state to sessionStorage before navigating away
  const saveViewState = useCallback(() => {
    const state = {
      expandedDeals: Array.from(expandedDeals),
      unassignedExpanded,
      scrollY: window.scrollY
    };
    sessionStorage.setItem('dealsGroupedViewState', JSON.stringify(state));
  }, [expandedDeals, unassignedExpanded]);

  // --- Tag helpers ---

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

  const getResumeTags = useCallback((resume: ResumeBasic): Record<string, string[]> => {
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
  }, []);

  const getTagCategory = useCallback((tag: string): string => {
    for (const [category, tags] of Object.entries(allTags)) {
      if (tags.includes(tag)) return category;
    }
    return 'Skills';
  }, [allTags]);

  const handleTagClick = (tag: string): void => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(current => current !== tag)
        : [...prev, tag]
    );
  };

  // --- Filtering ---

  const hasMatchingSearch = useCallback((resume: ResumeBasic, deal: DealGroup): boolean => {
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
  }, [debouncedSearch]);

  const matchesSelectedTags = useCallback((resume: ResumeBasic): boolean => {
    if (selectedTags.length === 0) return true;
    const tags = getResumeTags(resume);
    const resumeTags = [...tags.skills, ...tags.industries, ...tags.tools, ...tags.soft_skills];

    return selectedTags.every(selectedTag => resumeTags.includes(selectedTag.toLowerCase().trim()));
  }, [selectedTags, getResumeTags]);

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
  }, [data, debouncedSearch, selectedTags, hasMatchingSearch, matchesSelectedTags]);

  const hasActiveFilters = debouncedSearch !== '' || selectedTags.length > 0;
  const visibleData = filteredData || data;
  const autoExpandedDealIds = useMemo(
    () => new Set((visibleData?.deals || []).map(deal => deal.id)),
    [visibleData]
  );

  return {
    data,
    loading,
    expandedDeals,
    unassignedExpanded,
    setUnassignedExpanded,
    searchQuery,
    setSearchQuery,
    selectedTags,
    fetchGroupedData: refreshGroupedData,
    clearFilters,
    toggleDeal,
    saveViewState,
    getResumeTags,
    getTagCategory,
    handleTagClick,
    hasActiveFilters,
    visibleData,
    autoExpandedDealIds,
  };
}
