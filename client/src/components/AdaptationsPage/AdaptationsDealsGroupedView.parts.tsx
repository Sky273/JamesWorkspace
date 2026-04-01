import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowPathIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { formatDateTime } from '../../utils/dateFormatter';
import SearchField from '../page/SearchField';
import {
  getScoreBgColor,
  getScoreColor,
  INITIAL_ADAPTATIONS_LIMIT,
  MISSION_STATUS_COLORS,
  PRIORITY_ICONS,
  STATUS_COLORS,
  STATUS_LABELS,
} from './AdaptationsDealsGroupedView.constants';
import type { AdaptationItem, DealGroup, GroupedMission } from './AdaptationsDealsGroupedView.types';

export const AdaptationCardInMission = ({
  adaptation,
  index,
}: {
  adaptation: AdaptationItem;
  index: number;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const score = adaptation.match_score || 0;
  const displayName = adaptation.resume_name || adaptation.candidate_name || t('adaptations.card.noName');
  const stripingClass = index % 2 === 1 ? 'bg-gray-100 dark:bg-gray-700/50' : 'bg-white dark:bg-gray-800';

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
            - {adaptation.adapted_title}
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

export const MissionSection = ({
  mission,
  missionIndex,
}: {
  mission: GroupedMission;
  missionIndex: number;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const statusColor = MISSION_STATUS_COLORS[mission.status] || MISSION_STATUS_COLORS.active;
  const displayedAdaptations = showAll ? mission.adaptations : mission.adaptations.slice(0, INITIAL_ADAPTATIONS_LIMIT);
  const hiddenCount = mission.adaptations.length - INITIAL_ADAPTATIONS_LIMIT;
  const missionStripingClass = missionIndex % 2 === 1 ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'bg-white dark:bg-gray-800';

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${missionStripingClass}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />}
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

export const DealSection = ({
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
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isExpanded ? <ChevronDownIcon className="w-5 h-5 text-gray-400 flex-shrink-0" /> : <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />}
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

export const GroupedSearchHeader = ({
  searchQuery,
  setSearchQuery,
  onRefresh,
  onClear,
  t,
}: {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onRefresh: () => void;
  onClear: () => void;
  t: (key: string, options?: unknown) => string;
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 gap-4">
      <SearchField
        containerClassName="relative flex-1 max-w-md"
        placeholder={t('adaptations.grouped.searchPlaceholder')}
        value={searchQuery}
        onChange={setSearchQuery}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title={t('common.refresh')}
        >
          <ArrowPathIcon className="w-5 h-5" />
        </button>
        {searchQuery && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  </div>
);
