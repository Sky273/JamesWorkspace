/**
 * AdaptationsDealsGroupedView - Display adaptations grouped by deal > mission
 * Mirrors the pattern of MissionsDealsGroupedView for adaptations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderOpenIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import logger from '../../utils/logger.frontend';
import toast from 'react-hot-toast';
import { SkeletonAdaptationList } from '../ui/Skeleton';
import { DealSection, GroupedSearchHeader, MissionSection } from './AdaptationsDealsGroupedView.parts';
import type { GroupedData, GroupedMission } from './AdaptationsDealsGroupedView.types';

const AdaptationsDealsGroupedView = (): JSX.Element => {
  const { t } = useTranslation();
  const { authGet } = useAuthFetch();
  const tf = (key: string, options?: unknown): string => String(t(key, options as never));

  const [data, setData] = useState<GroupedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDeals, setExpandedDeals] = useState<Record<string, boolean>>({});
  const [unassignedExpanded, setUnassignedExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const groupedRequestIdRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchGroupedData = useCallback(async (options: { forceRefresh?: boolean } = {}) => {
    const requestId = ++groupedRequestIdRef.current;
    try {
      setLoading(true);
      const suffix = options.forceRefresh ? '?refresh=1' : '';
      const response = await authGet(`/api/adaptations/grouped-by-deal${suffix}`);
      if (!response.ok) throw new Error('Failed to fetch grouped adaptations');
      const result: GroupedData = await response.json();
      if (requestId !== groupedRequestIdRef.current) {
        return;
      }
      setData(result);

      const expanded: Record<string, boolean> = {};
      result.deals.forEach(deal => {
        if (deal.adaptations_count > 0) {
          expanded[deal.id] = true;
        }
      });
      setExpandedDeals(prev => {
        const merged = { ...expanded };
        Object.keys(prev).forEach(key => {
          merged[key] = prev[key];
        });
        return merged;
      });
    } catch (error) {
      if (requestId !== groupedRequestIdRef.current) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching grouped adaptations:', error);
        toast.error(t('adaptations.grouped.fetchError'));
      }
    } finally {
      if (requestId === groupedRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [authGet, t]);

  const refreshGroupedData = useCallback(async (): Promise<void> => {
    const normalizedSearch = searchQuery.trim();
    groupedRequestIdRef.current += 1;
    if (normalizedSearch !== debouncedSearch) {
      setDebouncedSearch(normalizedSearch);
    }
    await fetchGroupedData({ forceRefresh: true });
  }, [debouncedSearch, fetchGroupedData, searchQuery]);

  useEffect(() => {
    fetchGroupedData();
  }, [fetchGroupedData]);

  const toggleDeal = (dealId: string) => {
    setExpandedDeals(prev => ({ ...prev, [dealId]: !prev[dealId] }));
  };

  const filterMissions = useCallback((missions: GroupedMission[]): GroupedMission[] => {
    if (!debouncedSearch) return missions;
    const q = debouncedSearch.toLowerCase();
    return missions
      .map(mission => {
        const filteredAdaptations = mission.adaptations.filter(adaptation =>
          adaptation.resume_name?.toLowerCase().includes(q) ||
          adaptation.candidate_name?.toLowerCase().includes(q) ||
          adaptation.adapted_title?.toLowerCase().includes(q)
        );
        const missionMatches = mission.title?.toLowerCase().includes(q) || mission.client_name?.toLowerCase().includes(q);
        if (missionMatches) return mission;
        if (filteredAdaptations.length > 0) {
          return { ...mission, adaptations: filteredAdaptations, adaptations_count: filteredAdaptations.length };
        }
        return null;
      })
      .filter((mission): mission is GroupedMission => mission !== null);
  }, [debouncedSearch]);

  const filteredDeals = data?.deals.map(deal => {
    const q = debouncedSearch?.toLowerCase();
    const dealTitleMatches = q && deal.title?.toLowerCase().includes(q);
    const filteredMissions = dealTitleMatches ? deal.missions : filterMissions(deal.missions);
    const totalAdaptations = filteredMissions.reduce((sum, mission) => sum + mission.adaptations_count, 0);
    return {
      ...deal,
      missions: dealTitleMatches ? deal.missions : filteredMissions,
      missions_count: (dealTitleMatches ? deal.missions : filteredMissions).length,
      adaptations_count: dealTitleMatches ? deal.adaptations_count : totalAdaptations,
    };
  }).filter(deal => debouncedSearch ? deal.adaptations_count > 0 || deal.missions_count > 0 : true) || [];

  const filteredUnassigned = filterMissions(data?.unassigned || []);
  const totalAdaptations =
    filteredDeals.reduce((sum, deal) => sum + deal.adaptations_count, 0) +
    filteredUnassigned.reduce((sum, mission) => sum + mission.adaptations_count, 0);

  if (loading) {
    return <SkeletonAdaptationList count={6} />;
  }

  return (
    <div className="space-y-4">
      <GroupedSearchHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRefresh={refreshGroupedData}
        onClear={() => setSearchQuery('')}
        t={tf}
      />

      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 px-1">
        <span className="font-medium">
          {totalAdaptations} adaptation{totalAdaptations !== 1 ? 's' : ''}
        </span>
        <span>•</span>
        <span>{filteredDeals.length} {t('adaptations.grouped.deals')}</span>
        {filteredUnassigned.length > 0 && (
          <>
            <span>•</span>
            <span>{filteredUnassigned.reduce((sum, mission) => sum + mission.adaptations_count, 0)} {t('adaptations.grouped.unassigned')}</span>
          </>
        )}
      </div>

      {filteredDeals.map(deal => (
        <DealSection
          key={deal.id}
          deal={deal}
          isExpanded={expandedDeals[deal.id] || false}
          onToggle={() => toggleDeal(deal.id)}
        />
      ))}

      {filteredUnassigned.length > 0 && (
        <div className="rounded-lg shadow overflow-hidden bg-white dark:bg-gray-800">
          <button
            onClick={() => setUnassignedExpanded(!unassignedExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              {unassignedExpanded ? (
                <ChevronDownIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              )}
              <FolderOpenIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <h3 className="font-semibold text-gray-600 dark:text-gray-300">
                {t('adaptations.grouped.unassignedTitle')}
              </h3>
            </div>
            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full text-sm font-medium">
              {filteredUnassigned.reduce((sum, mission) => sum + mission.adaptations_count, 0)} adapt.
            </span>
          </button>

          <AnimatePresence>
            {unassignedExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 space-y-2 pt-3">
                  {filteredUnassigned.map((mission, missionIndex) => (
                    <MissionSection key={mission.id} mission={mission} missionIndex={missionIndex} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {totalAdaptations === 0 && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <SparklesIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {debouncedSearch ? t('adaptations.noAdaptationsFiltered') : t('adaptations.noAdaptations')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {debouncedSearch ? t('adaptations.grouped.noSearchResults') : t('adaptations.noAdaptationsPrompt')}
          </p>
        </div>
      )}
    </div>
  );
};

export default AdaptationsDealsGroupedView;
