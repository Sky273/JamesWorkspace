/**
 * Stats Cards Component for Resumes Page
 * TypeScript version
 */

import {
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

import StatCardsGrid from '../page/StatCardsGrid';

interface Stats {
  total: number;
  improved: number;
  processing: number;
  avgScore: number;
}

interface StatsCardsProps {
  stats: Stats;
  t: (key: string) => string;
  variant?: 'default' | 'compact';
}

const StatsCards = ({ stats, t, variant = 'default' }: StatsCardsProps): JSX.Element => {
  const compact = variant === 'compact';

  return (
    <StatCardsGrid
      className={`mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 ${compact ? 'xl:gap-4' : 'gap-6'}`}
      items={[
        {
          icon: DocumentTextIcon,
          iconBgClassName: 'bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]',
          iconClassName: '',
          label: t('resumes.stats.total'),
          value: stats.total,
          helper: t('resumes.subtitle'),
        },
        {
          icon: CheckCircleIcon,
          iconBgClassName: 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)]',
          iconClassName: '',
          label: t('resumes.stats.improved'),
          value: stats.improved,
          helper: t('resumes.status.improved'),
        },
        {
          icon: ClockIcon,
          iconBgClassName: 'bg-[var(--cv-secondary-soft)] text-[var(--cv-secondary)]',
          iconClassName: '',
          label: t('resumes.stats.processing'),
          value: stats.processing,
          helper: t('resumes.status.processing'),
        },
        {
          icon: ChartBarIcon,
          iconBgClassName: 'bg-[var(--cv-cyan-soft)] text-[var(--cv-cyan)]',
          iconClassName: '',
          label: t('resumes.stats.avgScore'),
          value: `${stats.avgScore}%`,
          helper: t('resumes.score_label'),
        },
      ]}
    />
  );
};

export default StatsCards;
