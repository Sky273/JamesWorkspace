/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
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
  ArrowPathIcon,
  PlusIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import SearchField from '../page/SearchField';
import { createSafeHtml } from '../../utils/sanitizer.frontend';
import type { DealGroup, GroupedMission } from './MissionsDealsGroupedView.types';

export const STATUS_COLORS: Record<string, string> = {
  open: 'bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]',
  won: 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)]',
  lost: 'bg-[var(--cv-danger-soft)] text-[var(--cv-danger)]',
  on_hold: 'bg-[var(--cv-warning-soft)] text-[var(--cv-warning)]',
};

export const STATUS_LABELS: Record<string, string> = {
  open: 'En cours',
  won: 'Gagnee',
  lost: 'Perdue',
  on_hold: 'En attente',
};

export const PRIORITY_ICONS: Record<string, { icon: string; color: string }> = {
  low: { icon: 'o', color: 'text-gray-400' },
  medium: { icon: 'oo', color: 'text-blue-500' },
  high: { icon: 'ooo', color: 'text-orange-500' },
  urgent: { icon: '!!!!', color: 'text-red-500' },
};

export const MISSION_STATUS_COLORS: Record<string, string> = {
  Active: 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)]',
  active: 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)]',
  Draft: 'bg-[var(--cv-warning-soft)] text-[var(--cv-warning)]',
  draft: 'bg-[var(--cv-warning-soft)] text-[var(--cv-warning)]',
  Closed: 'bg-[var(--cv-danger-soft)] text-[var(--cv-danger)]',
  closed: 'bg-[var(--cv-danger-soft)] text-[var(--cv-danger)]',
};

export const INITIAL_MISSIONS_LIMIT = 8;

export function MissionCardInDeal({ mission, index }: { mission: GroupedMission; index: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const statusColor = MISSION_STATUS_COLORS[mission.status] || MISSION_STATUS_COLORS.active;
  const stripingClass = index % 2 === 1 ? 'bg-white/70 dark:bg-[color:color-mix(in_srgb,var(--cv-panel-end)_86%,black)]' : 'bg-white/90 dark:bg-[color:color-mix(in_srgb,var(--cv-panel-start)_90%,black)]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate(`/missions/${mission.id}`)}
      className={`rounded-[1.6rem] border border-slate-200/70 overflow-hidden cursor-pointer transition-all group dark:border-white/6 ${stripingClass}`}
    >
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]">
                <BriefcaseIcon className="h-4 w-4" />
              </div>
              <h4 className="cv-display truncate font-medium text-slate-900 transition-colors group-hover:text-[var(--cv-primary)] dark:text-[var(--cv-text)]">
                {mission.title}
              </h4>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusColor}`}>
                {t(`missions.status.${mission.status || 'Active'}`, mission.status)}
              </span>
              {mission.client_name && (
                <span className="flex items-center gap-1 text-xs text-[var(--cv-primary)]">
                  <BuildingOfficeIcon className="w-3 h-3" />
                  {mission.client_name}
                </span>
              )}
              {mission.contact_name && (
                <span className="flex items-center gap-1 text-xs text-[var(--cv-tertiary)]">
                  <UserIcon className="w-3 h-3" />
                  {mission.contact_name}
                </span>
              )}
              {mission.adaptations_count > 0 && (
                <span className="flex items-center gap-1 text-xs text-[var(--cv-cyan)]">
                  <DocumentTextIcon className="w-3 h-3" />
                  {mission.adaptations_count} {t('missions.adaptations')}
                </span>
              )}
            </div>
          </div>
        </div>
        {mission.content && (
          <div
            className="mt-2 line-clamp-2 max-w-none prose prose-sm text-xs text-slate-500 dark:prose-invert dark:text-[var(--cv-muted)]"
            dangerouslySetInnerHTML={createSafeHtml(mission.content)}
          />
        )}
      </div>
    </motion.div>
  );
}

export function DealSection({
  deal,
  isExpanded,
  onToggle,
}: {
  deal: DealGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const priorityInfo = PRIORITY_ICONS[deal.priority] || PRIORITY_ICONS.medium;
  const [showAll, setShowAll] = useState(false);
  const displayedMissions = showAll ? deal.missions : deal.missions.slice(0, INITIAL_MISSIONS_LIMIT);
  const hiddenCount = deal.missions.length - INITIAL_MISSIONS_LIMIT;

  return (
    <div className="cv-card overflow-hidden rounded-[2rem] transition-all duration-200">
      <button onClick={onToggle} className="w-full flex flex-col items-start justify-between gap-4 px-5 py-4 transition-colors text-left hover:bg-slate-50 dark:hover:bg-[color:color-mix(in_srgb,var(--cv-panel-end)_86%,black)] sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 min-w-0">
          {isExpanded ? <ChevronDownIcon className="w-5 h-5 text-slate-400 dark:text-[#7f8ab0] flex-shrink-0 mt-0.5" /> : <ChevronRightIcon className="w-5 h-5 text-slate-400 dark:text-[#7f8ab0] flex-shrink-0 mt-0.5" />}
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]">
            <BriefcaseIcon className="w-5 h-5 mt-0.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="cv-display truncate font-bold text-slate-900 dark:text-[var(--cv-text)]">{deal.title}</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[deal.status] || STATUS_COLORS.open}`}>
                {t(`crm.deals.statuses.${deal.status}`, STATUS_LABELS[deal.status] || deal.status)}
              </span>
              <span className={`text-xs ${priorityInfo.color}`}>{priorityInfo.icon}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 dark:text-[var(--cv-muted)]">
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
        <div className="flex flex-wrap items-center gap-2 sm:ml-4 sm:flex-shrink-0 sm:justify-end">
          {deal.resumes_count > 0 && <span className="rounded-full bg-[var(--cv-secondary-soft)] px-2.5 py-1 text-sm font-medium text-[var(--cv-secondary)]">{deal.resumes_count} CV{deal.resumes_count !== 1 ? 's' : ''}</span>}
          <span className="rounded-full bg-[var(--cv-primary-soft)] px-2.5 py-1 text-sm font-medium text-[var(--cv-primary)]">{deal.missions_count} mission{deal.missions_count !== 1 ? 's' : ''}</span>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-slate-200/70 dark:border-white/6">
              {deal.missions.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500 dark:text-[var(--cv-muted)]">{t('missions.grouped.noMissions')}</p>
              ) : (
                <div className="space-y-2 pt-3">
                  {displayedMissions.map((mission, missionIndex) => (
                    <MissionCardInDeal key={mission.id} mission={mission} index={missionIndex} />
                  ))}
                  {!showAll && hiddenCount > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); setShowAll(true); }} className="w-full rounded-xl py-2 text-sm font-medium text-[var(--cv-primary)] transition-colors hover:bg-[var(--cv-primary-soft)]">
                      {t('missions.grouped.showMore', { count: hiddenCount })}
                    </button>
                  )}
                  {showAll && deal.missions.length > INITIAL_MISSIONS_LIMIT && (
                    <button onClick={(e) => { e.stopPropagation(); setShowAll(false); }} className="w-full rounded-xl py-2 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:text-[var(--cv-muted)] dark:hover:bg-[color:color-mix(in_srgb,var(--cv-panel-end)_86%,black)] dark:hover:text-[var(--cv-text)]">
                      {t('missions.grouped.showLess')}
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
}

export function MissionsGroupedToolbar({
  onAddMission,
  onRefresh,
  searchQuery,
  setSearchQuery,
}: {
  onAddMission: () => void;
  onRefresh: () => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="cv-search-shell rounded-[2rem] p-4 sm:p-5">
      <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="cv-kicker mb-2">{t('missions.title')}</div>
          <div className="text-sm text-slate-600 dark:text-[var(--cv-muted)]">{searchQuery ? t('missions.searchPlaceholder') : t('missions.subtitle')}</div>
        </div>
        {searchQuery ? (
          <button onClick={() => setSearchQuery('')} className="cv-ghost-button inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors">
            <XMarkIcon className="w-4 h-4" />
            <span>{t('common.resetFilters')}</span>
          </button>
        ) : null}
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-col gap-3 lg:flex-row">
            <SearchField containerClassName="relative min-w-0 flex-1" placeholder={t('missions.searchPlaceholder')} value={searchQuery} onChange={setSearchQuery} />
            <button onClick={onAddMission} className="cv-gradient-button inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-[1.4rem] px-6 text-sm font-bold transition-all lg:w-auto">
              <PlusIcon className="h-5 w-5" />
              {t('missions.addMission')}
            </button>
          </div>
        </div>
        <div className="flex w-full items-center gap-3 md:w-auto">
          <button onClick={onRefresh} className="cv-ghost-button inline-flex min-h-12 min-w-12 items-center justify-center rounded-[1.1rem] p-3 transition-colors" title={t('missions.refresh')}>
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function MissionsGroupedSummary({
  dealCount,
  totalMissions,
  unassignedCount,
}: {
  dealCount: number;
  totalMissions: number;
  unassignedCount: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="cv-panel flex flex-wrap items-center gap-3 rounded-[1.6rem] px-4 py-3 text-sm">
      <div className="flex items-center gap-1.5 text-slate-600 dark:text-[var(--cv-muted)]">
        <ClipboardDocumentListIcon className="w-4 h-4 text-[var(--cv-primary)]" />
        <span className="font-semibold text-slate-950 dark:text-[var(--cv-text)]">{totalMissions}</span>
        <span>mission{totalMissions !== 1 ? 's' : ''}</span>
      </div>
      <div className="h-4 w-px bg-slate-200 dark:bg-white/8" />
      <div className="flex items-center gap-1.5 text-slate-600 dark:text-[var(--cv-muted)]">
        <BriefcaseIcon className="w-4 h-4 text-[var(--cv-secondary)]" />
        <span className="font-semibold text-slate-950 dark:text-[var(--cv-text)]">{dealCount}</span>
        <span>{t('missions.grouped.deals')}</span>
      </div>
      {unassignedCount > 0 && (
        <>
          <div className="h-4 w-px bg-slate-200 dark:bg-white/8" />
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-[var(--cv-muted)]">
            <FolderOpenIcon className="w-4 h-4 text-[var(--cv-tertiary)]" />
            <span className="font-semibold text-slate-950 dark:text-[var(--cv-text)]">{unassignedCount}</span>
            <span>{t('missions.grouped.unassigned')}</span>
          </div>
        </>
      )}
    </div>
  );
}
