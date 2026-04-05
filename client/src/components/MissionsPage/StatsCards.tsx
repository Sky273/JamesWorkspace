/**
 * Stats Cards Component for Missions Page
 * TypeScript version
 */

import {
  ClipboardDocumentListIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline';

import StatCardsGrid from '../page/StatCardsGrid';

interface Stats {
  total: number;
  firms: number;
}

interface StatsCardsProps {
  stats: Stats;
  missionsCount: number;
  t: (key: string) => string;
}

const StatsCards = ({ stats, missionsCount, t }: StatsCardsProps): JSX.Element => {
  return (
    <StatCardsGrid
      className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3"
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
          icon: BuildingOfficeIcon,
          iconBgClassName: 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)]',
          iconClassName: '',
          label: t('missions.stats.firms'),
          value: stats.firms,
          helper: t('navigation.crm', 'CRM'),
        },
        {
          icon: BriefcaseIcon,
          iconBgClassName: 'bg-[var(--cv-secondary-soft)] text-[var(--cv-secondary)]',
          iconClassName: '',
          label: t('missions.stats.active'),
          value: missionsCount,
          helper: t('missions.viewList', 'Liste'),
        },
      ]}
    />
  );
};

export default StatsCards;
