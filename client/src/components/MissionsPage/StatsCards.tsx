import {
  BriefcaseIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

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
  const items = [
    {
      icon: ClipboardDocumentListIcon,
      iconBgClassName: 'bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]',
      label: t('missions.stats.total'),
      value: stats.total,
      helper: t('missions.subtitle'),
    },
    {
      icon: BriefcaseIcon,
      iconBgClassName: 'bg-[var(--cv-secondary-soft)] text-[var(--cv-secondary)]',
      label: t('missions.stats.active'),
      value: stats.active,
      helper: `${missionsCount} ${t('missions.results')}`,
    },
    {
      icon: BuildingOfficeIcon,
      iconBgClassName: 'bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)]',
      label: t('missions.stats.firms'),
      value: stats.firms,
      helper: t('navigation.crm', { defaultValue: 'CRM' }),
    },
    {
      icon: DocumentTextIcon,
      iconBgClassName: 'bg-[var(--cv-warning-soft)] text-[var(--cv-warning)]',
      label: t('missions.deal', { defaultValue: 'Affaires liees' }),
      value: stats.linkedDeals,
      helper: `${stats.draft} ${t('missions.status.Draft')} - ${stats.closed} ${t('missions.status.Closed')}`,
    },
  ];

  return (
    <div className="missions-stats-grid mb-[22px] grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article key={item.label} className="cv-stat-card missions-stat-card flex min-h-[76px] items-start justify-between gap-3 rounded-[13px] px-4 py-3">
            <div className="min-w-0">
              <div className="cv-kicker text-[10px]">{item.label}</div>
              <div className="cv-display mt-2 text-[23px] font-bold leading-none text-[var(--cv-text)]">
                {item.value}
              </div>
              <p className="mt-2 truncate text-[11px] leading-4 text-[var(--cv-muted)]">{item.helper}</p>
            </div>
            <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${item.iconBgClassName}`}>
              <Icon className="h-4 w-4" />
            </span>
          </article>
        );
      })}
    </div>
  );
};

export default StatsCards;
