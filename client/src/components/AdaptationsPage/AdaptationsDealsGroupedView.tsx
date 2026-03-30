/**
 * AdaptationsDealsGroupedView - Display adaptations grouped by deal > mission
 * Mirrors the pattern of MissionsDealsGroupedView for adaptations
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BriefcaseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  BuildingOfficeIcon,
  UserIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import logger from '../../utils/logger.frontend';
import toast from 'react-hot-toast';
import { SkeletonAdaptationList } from '../ui/Skeleton';
import { formatDateTime } from '../../utils/dateFormatter';

// ─── Types ────────────────────────────────────────────────

interface AdaptationItem {
  id: string;
  mission_id: string;
  resume_id: string;
  resume_name?: string;
  candidate_name?: string;
  adapted_title?: string;
  match_score?: number;
  status?: string;
  created_at?: string;
}

interface GroupedMission {
  id: string;
  title: string;
  status: string;
  client_name?: string;
  contact_name?: string;
  adaptations: AdaptationItem[];
  adaptations_count: number;
}

interface DealGroup {
  id: string;
  title: string;
  status: string;
  priority: string;
  client_name?: string;
  client_type?: string;
  contact_name?: string;
  missions: GroupedMission[];
  missions_count: number;
  adaptations_count: number;
}

interface GroupedData {
  deals: DealGroup[];
  unassigned: GroupedMission[];
  totalDeals: number;
  totalAssigned: number;
  totalUnassigned: number;
}

// ─── Constants ────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  won: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'En cours',
  won: 'Gagnée',
  lost: 'Perdue',
  on_hold: 'En attente',
};

const PRIORITY_ICONS: Record<string, { icon: string; color: string }> = {
  low: { icon: '○', color: 'text-gray-400' },
  medium: { icon: '●', color: 'text-blue-500' },
  high: { icon: '●●', color: 'text-orange-500' },
  urgent: { icon: '●●●', color: 'text-red-500' },
};

const MISSION_STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Closed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  closed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-700 dark:text-green-400';
  if (score >= 60) return 'text-yellow-700 dark:text-yellow-400';
  return 'text-red-700 dark:text-red-400';
};

const getScoreBgColor = (score: number): string => {
  if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
};

const INITIAL_ADAPTATIONS_LIMIT = 6;

// ─── Adaptation Card Component ──────────────────────────

const AdaptationCardInMission = ({ adaptation, index }: { adaptation: AdaptationItem; index: number }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const score = adaptation.match_score || 0;
  const displayName = adaptation.resume_name || adaptation.candidate_name || t('adaptations.card.noName');
  
  // Alternating row background (striping)
  const stripingClass = index % 2 === 1 
    ? 'bg-gray-100 dark:bg-gray-700/50' 
    : 'bg-white dark:bg-gray-800';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate(`/adaptations/${adaptation.id}`)}
      className={`flex items-center justify-between gap-3 px-3 py-2 border border-gray-100 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 dark:hover:border-indigo-700 transition-all group ${stripingClass}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <DocumentTextIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {displayName}
        </span>
        {adaptation.adapted_title && (
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate italic hidden sm:inline">
            — {adaptation.adapted_title}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {adaptation.created_at && (
          <span className="text-xs text-gray-400 dark:text-gray-500 hidden md:inline">
            {formatDateTime(adaptation.created_at)}
          </span>
        )}
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getScoreBgColor(score)} ${getScoreColor(score)}`}>
          {score}%
        </span>
      </div>
    </motion.div>
  );
};

// ─── Mission Section Component ──────────────────────────

const MissionSection = ({ mission, missionIndex }: { mission: GroupedMission; missionIndex: number }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const statusColor = MISSION_STATUS_COLORS[mission.status] || MISSION_STATUS_COLORS.active;

  const displayedAdaptations = showAll ? mission.adaptations : mission.adaptations.slice(0, INITIAL_ADAPTATIONS_LIMIT);
  const hiddenCount = mission.adaptations.length - INITIAL_ADAPTATIONS_LIMIT;
  
  // Alternating row background for missions
  const missionStripingClass = missionIndex % 2 === 1 
    ? 'bg-indigo-50/50 dark:bg-indigo-900/10' 
    : 'bg-white dark:bg-gray-800';

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${missionStripingClass}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          <BriefcaseIcon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <span
            className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); navigate(`/missions/${mission.id}`); }}
          >
            {mission.title}
          </span>
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
            {t(`missions.status.${mission.status || 'Active'}`, mission.status)}
          </span>
        </div>
        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0">
          {mission.adaptations_count} {t('adaptations.adaptation')}{mission.adaptations_count !== 1 ? 's' : ''}
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1.5 border-t border-gray-100 dark:border-gray-700 pt-2">
              {displayedAdaptations.map((adaptation, adaptationIndex) => (
                <AdaptationCardInMission key={adaptation.id} adaptation={adaptation} index={adaptationIndex} />
              ))}
              {!showAll && hiddenCount > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
                  className="w-full py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors font-medium"
                >
                  {t('adaptations.grouped.showMore', { count: hiddenCount })}
                </button>
              )}
              {showAll && mission.adaptations.length > INITIAL_ADAPTATIONS_LIMIT && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAll(false); }}
                  className="w-full py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors"
                >
                  {t('adaptations.grouped.showLess')}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Deal Section Component ──────────────────────────────

const DealSection = ({
  deal,
  isExpanded,
  onToggle,
}: {
  deal: DealGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const { t } = useTranslation();
  const priorityInfo = PRIORITY_ICONS[deal.priority] || PRIORITY_ICONS.medium;

  return (
    <div className="rounded-lg shadow overflow-hidden bg-white dark:bg-gray-800 transition-all duration-200">
      {/* Deal header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors text-left"
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
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{deal.title}</h3>
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
          <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full text-sm font-medium">
            {deal.missions_count} mission{deal.missions_count !== 1 ? 's' : ''}
          </span>
          <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full text-sm font-medium">
            {deal.adaptations_count} adapt.
          </span>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
              {deal.missions.length === 0 ? (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                  {t('adaptations.grouped.noAdaptations')}
                </p>
              ) : (
                <div className="space-y-2 pt-3">
                  {deal.missions.map((mission, missionIndex) => (
                    <MissionSection key={mission.id} mission={mission} missionIndex={missionIndex} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────

const AdaptationsDealsGroupedView = (): JSX.Element => {
  const { t } = useTranslation();
  const { authGet } = useAuthFetch();

  const [data, setData] = useState<GroupedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDeals, setExpandedDeals] = useState<Record<string, boolean>>({});
  const [unassignedExpanded, setUnassignedExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchGroupedData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authGet('/api/adaptations/grouped-by-deal');
      if (!response.ok) throw new Error('Failed to fetch grouped adaptations');
      const result: GroupedData = await response.json();
      setData(result);

      // Auto-expand deals that have adaptations
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
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching grouped adaptations:', error);
        toast.error(t('adaptations.grouped.fetchError'));
      }
    } finally {
      setLoading(false);
    }
  }, [authGet, t]);

  useEffect(() => {
    fetchGroupedData();
  }, [fetchGroupedData]);

  const toggleDeal = (dealId: string) => {
    setExpandedDeals(prev => ({ ...prev, [dealId]: !prev[dealId] }));
  };

  // Filter by search query across deal titles, mission titles, adaptation names
  const filterMissions = useCallback((missions: GroupedMission[]): GroupedMission[] => {
    if (!debouncedSearch) return missions;
    const q = debouncedSearch.toLowerCase();
    return missions
      .map(m => {
        // Filter adaptations within the mission
        const filteredAdaptations = m.adaptations.filter(a =>
          a.resume_name?.toLowerCase().includes(q) ||
          a.candidate_name?.toLowerCase().includes(q) ||
          a.adapted_title?.toLowerCase().includes(q)
        );
        // Keep mission if its title matches or if it has matching adaptations
        const missionMatches = m.title?.toLowerCase().includes(q) ||
          m.client_name?.toLowerCase().includes(q);
        if (missionMatches) return m; // Keep all adaptations if mission title matches
        if (filteredAdaptations.length > 0) {
          return { ...m, adaptations: filteredAdaptations, adaptations_count: filteredAdaptations.length };
        }
        return null;
      })
      .filter((m): m is GroupedMission => m !== null);
  }, [debouncedSearch]);

  const filteredDeals = data?.deals.map(deal => {
    const q = debouncedSearch?.toLowerCase();
    const dealTitleMatches = q && deal.title?.toLowerCase().includes(q);
    const filteredMissions = dealTitleMatches ? deal.missions : filterMissions(deal.missions);
    const totalAdaptations = filteredMissions.reduce((sum, m) => sum + m.adaptations_count, 0);
    return {
      ...deal,
      missions: dealTitleMatches ? deal.missions : filteredMissions,
      missions_count: (dealTitleMatches ? deal.missions : filteredMissions).length,
      adaptations_count: dealTitleMatches ? deal.adaptations_count : totalAdaptations,
    };
  }).filter(deal => debouncedSearch ? deal.adaptations_count > 0 || deal.missions_count > 0 : true) || [];

  const filteredUnassigned = filterMissions(data?.unassigned || []);

  const totalAdaptations = filteredDeals.reduce((sum, d) => sum + d.adaptations_count, 0)
    + filteredUnassigned.reduce((sum, m) => sum + m.adaptations_count, 0);

  if (loading) {
    return <SkeletonAdaptationList count={6} />;
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 gap-4">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('adaptations.grouped.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchGroupedData}
              className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={t('common.refresh')}
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 px-1">
        <span className="font-medium">
          {totalAdaptations} adaptation{totalAdaptations !== 1 ? 's' : ''}
        </span>
        <span>•</span>
        <span>{filteredDeals.length} {t('adaptations.grouped.deals')}</span>
        {filteredUnassigned.length > 0 && (
          <>
            <span>•</span>
            <span>{filteredUnassigned.reduce((s, m) => s + m.adaptations_count, 0)} {t('adaptations.grouped.unassigned')}</span>
          </>
        )}
      </div>

      {/* Deals with adaptations */}
      {filteredDeals.map(deal => (
        <DealSection
          key={deal.id}
          deal={deal}
          isExpanded={expandedDeals[deal.id] || false}
          onToggle={() => toggleDeal(deal.id)}
        />
      ))}

      {/* Unassigned missions with adaptations */}
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
              {filteredUnassigned.reduce((s, m) => s + m.adaptations_count, 0)} adapt.
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

      {/* Empty state */}
      {totalAdaptations === 0 && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <SparklesIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {debouncedSearch
              ? t('adaptations.noAdaptationsFiltered')
              : t('adaptations.noAdaptations')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {debouncedSearch
              ? t('adaptations.grouped.noSearchResults')
              : t('adaptations.noAdaptationsPrompt')}
          </p>
        </div>
      )}
    </div>
  );
};

export default AdaptationsDealsGroupedView;
