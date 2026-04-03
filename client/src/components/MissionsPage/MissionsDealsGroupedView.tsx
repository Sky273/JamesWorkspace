/**
 * MissionsDealsGroupedView - Display missions grouped by deal
 * Collapsible accordion sections for each deal + unassigned missions
 */

import { useState, useEffect, useCallback } from 'react';
import { ChevronDownIcon, ChevronRightIcon, FolderOpenIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

import { useAuthFetch } from '../../hooks/useAuthFetch';
import logger from '../../utils/logger.frontend';
import { SkeletonMissionList } from '../ui/Skeleton';
import {
  DealSection,
  MissionCardInDeal,
  MissionsGroupedSummary,
  MissionsGroupedToolbar,
} from './MissionsDealsGroupedView.parts';
import type { GroupedData, GroupedMission, MissionsDealsGroupedViewProps } from './MissionsDealsGroupedView.types';

const MissionsDealsGroupedView = ({ onAddMission }: MissionsDealsGroupedViewProps): JSX.Element => {
  const { t } = useTranslation();
  const { authGet } = useAuthFetch();

  const [data, setData] = useState<GroupedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDeals, setExpandedDeals] = useState<Record<string, boolean>>({});
  const [unassignedExpanded, setUnassignedExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchGroupedData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authGet('/api/missions/grouped-by-deal');
      if (!response.ok) throw new Error('Failed to fetch grouped missions');
      const result: GroupedData = await response.json();
      setData(result);

      const expanded: Record<string, boolean> = {};
      result.deals.forEach((deal) => {
        if (deal.missions_count > 0) {
          expanded[deal.id] = true;
        }
      });
      setExpandedDeals((prev) => {
        const merged = { ...expanded };
        Object.keys(prev).forEach((key) => {
          merged[key] = prev[key];
        });
        return merged;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching grouped missions:', error);
        toast.error(t('missions.grouped.fetchError'));
      }
    } finally {
      setLoading(false);
    }
  }, [authGet, t]);

  useEffect(() => {
    void fetchGroupedData();
  }, [fetchGroupedData]);

  const toggleDeal = (dealId: string) => {
    setExpandedDeals((prev) => ({ ...prev, [dealId]: !prev[dealId] }));
  };

  const filterMissions = useCallback((missions: GroupedMission[]): GroupedMission[] => {
    if (!debouncedSearch) return missions;
    const q = debouncedSearch.toLowerCase();
    return missions.filter((mission) =>
      mission.title?.toLowerCase().includes(q) ||
      mission.client_name?.toLowerCase().includes(q) ||
      mission.contact_name?.toLowerCase().includes(q) ||
      mission.keywords?.toLowerCase().includes(q)
    );
  }, [debouncedSearch]);

  const filteredDeals = data?.deals
    .map((deal) => {
      const missions = filterMissions(deal.missions);
      return {
        ...deal,
        missions,
        missions_count: missions.length,
      };
    })
    .filter((deal) => (debouncedSearch ? deal.missions_count > 0 : true)) || [];

  const filteredUnassigned = filterMissions(data?.unassigned || []);
  const totalMissions = filteredDeals.reduce((sum, deal) => sum + deal.missions_count, 0) + filteredUnassigned.length;

  if (loading) {
    return <SkeletonMissionList count={6} />;
  }

  return (
    <div className="space-y-4">
      <MissionsGroupedToolbar
        onAddMission={onAddMission}
        onRefresh={() => { void fetchGroupedData(); }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <MissionsGroupedSummary
        dealCount={filteredDeals.length}
        totalMissions={totalMissions}
        unassignedCount={filteredUnassigned.length}
      />

      {filteredDeals.map((deal) => (
        <DealSection
          key={deal.id}
          deal={deal}
          isExpanded={expandedDeals[deal.id] || false}
          onToggle={() => toggleDeal(deal.id)}
        />
      ))}

      {filteredUnassigned.length > 0 && (
        <div className="cv-card overflow-hidden rounded-[2rem]">
          <button
            onClick={() => setUnassignedExpanded(!unassignedExpanded)}
            className="w-full flex items-center justify-between px-5 py-4 transition-colors text-left hover:bg-slate-50 dark:hover:bg-[color:color-mix(in_srgb,var(--cv-panel-end)_86%,black)]"
          >
            <div className="flex items-center gap-3">
              {unassignedExpanded ? (
                <ChevronDownIcon className="w-5 h-5 text-slate-400 dark:text-[#7f8ab0] flex-shrink-0" />
              ) : (
                <ChevronRightIcon className="w-5 h-5 text-slate-400 dark:text-[#7f8ab0] flex-shrink-0" />
              )}
              <FolderOpenIcon className="w-5 h-5 text-[var(--cv-tertiary)] flex-shrink-0" />
              <h3 className="cv-display font-bold text-slate-800 dark:text-[var(--cv-text)]">{t('missions.grouped.unassignedTitle')}</h3>
            </div>
            <span className="cv-pill rounded-full px-3 py-1 text-sm font-medium text-slate-700 dark:text-[var(--cv-text)]">
              {filteredUnassigned.length} mission{filteredUnassigned.length !== 1 ? 's' : ''}
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
                <div className="space-y-2 border-t border-slate-200/70 px-4 pb-4 pt-3 dark:border-white/6">
                  {filteredUnassigned.map((mission, missionIndex) => (
                    <MissionCardInDeal key={mission.id} mission={mission} index={missionIndex} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {totalMissions === 0 && !loading && (
        <div className="cv-panel rounded-[2rem] p-12 text-center">
          <BriefcaseIcon className="w-16 h-16 mx-auto text-slate-400 dark:text-[#7f8ab0] mb-4" />
          <h3 className="cv-display text-xl font-semibold text-slate-950 dark:text-[var(--cv-text)] mb-2">
            {debouncedSearch ? t('missions.noResults') : t('missions.noMissions')}
          </h3>
          <p className="text-slate-600 dark:text-[var(--cv-muted)]">
            {debouncedSearch ? t('missions.grouped.noSearchResults') : t('missions.createFirst')}
          </p>
        </div>
      )}
    </div>
  );
};

export default MissionsDealsGroupedView;
