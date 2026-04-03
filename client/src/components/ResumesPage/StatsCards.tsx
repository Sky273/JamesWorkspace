/**
 * Stats Cards Component for Resumes Page
 * TypeScript version
 */

import { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
import { motion } from 'framer-motion';
import { 
  DocumentTextIcon, 
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon
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
  improved: number;
  processing: number;
  avgScore: number;
}

interface StatsCardsProps {
  stats: Stats;
  t: (key: string) => string;
  variant?: 'default' | 'compact';
}

const StatCard = ({
  icon: Icon,
  iconBgColor,
  iconColor,
  label,
  value,
  delay = 0,
  compact = false,
}: StatCardProps & { compact?: boolean }): JSX.Element => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }} 
    animate={{ opacity: 1, scale: 1 }} 
    transition={{ delay }}
    className={`cv-card transition-all ${compact ? 'cv-stat-card-compact rounded-[1.6rem] p-4' : 'rounded-[1.75rem] p-5'}`}
  >
    <div className={`flex ${compact ? 'items-center gap-3' : 'items-start gap-4'}`}>
      <div className={`${compact ? 'rounded-[1.1rem] p-2.5' : 'rounded-2xl p-3'} ${iconBgColor}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <div className="cv-kicker mb-2">{label}</div>
        <div className={`cv-display font-extrabold tracking-tight text-slate-950 dark:text-[#dee5ff] ${compact ? 'text-2xl' : 'text-3xl'}`}>{value}</div>
      </div>
    </div>
  </motion.div>
);

const StatsCards = ({ stats, t, variant = 'default' }: StatsCardsProps): JSX.Element => {
  const compact = variant === 'compact';

  return (
    <div className={`mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 ${compact ? 'xl:gap-4' : 'gap-6'}`}>
      <StatCard
        icon={DocumentTextIcon}
        iconBgColor="bg-[var(--cv-primary-soft)]"
        iconColor="text-[var(--cv-primary)]"
        label={t('resumes.stats.total')}
        value={stats.total}
        delay={0}
        compact={compact}
      />
      <StatCard
        icon={CheckCircleIcon}
        iconBgColor="bg-[var(--cv-tertiary-soft)]"
        iconColor="text-[var(--cv-tertiary)]"
        label={t('resumes.stats.improved')}
        value={stats.improved}
        delay={0.1}
        compact={compact}
      />
      <StatCard
        icon={ClockIcon}
        iconBgColor="bg-[var(--cv-secondary-soft)]"
        iconColor="text-[var(--cv-secondary)]"
        label={t('resumes.stats.processing')}
        value={stats.processing}
        delay={0.2}
        compact={compact}
      />
      <StatCard
        icon={ChartBarIcon}
        iconBgColor="bg-[var(--cv-cyan-soft)]"
        iconColor="text-[var(--cv-cyan)]"
        label={t('resumes.stats.avgScore')}
        value={`${stats.avgScore}%`}
        delay={0.3}
        compact={compact}
      />
    </div>
  );
};

export default StatsCards;
