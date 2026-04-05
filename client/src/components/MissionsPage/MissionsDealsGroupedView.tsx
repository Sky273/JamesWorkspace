/**
 * MissionsDealsGroupedView - Display missions grouped by deal
 * Collapsible accordion sections for each deal + unassigned missions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDownIcon, ChevronRightIcon, FolderOpenIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

import { useAuthFetch } from '../../hooks/useAuthFetch';
import logger from '../../utils/logger.frontend';
import { SkeletonMissionList } from '../ui/Skeleton';
import {
  DealSection,
  MissionCardInDeal,
  MissionsGroupedEmptyState,
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

  const filteredDeals = useMemo(() => (
    data?.deals
      .map((deal) => {
        const missions = filterMissions(deal.missions);
        return {
          ...deal,
          missions,
          missions_count: missions.length,
        };
      })
      .filter((deal) => (debouncedSearch ? deal.missions_count > 0 : true)) || []
  ), [data?.deals, debouncedSearch, filterMissions]);

  const filteredUnassigned = useMemo(
    () => filterMissions(data?.unassigned || []),
    [data?.unassigned, filterMissions],
  );

  const totalVisibleMissions = useMemo(
    () => filteredDeals.reduce((sum, deal) => sum + deal.missions_count, 0) + filteredUnassigned.length,
    [filteredDeals, filteredUnassigned.length],
  );

  const totalRawMissions = useMemo(
    () => (data?.totalAssigned || 0) + (data?.totalUnassigned || 0),
    [data?.totalAssigned, data?.totalUnassigned],
  );

  const hasSearch = debouncedSearch.trim() !== '';
  const showEmptyState = !loading && totalVisibleMissions === 0;

  if (loading) {
    return <SkeletonMissionList count={6} />;
  }

  return (
    <div className="space-y-5">
      <MissionsGroupedToolbar
        onAddMission={onAddMission}
        onRefresh={() => { void fetchGroupedData(); }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalMissions={totalRawMissions}
        dealCount={filteredDeals.length}
        visibleCount={totalVisibleMissions}
      />

      <MissionsGroupedSummary
        dealCount={filteredDeals.length}
        totalMissions={totalVisibleMissions}
        unassignedCount={filteredUnassigned.length}
      />

      {!showEmptyState ? (
        <>
          {filteredDeals.map((deal) => (
            <DealSection
              key={deal.id}
              deal={deal}
              isExpanded={expandedDeals[deal.id] || false}
              onToggle={() => toggleDeal(deal.id)}
            />
          ))}

          {filteredUnassigned.length > 0 ? (
            <section className="cv-card overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/80 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.35)] dark:border-white/8 dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--cv-panel-start)_90%,black),color-mix(in_srgb,var(--cv-panel-end)_94%,black))]">
              <button
                type="button"
                onClick={() => setUnassignedExpanded((prev) => !prev)}
                className="flex w-full flex-col items-start gap-4 px-5 py-5 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-[#7f8ab0]">
                    {unassignedExpanded ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
                  </div>
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[1.35rem] bg-[linear-gradient(135deg,var(--cv-tertiary-soft),rgba(255,255,255,0.82))] text-[var(--cv-tertiary)] shadow-sm dark:bg-[linear-gradient(135deg,color-mix(in_srgb,var(--cv-tertiary)_24%,transparent),rgba(255,255,255,0.04))]">
                    <FolderOpenIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="cv-display truncate text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)] sm:text-xl">
                        {t('missions.grouped.unassignedTitle')}
                      </h3>
                      <span className="rounded-full bg-[var(--cv-tertiary-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--cv-tertiary)]">
                        {t('missions.grouped.unassignedHint')}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-[var(--cv-muted)]">
                      {t('missions.grouped.unassignedDescription')}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-[var(--cv-tertiary-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--cv-tertiary)]">
                  {t('missions.grouped.resultsCount', { count: filteredUnassigned.length })}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {unassignedExpanded ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 border-t border-slate-200/70 px-4 pb-4 pt-4 dark:border-white/8 sm:px-5 sm:pb-5">
                      {filteredUnassigned.map((mission, missionIndex) => (
                        <MissionCardInDeal key={mission.id} mission={mission} index={missionIndex} />
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </section>
          ) : null}
        </>
      ) : (
        <MissionsGroupedEmptyState
          hasSearch={hasSearch}
          onAddMission={onAddMission}
          onClearSearch={() => setSearchQuery('')}
        />
      )}
    </div>
  );
};

export default MissionsDealsGroupedView;
