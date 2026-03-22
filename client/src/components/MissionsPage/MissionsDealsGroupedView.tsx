/**
 * MissionsDealsGroupedView - Display missions grouped by deal
 * Collapsible accordion sections for each deal + unassigned missions
 * Mirrors the pattern of ResumesPage/DealsGroupedView for missions
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
  PlusIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import { createSafeHtml } from '../../utils/sanitizer.frontend';
import logger from '../../utils/logger.frontend';
import toast from 'react-hot-toast';
import { SkeletonMissionList } from '../ui/Skeleton';

// ─── Types ────────────────────────────────────────────────

interface GroupedMission {
  id: string;
  title: string;
  content?: string;
  status: string;
  keywords?: string;
  required_skills?: string;
  preferred_skills?: string;
  created_at: string;
  updated_at?: string;
  firm?: string;
  client_id?: string;
  contact_id?: string;
  client_name?: string;
  client_type?: string;
  contact_name?: string;
  contact_email?: string;
  contact_role?: string;
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
  resumes_count: number;
}

interface GroupedData {
  deals: DealGroup[];
  unassigned: GroupedMission[];
  totalDeals: number;
  totalAssigned: number;
  totalUnassigned: number;
}

interface MissionsDealsGroupedViewProps {
  onAddMission: () => void;
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

const INITIAL_MISSIONS_LIMIT = 8;

// ─── Mission Card Component ──────────────────────────────

const MissionCardInDeal = ({ mission, index }: { mission: GroupedMission; index: number }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const statusColor = MISSION_STATUS_COLORS[mission.status] || MISSION_STATUS_COLORS.active;
  
  // Alternating row background (striping) - same as DealResumeCard
  const stripingClass = index % 2 === 1 
    ? 'bg-gray-100 dark:bg-gray-700/30' 
    : 'bg-white dark:bg-gray-800';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate(`/missions/${mission.id}`)}
      className={`border border-gray-100 dark:border-gray-700/60 rounded-xl overflow-hidden cursor-pointer hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all group ${stripingClass}`}
    >
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <BriefcaseIcon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {mission.title}
              </h4>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                {t(`missions.status.${mission.status || 'Active'}`, mission.status)}
              </span>
              {mission.client_name && (
                <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                  <BuildingOfficeIcon className="w-3 h-3" />
                  {mission.client_name}
                </span>
              )}
              {mission.contact_name && (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <UserIcon className="w-3 h-3" />
                  {mission.contact_name}
                </span>
              )}
              {mission.adaptations_count > 0 && (
                <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                  <DocumentTextIcon className="w-3 h-3" />
                  {mission.adaptations_count} {t('missions.adaptations', 'adaptation(s)')}
                </span>
              )}
            </div>
          </div>
        </div>
        {mission.content && (
          <div
            className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={createSafeHtml(mission.content)}
          />
        )}
      </div>
    </motion.div>
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
  const [showAll, setShowAll] = useState(false);

  const displayedMissions = showAll ? deal.missions : deal.missions.slice(0, INITIAL_MISSIONS_LIMIT);
  const hiddenCount = deal.missions.length - INITIAL_MISSIONS_LIMIT;

  return (
    <div className="rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden bg-white dark:bg-gray-800 transition-all duration-200">
      {/* Deal header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isExpanded ? (
            <ChevronDownIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          ) : (
            <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          )}
          <BriefcaseIcon className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">{deal.title}</h3>
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
          {deal.resumes_count > 0 && (
            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full text-sm font-medium">
              {deal.resumes_count} CV{deal.resumes_count !== 1 ? 's' : ''}
            </span>
          )}
          <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full text-sm font-medium">
            {deal.missions_count} mission{deal.missions_count !== 1 ? 's' : ''}
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
                  {t('missions.grouped.noMissions', 'Aucune mission associée à cette affaire')}
                </p>
              ) : (
                <div className="space-y-2 pt-3">
                  {displayedMissions.map((mission, missionIndex) => (
                    <MissionCardInDeal key={mission.id} mission={mission} index={missionIndex} />
                  ))}
                  {!showAll && hiddenCount > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
                      className="w-full py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors font-medium"
                    >
                      {t('missions.grouped.showMore', `Voir ${hiddenCount} mission(s) supplémentaire(s)`)}
                    </button>
                  )}
                  {showAll && deal.missions.length > INITIAL_MISSIONS_LIMIT && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowAll(false); }}
                      className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors"
                    >
                      {t('missions.grouped.showLess', 'Voir moins')}
                    </button>
                  )}
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

const MissionsDealsGroupedView = ({ onAddMission }: MissionsDealsGroupedViewProps): JSX.Element => {
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
      const response = await authGet('/api/missions/grouped-by-deal');
      if (!response.ok) throw new Error('Failed to fetch grouped missions');
      const result: GroupedData = await response.json();
      setData(result);

      // Auto-expand deals that have missions
      const expanded: Record<string, boolean> = {};
      result.deals.forEach(deal => {
        if (deal.missions_count > 0) {
          expanded[deal.id] = true;
        }
      });
      setExpandedDeals(prev => {
        // Preserve user's manual expand/collapse state
        const merged = { ...expanded };
        Object.keys(prev).forEach(key => {
          merged[key] = prev[key];
        });
        return merged;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching grouped missions:', error);
        toast.error(t('missions.grouped.fetchError', 'Erreur lors du chargement'));
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

  // Filter deals and missions by search
  const filterMissions = useCallback((missions: GroupedMission[]): GroupedMission[] => {
    if (!debouncedSearch) return missions;
    const q = debouncedSearch.toLowerCase();
    return missions.filter(m =>
      m.title?.toLowerCase().includes(q) ||
      m.client_name?.toLowerCase().includes(q) ||
      m.contact_name?.toLowerCase().includes(q) ||
      m.keywords?.toLowerCase().includes(q)
    );
  }, [debouncedSearch]);

  const filteredDeals = data?.deals.map(deal => ({
    ...deal,
    missions: filterMissions(deal.missions),
    missions_count: filterMissions(deal.missions).length,
  })).filter(deal => debouncedSearch ? deal.missions_count > 0 : true) || [];

  const filteredUnassigned = filterMissions(data?.unassigned || []);

  const totalMissions = filteredDeals.reduce((sum, d) => sum + d.missions_count, 0) + filteredUnassigned.length;

  if (loading) {
    return <SkeletonMissionList count={6} />;
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 gap-4">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('missions.searchPlaceholder', 'Rechercher une mission...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchGroupedData}
              className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={t('missions.refresh', 'Rafraîchir')}
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
            <button
              onClick={onAddMission}
              className="btn btn-primary flex items-center gap-2 px-4 py-2"
            >
              <PlusIcon className="h-5 w-5" />
              {t('missions.addMission')}
            </button>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 text-sm bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <ClipboardDocumentListIcon className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-gray-900 dark:text-gray-100">{totalMissions}</span>
          <span>mission{totalMissions !== 1 ? 's' : ''}</span>
        </div>
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <BriefcaseIcon className="w-4 h-4 text-purple-500" />
          <span className="font-semibold text-gray-900 dark:text-gray-100">{filteredDeals.length}</span>
          <span>{t('missions.grouped.deals', 'affaire(s)')}</span>
        </div>
        {filteredUnassigned.length > 0 && (
          <>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <FolderOpenIcon className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-gray-900 dark:text-gray-100">{filteredUnassigned.length}</span>
              <span>{t('missions.grouped.unassigned', 'sans affaire')}</span>
            </div>
          </>
        )}
      </div>

      {/* Deals with missions */}
      {filteredDeals.map(deal => (
        <DealSection
          key={deal.id}
          deal={deal}
          isExpanded={expandedDeals[deal.id] || false}
          onToggle={() => toggleDeal(deal.id)}
        />
      ))}

      {/* Unassigned missions */}
      {filteredUnassigned.length > 0 && (
        <div className="rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden bg-white dark:bg-gray-800">
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
              <FolderOpenIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <h3 className="font-bold text-gray-700 dark:text-gray-300">
                {t('missions.grouped.unassignedTitle', 'Missions sans affaire')}
              </h3>
            </div>
            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full text-sm font-medium">
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
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 space-y-2 pt-3">
                  {filteredUnassigned.map((mission, missionIndex) => (
                    <MissionCardInDeal key={mission.id} mission={mission} index={missionIndex} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Empty state */}
      {totalMissions === 0 && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-12 text-center">
          <BriefcaseIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {debouncedSearch
              ? t('missions.noResults', 'Aucun résultat')
              : t('missions.noMissions', 'Aucune mission')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {debouncedSearch
              ? t('missions.grouped.noSearchResults', 'Aucune mission ne correspond à votre recherche.')
              : t('missions.createFirst', 'Créez votre première mission pour commencer.')}
          </p>
        </div>
      )}
    </div>
  );
};

export default MissionsDealsGroupedView;
