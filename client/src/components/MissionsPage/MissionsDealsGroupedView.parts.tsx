/* eslint-disable react-refresh/only-export-components */
import { ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowPathIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  EyeIcon,
  FolderOpenIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import SearchField from '../page/SearchField';
import { createSafeHtml } from '../../utils/sanitizer.frontend';
import type { DealGroup, GroupedMission } from './MissionsDealsGroupedView.types';

export const STATUS_COLORS: Record<string, string> = {
  open: 'bg-[var(--cv-primary-soft)] text-[var(--cv-primary)] ring-1 ring-[var(--cv-primary)]/10',
  won: 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)] ring-1 ring-[var(--cv-tertiary)]/10',
  lost: 'bg-[var(--cv-danger-soft)] text-[var(--cv-danger)] ring-1 ring-[var(--cv-danger)]/10',
  on_hold: 'bg-[var(--cv-warning-soft)] text-[var(--cv-warning)] ring-1 ring-[var(--cv-warning)]/10',
};

export const STATUS_LABELS: Record<string, string> = {
  open: 'En cours',
  won: 'Gagnée',
  lost: 'Perdue',
  on_hold: 'En attente',
};

export const PRIORITY_META: Record<string, { translationKey: string; fallback: string; badge: string }> = {
  low: {
    translationKey: 'missions.grouped.priorityLow',
    fallback: 'Faible',
    badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-white/5 dark:text-[var(--cv-muted)] dark:ring-white/10',
  },
  medium: {
    translationKey: 'missions.grouped.priorityMedium',
    fallback: 'Normale',
    badge: 'bg-[var(--cv-primary-soft)] text-[var(--cv-primary)] ring-1 ring-[var(--cv-primary)]/10',
  },
  high: {
    translationKey: 'missions.grouped.priorityHigh',
    fallback: 'Haute',
    badge: 'bg-[var(--cv-warning-soft)] text-[var(--cv-warning)] ring-1 ring-[var(--cv-warning)]/10',
  },
  urgent: {
    translationKey: 'missions.grouped.priorityUrgent',
    fallback: 'Urgente',
    badge: 'bg-[var(--cv-danger-soft)] text-[var(--cv-danger)] ring-1 ring-[var(--cv-danger)]/10',
  },
};

export const MISSION_STATUS_COLORS: Record<string, string> = {
  Active: 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)] ring-1 ring-[var(--cv-tertiary)]/10',
  active: 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)] ring-1 ring-[var(--cv-tertiary)]/10',
  Draft: 'bg-[var(--cv-warning-soft)] text-[var(--cv-warning)] ring-1 ring-[var(--cv-warning)]/10',
  draft: 'bg-[var(--cv-warning-soft)] text-[var(--cv-warning)] ring-1 ring-[var(--cv-warning)]/10',
  Closed: 'bg-[var(--cv-danger-soft)] text-[var(--cv-danger)] ring-1 ring-[var(--cv-danger)]/10',
  closed: 'bg-[var(--cv-danger-soft)] text-[var(--cv-danger)] ring-1 ring-[var(--cv-danger)]/10',
};

export const INITIAL_MISSIONS_LIMIT = 6;

export function normalizeMissionKeywords(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed !== value) {
        return normalizeMissionKeywords(parsed);
      }
    } catch {
      // Keep raw string fallback below when keywords are stored as CSV/plain text.
    }

    return trimmed
      .split(/[\r\n,;]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .flatMap((entry) => normalizeMissionKeywords(entry));
  }

  return [];
}

export function normalizeMissionKeywordsText(value: unknown): string {
  return normalizeMissionKeywords(value).join(' ').toLowerCase();
}

function formatMissionDate(date?: string) {
  if (!date) return null;

  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  } catch {
    return null;
  }
}

export function MissionCardInDeal({
  mission,
  index,
  canDelete = true,
  onDelete = () => undefined,
  onEdit = () => undefined,
}: {
  mission: GroupedMission;
  index: number;
  canDelete?: boolean;
  onDelete?: (mission: GroupedMission) => void;
  onEdit?: (mission: GroupedMission) => void;
  secondaryActions?: ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const statusColor = MISSION_STATUS_COLORS[mission.status] || MISSION_STATUS_COLORS.active;
  const updatedAt = formatMissionDate(mission.updated_at || mission.created_at);
  const keywords = useMemo(
    () => normalizeMissionKeywords(mission.keywords).slice(0, 3),
    [mission.keywords],
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.02 }}
      onClick={() => navigate(`/missions/${mission.id}`)}
      className="group relative cursor-pointer overflow-hidden rounded-[13px] border border-[var(--cv-outline)] bg-white px-[18px] py-4 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_14px_rgba(0,0,0,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--cv-primary)]/25 hover:shadow-[0_8px_28px_rgba(0,0,0,0.13)]"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]">
              <BriefcaseIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="mission-card-title cv-display min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--cv-text)] transition-colors group-hover:text-[var(--cv-primary)]">
                  {mission.title || t('missions.noTitle')}
                </h4>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusColor}`}>
                  {t(`missions.status.${mission.status || 'Active'}`, mission.status)}
                </span>
                {updatedAt ? (
                  <span className="rounded-full bg-[var(--cv-pill-bg)] px-2.5 py-1 text-[10px] font-medium text-[var(--cv-muted)]">
                    {t('missions.grouped.updatedAt', { date: updatedAt })}
                  </span>
                ) : null}
              </div>
              {mission.content ? (
                <div
                  className="mt-1 line-clamp-1 text-[12.5px] text-[var(--cv-muted)]"
                  dangerouslySetInnerHTML={createSafeHtml(mission.content)}
                />
              ) : (
                <p className="mt-1 truncate text-[12.5px] text-[var(--cv-muted)]">{t('missions.noDescription')}</p>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--cv-subtle)]">
            {mission.client_name ? (
              <span className="inline-flex items-center gap-1.5">
                <BuildingOffice2Icon className="h-3.5 w-3.5 text-[var(--cv-primary)]" />
                <span className="font-medium">{mission.client_name}</span>
              </span>
            ) : null}
            {mission.contact_name ? (
              <span className="inline-flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5 text-[var(--cv-tertiary)]" />
                <span>{mission.contact_name}</span>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <DocumentTextIcon className="h-3.5 w-3.5 text-[var(--cv-cyan)]" />
              <span>{mission.adaptations_count} {t('missions.adaptations')}</span>
            </span>
          </div>

          {keywords.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <span
                  key={`${mission.id}-${keyword}`}
                  className="rounded-full bg-[var(--cv-primary-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--cv-primary)]"
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => navigate(`/missions/${mission.id}`)}
            className="cv-ghost-button inline-flex h-[30px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors"
          >
            <EyeIcon className="h-4 w-4" />
            {t('missions.view')}
          </button>
          <button
            type="button"
            onClick={() => onEdit(mission)}
            title={t('common.edit')}
            className="cv-ghost-button inline-flex h-[30px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium text-[var(--cv-primary)] transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common.edit')}</span>
          </button>
          <button
            type="button"
            disabled={!canDelete}
            onClick={() => {
              if (canDelete) {
                onDelete(mission);
              }
            }}
            title={canDelete ? t('common.delete') : t('missions.messages.deleteBlockedWithAttachments', 'Suppression impossible : des elements sont attaches a cette mission')}
            className={`cv-ghost-button inline-flex h-[30px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors ${
              canDelete
                ? 'text-[var(--cv-danger)]'
                : 'cursor-not-allowed text-slate-400 opacity-60'
            }`}
          >
            <TrashIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common.delete')}</span>
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export function canDeleteGroupedMission(mission: GroupedMission): boolean {
  return !mission.has_attached_elements
    && Number(mission.adaptations_count || 0) === 0
    && Number(mission.submissions_count || 0) === 0
    && Number(mission.pipeline_count || 0) === 0;
}

export function DealSection({
  deal,
  isExpanded,
  onToggle,
  onEditMission,
  onDeleteMission,
}: {
  deal: DealGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onEditMission: (mission: GroupedMission) => void;
  onDeleteMission: (mission: GroupedMission) => void;
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const displayedMissions = showAll ? deal.missions : deal.missions.slice(0, INITIAL_MISSIONS_LIMIT);
  const hiddenCount = Math.max(0, deal.missions.length - INITIAL_MISSIONS_LIMIT);
  const priorityMeta = PRIORITY_META[deal.priority] || PRIORITY_META.medium;
  const priorityLabel = t(priorityMeta.translationKey, priorityMeta.fallback);
  const statusClassName = STATUS_COLORS[deal.status] || STATUS_COLORS.open;
  const clientTypeLabel = deal.client_type
    ? deal.client_type === 'prospect'
      ? t('clients.prospect', 'Prospect')
      : t('clients.client', 'Client')
    : null;

  return (
    <section className="cv-card overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/80 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.35)] dark:border-white/8 dark:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--cv-panel-start)_90%,black),color-mix(in_srgb,var(--cv-panel-end)_94%,black))]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col items-start gap-4 px-5 py-5 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-[#7f8ab0]">
            {isExpanded ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
          </div>

          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[1.35rem] bg-[linear-gradient(135deg,var(--cv-primary-soft),rgba(255,255,255,0.82))] text-[var(--cv-primary)] shadow-sm dark:bg-[linear-gradient(135deg,color-mix(in_srgb,var(--cv-primary)_24%,transparent),rgba(255,255,255,0.04))]">
            <BriefcaseIcon className="h-6 w-6" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="cv-display truncate text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)] sm:text-xl">
                {deal.title}
              </h3>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusClassName}`}>
                {t(`crm.deals.statuses.${deal.status}`, STATUS_LABELS[deal.status] || deal.status)}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${priorityMeta.badge}`}>
                {t('missions.grouped.priority', { label: priorityLabel })}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2.5 text-xs text-slate-600 dark:text-[var(--cv-muted)]">
              {deal.client_name ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3 py-1.5 dark:bg-white/5">
                  <BuildingOffice2Icon className="h-3.5 w-3.5 text-[var(--cv-primary)]" />
                  <span className="font-medium">{deal.client_name}</span>
                  {clientTypeLabel ? (
                    <span className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500 ring-1 ring-slate-200/70 dark:bg-white/8 dark:text-[var(--cv-muted)] dark:ring-white/10">
                      {clientTypeLabel}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {deal.contact_name ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3 py-1.5 dark:bg-white/5">
                  <UserIcon className="h-3.5 w-3.5 text-[var(--cv-tertiary)]" />
                  <span>{deal.contact_name}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {deal.resumes_count > 0 ? (
            <span className="rounded-full bg-[var(--cv-secondary-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--cv-secondary)]">
              {deal.resumes_count} CV{deal.resumes_count !== 1 ? 's' : ''}
            </span>
          ) : null}
          <span className="rounded-full bg-[var(--cv-primary-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--cv-primary)]">
            {deal.missions_count} mission{deal.missions_count !== 1 ? 's' : ''}
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200/70 px-4 pb-4 pt-4 dark:border-white/8 sm:px-5 sm:pb-5">
              {deal.missions.length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center dark:border-white/10 dark:bg-white/[0.03]">
                  <BriefcaseIcon className="mx-auto mb-3 h-10 w-10 text-slate-400 dark:text-[#7f8ab0]" />
                  <p className="text-sm font-medium text-slate-700 dark:text-[var(--cv-text)]">{t('missions.grouped.noMissions')}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-[var(--cv-muted)]">{t('missions.grouped.dealEmptyDescription')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedMissions.map((mission, missionIndex) => (
                    <MissionCardInDeal
                      key={mission.id}
                      mission={mission}
                      index={missionIndex}
                      canDelete={canDeleteGroupedMission(mission)}
                      onEdit={onEditMission}
                      onDelete={onDeleteMission}
                    />
                  ))}

                  {hiddenCount > 0 ? (
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setShowAll((prev) => !prev);
                        }}
                        className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:border-[var(--cv-primary)]/25 hover:text-[var(--cv-primary)] dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--cv-text)]"
                      >
                        {showAll ? t('missions.grouped.showLess') : t('missions.grouped.showMore', { count: hiddenCount })}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

export function MissionCardInDealWithActions({
  mission,
  index,
  onDeleteMission,
}: {
  mission: GroupedMission;
  index: number;
  onDeleteMission: (mission: GroupedMission) => void;
}) {
  const { t } = useTranslation();
  const canDelete = canDeleteGroupedMission(mission);

  return (
    <MissionCardInDeal
      mission={mission}
      index={index}
      secondaryActions={
        <button
          type="button"
          disabled={!canDelete}
          onClick={(event) => {
            event.stopPropagation();
            if (canDelete) {
              onDeleteMission(mission);
            }
          }}
          title={canDelete ? t('common.delete') : t('missions.messages.deleteBlockedWithAttachments', 'Suppression impossible : des éléments sont attachés à cette mission')}
          className={`pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition-colors ${
            canDelete
              ? 'border-slate-200/80 bg-white/95 text-[var(--cv-danger)] hover:border-[var(--cv-danger)]/25 hover:bg-white dark:border-white/10 dark:bg-[rgba(15,23,42,0.92)]'
              : 'cursor-not-allowed border-slate-200/80 bg-white/90 text-slate-400 opacity-70 dark:border-white/10 dark:bg-[rgba(15,23,42,0.92)]'
          }`}
        >
          <TrashIcon className="h-4.5 w-4.5" />
        </button>
      }
    />
  );
}

export function MissionsGroupedToolbar({
  onAddMission,
  onRefresh,
  searchQuery,
  setSearchQuery,
  totalMissions,
  dealCount,
  visibleCount,
}: {
  onAddMission: () => void;
  onRefresh: () => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  totalMissions: number;
  dealCount: number;
  visibleCount: number;
}) {
  const { t } = useTranslation();
  const hasSearch = searchQuery.trim() !== '';

  return (
    <div className="cv-search-shell missions-toolbar overflow-hidden rounded-[13px] p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <SearchField
            containerClassName="relative min-w-0"
            placeholder={t('missions.searchPlaceholder')}
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
        <div className="inline-flex h-[38px] items-center rounded-[9px] border border-[var(--cv-outline)] bg-white px-3 text-xs font-semibold text-[var(--cv-muted)]">
          {hasSearch
            ? `${t('missions.grouped.resultsCount', { count: visibleCount })} / ${dealCount} ${t('missions.grouped.deals')}`
            : `${t('missions.grouped.total', { count: totalMissions })} / ${dealCount} ${t('missions.grouped.deals')}`}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {hasSearch ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="cv-ghost-button inline-flex h-[38px] items-center justify-center gap-2 rounded-[9px] px-3 text-xs font-medium transition-colors"
            >
              <XMarkIcon className="h-4 w-4" />
              <span>{t('common.resetFilters')}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            className="cv-ghost-button inline-flex h-[38px] items-center justify-center gap-2 rounded-[9px] px-3 text-xs font-medium transition-colors"
            title={t('missions.refresh')}
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span>{t('missions.refresh')}</span>
          </button>
          <button
            type="button"
            onClick={onAddMission}
            className="cv-page-primary-action inline-flex h-[38px] items-center justify-center gap-2 rounded-[9px] px-4 text-xs font-bold transition-all"
          >
            <PlusIcon className="h-4 w-4" />
            {t('missions.addMission')}
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

  const items = [
    {
      key: 'missions',
      label: 'missions.grouped.visibleMissions',
      value: totalMissions,
      helper: 'missions.grouped.visibleMissionsHelper',
      icon: ClipboardDocumentListIcon,
      iconClassName: 'bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]',
    },
    {
      key: 'deals',
      label: 'missions.grouped.activeDeals',
      value: dealCount,
      helper: 'missions.grouped.activeDealsHelper',
      icon: BriefcaseIcon,
      iconClassName: 'bg-[var(--cv-secondary-soft)] text-[var(--cv-secondary)]',
    },
    {
      key: 'unassigned',
      label: 'missions.grouped.unassignedTitle',
      value: unassignedCount,
      helper: unassignedCount > 0 ? 'missions.grouped.unassignedHelper' : 'missions.grouped.unassignedHelperEmpty',
      icon: FolderOpenIcon,
      iconClassName: 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)]',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.key}
            className="cv-panel rounded-[1.75rem] border border-slate-200/70 p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)] dark:border-white/8"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-[var(--cv-muted)]">{t(item.label)}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-[var(--cv-text)]">{item.value}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.iconClassName}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-[var(--cv-muted)]">{t(item.helper)}</p>
          </div>
        );
      })}
    </div>
  );
}

export function MissionsGroupedEmptyState({
  hasSearch,
  onAddMission,
  onClearSearch,
}: {
  hasSearch: boolean;
  onAddMission: () => void;
  onClearSearch: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="cv-panel rounded-[2rem] border border-dashed border-slate-200/80 px-6 py-14 text-center dark:border-white/10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.6rem] bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]">
        <BriefcaseIcon className="h-8 w-8" />
      </div>
      <h3 className="cv-display mt-5 text-2xl font-semibold text-slate-950 dark:text-[var(--cv-text)]">
        {hasSearch ? t('missions.noResults') : t('missions.noMissions')}
      </h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-[var(--cv-muted)] sm:text-[15px]">
        {hasSearch
          ? t('missions.grouped.noSearchResults')
          : t('missions.grouped.emptyDescription')}
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {hasSearch ? (
          <button
            type="button"
            onClick={onClearSearch}
            className="cv-ghost-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium"
          >
            <XMarkIcon className="h-4 w-4" />
            {t('common.resetFilters')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onAddMission}
          className="cv-page-primary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold"
        >
          <PlusIcon className="h-5 w-5" />
          {t('missions.addMission')}
        </button>
      </div>
    </div>
  );
}
