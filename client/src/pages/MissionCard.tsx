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

import { createSafeHtml } from '../utils/sanitizer.frontend';
import { formatDate } from '../utils/dateFormatter';

export interface MissionItem {
  id: string;
  Title?: string;
  Content?: string;
  Firm?: string;
  'Firm ID'?: string;
  Status?: 'Active' | 'Closed' | 'Draft';
  'Client Name'?: string;
  'Client Type'?: string;
  'Contact Name'?: string;
  'Contact Role'?: string;
  'Deal Title'?: string;
  [key: string]: unknown;
}

interface MissionCardProps {
  mission: MissionItem;
  index: number;
  onEdit: (mission: MissionItem) => void;
  onDelete: (id: string) => void;
}

export default function MissionCard({ mission, index, onEdit, onDelete }: MissionCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const statusClass =
    mission.Status === 'Closed'
      ? 'bg-[var(--cv-danger-soft)] text-[var(--cv-danger)]'
      : mission.Status === 'Draft'
        ? 'bg-[var(--cv-warning-soft)] text-[var(--cv-warning)]'
        : 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)]';

  return (
    <div
      className="cv-card overflow-hidden rounded-[2rem]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="border-b border-slate-200/70 p-5 dark:border-white/6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]">
                <BriefcaseIcon className="h-5 w-5" />
              </div>
              <h3 className="cv-display truncate text-xl font-semibold text-slate-950 dark:text-[var(--cv-text)]">{mission.Title}</h3>
              <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusClass}`}>
                {t(`missions.status.${mission.Status || 'Active'}`)}
              </span>
            </div>
            {mission['Client Name'] ? (
              <div className="mt-3 flex items-center gap-1">
                <BuildingOfficeIcon className="h-4 w-4 text-[var(--cv-primary)]" />
                <span className="truncate text-sm font-medium text-slate-700 dark:text-[var(--cv-primary)]">{mission['Client Name']}</span>
                <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                  mission['Client Type'] === 'prospect'
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {mission['Client Type'] === 'prospect' ? t('clients.prospect', 'Prospect') : t('clients.client', 'Client')}
                </span>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-[var(--cv-muted)]">
              {mission['Contact Name'] ? (
                <span className="flex items-center gap-1">
                  <UserIcon className="h-4 w-4 text-[var(--cv-tertiary)]" />
                  {mission['Contact Name']}
                  {mission['Contact Role'] ? <span className="text-slate-400 dark:text-[#7f8ab0]">- {mission['Contact Role']}</span> : null}
                </span>
              ) : null}
              {mission['Deal Title'] ? (
                <span className="flex items-center gap-1">
                  <BriefcaseIcon className="h-4 w-4 text-[var(--cv-secondary)]" />
                  <span className="truncate font-medium text-slate-700 dark:text-[var(--cv-secondary)]">{mission['Deal Title']}</span>
                </span>
              ) : null}
              {mission['Created At'] ? (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4" />
                  {formatDate(String(mission['Created At']), 'medium')}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex items-center gap-1">
              <BuildingOfficeIcon className="h-3 w-3 text-slate-400 dark:text-[#7f8ab0]" />
              <span className="text-xs text-slate-500 dark:text-[#8f99b8]">{mission.Firm || t('missions.noFirm', 'Aucun cabinet')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5">
        {mission.Content ? (
          <div
            className="prose prose-sm max-w-none line-clamp-3 text-sm text-slate-600 dark:prose-invert dark:text-[var(--cv-muted)]"
            dangerouslySetInnerHTML={createSafeHtml(mission.Content)}
          />
        ) : (
          <p className="text-sm italic text-slate-400 dark:text-[#7f8ab0]">{t('missions.noDescription')}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 p-5 pt-0 sm:flex-nowrap">
        <button
          onClick={() => navigate(`/missions/${mission.id}`)}
          className="cv-ghost-button flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition-colors sm:flex-1"
        >
          <EyeIcon className="h-5 w-5" />
          {t('missions.view')}
        </button>
        <button
          onClick={() => onEdit(mission)}
          title={t('common.edit')}
          className="cv-ghost-button min-h-12 min-w-12 rounded-2xl p-3 text-[var(--cv-primary)] transition-colors"
        >
          <PencilSquareIcon className="h-5 w-5" />
        </button>
        <button
          onClick={() => onDelete(mission.id)}
          title={t('common.delete')}
          className="cv-ghost-button min-h-12 min-w-12 rounded-2xl p-3 text-[var(--cv-danger)] transition-colors"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
