/**
 * Stats Cards Component for Missions Page
 * TypeScript version
 */

import {
  ClipboardDocumentListIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

import StatCardsGrid from '../page/StatCardsGrid';

interface Stats {
  total: number;
  firms: number;
  linkedDeals: number;
  active: number;
  draft: number;
  closed: number;
}

interface StatsCardsProps {
  stats: Stats;
  missionsCount: number;
  t: TFunction;
}

const StatsCards = ({ stats, missionsCount, t }: StatsCardsProps): JSX.Element => {
  return (
    <StatCardsGrid
      className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4"
      items={[
        {
          icon: ClipboardDocumentListIcon,
          iconBgClassName: 'bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]',
          iconClassName: '',
          label: t('missions.stats.total'),
          value: stats.total,
          helper: t('missions.subtitle'),
        },
        {
          icon: BriefcaseIcon,
          iconBgClassName: 'bg-[var(--cv-secondary-soft)] text-[var(--cv-secondary)]',
          iconClassName: '',
          label: t('missions.stats.active'),
          value: stats.active,
          helper: `${missionsCount} ${t('missions.results')}`,
        },
        {
          icon: BuildingOfficeIcon,
          iconBgClassName: 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)]',
          iconClassName: '',
          label: t('missions.stats.firms'),
          value: stats.firms,
          helper: t('navigation.crm', { defaultValue: 'CRM' }),
        },
        {
          icon: DocumentTextIcon,
          iconBgClassName: 'bg-[var(--cv-warning-soft)] text-[var(--cv-warning)]',
          iconClassName: '',
          label: t('missions.deal', { defaultValue: 'Affaires liées' }),
          value: stats.linkedDeals,
          helper: `${stats.draft} ${t('missions.status.Draft')} · ${stats.closed} ${t('missions.status.Closed')}`,
        },
      ]}
    />
  );
};

export default StatsCards;
