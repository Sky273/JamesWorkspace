/**
 * Stats Cards Component for Missions Page
 * TypeScript version
 */

import { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
import { motion } from 'framer-motion';
import { 
  ClipboardDocumentListIcon,
  BuildingOfficeIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline';

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

interface StatCardProps {
  icon: HeroIcon;
  iconBgColor: string;
  iconColor: string;
  label: string;
  value: string | number;
  delay?: number;
}

interface Stats {
  total: number;
  firms: number;
}

interface StatsCardsProps {
  stats: Stats;
  missionsCount: number;
  t: (key: string) => string;
}

const StatCard = ({ icon: Icon, iconBgColor, iconColor, label, value, delay = 0 }: StatCardProps): JSX.Element => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }} 
    animate={{ opacity: 1, scale: 1 }} 
    transition={{ delay }}
    className="cv-card rounded-[1.75rem] p-5 transition-all"
  >
    <div className="flex items-start gap-4">
      <div className={`rounded-2xl p-3 ${iconBgColor} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <div className="cv-kicker mb-2">{label}</div>
        <div className="cv-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-[var(--cv-text)]">{value}</div>
      </div>
    </div>
  </motion.div>
);

const StatsCards = ({ stats, missionsCount, t }: StatsCardsProps): JSX.Element => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <StatCard
        icon={ClipboardDocumentListIcon}
        iconBgColor="bg-[var(--cv-primary-soft)]"
        iconColor="text-[var(--cv-primary)]"
        label={t('missions.stats.total')}
        value={stats.total}
        delay={0}
      />
      <StatCard
        icon={BuildingOfficeIcon}
        iconBgColor="bg-[var(--cv-tertiary-soft)]"
        iconColor="text-[var(--cv-tertiary)]"
        label={t('missions.stats.firms')}
        value={stats.firms}
        delay={0.1}
      />
      <StatCard
        icon={BriefcaseIcon}
        iconBgColor="bg-[var(--cv-secondary-soft)]"
        iconColor="text-[var(--cv-secondary)]"
        label={t('missions.stats.active')}
        value={missionsCount}
        delay={0.2}
      />
    </div>
  );
};

export default StatsCards;
