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
  const items = [
    {
      icon: DocumentTextIcon,
      iconBgClassName: 'bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]',
      label: t('resumes.stats.total'),
      value: stats.total,
      helper: t('resumes.subtitle'),
    },
    {
      icon: CheckCircleIcon,
      iconBgClassName: 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)]',
      label: t('resumes.stats.improved'),
      value: stats.improved,
      helper: t('resumes.status.improved'),
    },
    {
      icon: ClockIcon,
      iconBgClassName: 'bg-[var(--cv-secondary-soft)] text-[var(--cv-secondary)]',
      label: t('resumes.stats.processing'),
      value: stats.processing,
      helper: t('resumes.status.processing'),
    },
    {
      icon: ChartBarIcon,
      iconBgClassName: 'bg-[var(--cv-cyan-soft)] text-[var(--cv-cyan)]',
      label: t('resumes.stats.avgScore'),
      value: `${stats.avgScore}%`,
      helper: t('resumes.score_label'),
    },
  ];

  return (
    <div className={`mb-[22px] grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 ${compact ? 'xl:gap-3' : ''}`}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="cv-stat-card rounded-[13px] px-[18px] py-[17px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="cv-kicker mb-[5px] truncate">{item.label}</div>
                <div className="cv-display text-[28px] font-bold leading-none text-[var(--cv-text)]">{item.value}</div>
              </div>
              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] ${item.iconBgClassName}`}>
                <Icon className="h-[17px] w-[17px]" />
              </span>
            </div>
            {item.helper ? <p className="mt-[3px] line-clamp-2 text-[11.5px] leading-4 text-[var(--cv-subtle)]">{item.helper}</p> : null}
          </div>
        );
      })}
    </div>
  );
};

export default StatsCards;
