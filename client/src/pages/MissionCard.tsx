/**
 * MissionCard - Individual mission card in the grid
 * Extracted from MissionsPage.tsx
 */

import {
  BriefcaseIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { formatDate } from '../utils/dateFormatter';
import { createSafeHtml } from '../utils/sanitizer.frontend';

export interface MissionItem {
  id: string;
  Title?: string;
  Content?: string;
  Firm?: string;
  'Firm ID'?: string;
  'Created At'?: string;
  Status?: 'Active' | 'Closed' | 'Draft';
  'Client Name'?: string;
  'Client Type'?: string;
  'Contact Name'?: string;
  'Contact Role'?: string;
  'Deal Title'?: string;
  [key: string]: unknown;
}

interface MissionCardProps {
  canDelete?: boolean;
  mission: MissionItem;
  index: number;
  onEdit: (mission: MissionItem) => void;
  onDelete: () => void;
}

const statusClasses: Record<NonNullable<MissionItem['Status']>, string> = {
  Active: 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)] ring-1 ring-[color:color-mix(in_srgb,var(--cv-tertiary)_18%,transparent)]',
  Draft: 'bg-[var(--cv-warning-soft)] text-[var(--cv-warning)] ring-1 ring-[color:color-mix(in_srgb,var(--cv-warning)_18%,transparent)]',
  Closed: 'bg-[var(--cv-danger-soft)] text-[var(--cv-danger)] ring-1 ring-[color:color-mix(in_srgb,var(--cv-danger)_18%,transparent)]',
};

export default function MissionCard({ mission, index, onEdit, onDelete, canDelete = true }: MissionCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const status = mission.Status || 'Active';

  return (
    <article
      className="cv-card group flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/85 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl dark:border-white/8 dark:bg-[rgba(15,23,42,0.72)]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="border-b border-slate-200/70 p-5 dark:border-white/6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--cv-primary-soft)] text-[var(--cv-primary)] shadow-sm">
              <BriefcaseIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusClasses[status]}`}>
                  {t(`missions.status.${status}`)}
                </span>
                {mission.Firm ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/6 dark:text-[var(--cv-muted)]">
                    <BuildingOfficeIcon className="h-3.5 w-3.5" />
                    {mission.Firm}
                  </span>
                ) : null}
              </div>
              <h3 className="cv-display line-clamp-2 text-xl font-semibold leading-tight text-slate-950 dark:text-[var(--cv-text)]">
                {mission.Title || t('missions.untitled', 'Mission sans titre')}
              </h3>
              {mission['Client Name'] ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-[var(--cv-muted)]">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cv-primary-soft)] px-3 py-1 font-medium text-[var(--cv-primary)]">
                    <BuildingOfficeIcon className="h-4 w-4" />
                    <span className="max-w-[18rem] truncate">{mission['Client Name']}</span>
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      mission['Client Type'] === 'prospect'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}
                  >
                    {mission['Client Type'] === 'prospect'
                      ? t('clients.prospect', 'Prospect')
                      : t('clients.client', 'Client')}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-500 dark:text-[var(--cv-muted)]">
          {mission['Contact Name'] ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-white/6">
              <UserIcon className="h-4 w-4 text-[var(--cv-tertiary)]" />
              <span className="max-w-[15rem] truncate">{mission['Contact Name']}</span>
              {mission['Contact Role'] ? (
                <span className="truncate text-slate-400 dark:text-[#7f8ab0]">· {mission['Contact Role']}</span>
              ) : null}
            </span>
          ) : null}
          {mission['Deal Title'] ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-white/6">
              <BriefcaseIcon className="h-4 w-4 text-[var(--cv-secondary)]" />
              <span className="max-w-[15rem] truncate font-medium text-slate-700 dark:text-[var(--cv-secondary)]">
                {mission['Deal Title']}
              </span>
            </span>
          ) : null}
          {mission['Created At'] ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-white/6">
              <CalendarIcon className="h-4 w-4" />
              {formatDate(String(mission['Created At']), 'medium')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {mission.Content ? (
          <div
            className="prose prose-sm max-w-none flex-1 line-clamp-4 text-sm leading-6 text-slate-600 dark:prose-invert dark:text-[var(--cv-muted)]"
            dangerouslySetInnerHTML={createSafeHtml(mission.Content)}
          />
        ) : (
          <div className="flex flex-1 items-center rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm italic text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-[#7f8ab0]">
            {t('missions.noDescription')}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200/70 p-5 pt-4 dark:border-white/6 sm:flex-row sm:items-center">
        <button
          onClick={() => navigate(`/missions/${mission.id}`)}
          className="cv-ghost-button inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors"
        >
          <EyeIcon className="h-5 w-5" />
          {t('missions.view')}
        </button>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto">
          <button
            onClick={() => onEdit(mission)}
            title={t('common.edit')}
            className="cv-ghost-button inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-[var(--cv-primary)] transition-colors"
          >
            <PencilSquareIcon className="h-5 w-5" />
            <span className="sm:hidden">{t('common.edit')}</span>
          </button>
          <button
            disabled={!canDelete}
            onClick={onDelete}
            title={canDelete ? t('common.delete') : t('missions.messages.deleteBlockedWithAttachments', 'Suppression impossible : des éléments sont attachés à cette mission')}
            className={`cv-ghost-button inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
              canDelete
                ? 'text-[var(--cv-danger)]'
                : 'cursor-not-allowed text-slate-400 opacity-60'
            }`}
          >
            <TrashIcon className="h-5 w-5" />
            <span className="sm:hidden">{t('common.delete')}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
