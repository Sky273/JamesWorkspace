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
}

const StatCard = ({ icon: Icon, iconBgColor, iconColor, label, value, delay = 0 }: StatCardProps): JSX.Element => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }} 
    animate={{ opacity: 1, scale: 1 }} 
    transition={{ delay }}
    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-4 hover:shadow-md transition-shadow"
  >
    <div className="flex items-center gap-3">
      <div className={`p-2.5 ${iconBgColor} rounded-xl`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{value}</div>
      </div>
    </div>
  </motion.div>
);

const StatsCards = ({ stats, t }: StatsCardsProps): JSX.Element => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        icon={DocumentTextIcon}
        iconBgColor="bg-blue-100 dark:bg-blue-900/30"
        iconColor="text-blue-600 dark:text-blue-400"
        label={t('resumes.stats.total')}
        value={stats.total}
        delay={0}
      />
      <StatCard
        icon={CheckCircleIcon}
        iconBgColor="bg-green-100 dark:bg-green-900/30"
        iconColor="text-green-600 dark:text-green-400"
        label={t('resumes.stats.improved')}
        value={stats.improved}
        delay={0.1}
      />
      <StatCard
        icon={ClockIcon}
        iconBgColor="bg-yellow-100 dark:bg-yellow-900/30"
        iconColor="text-yellow-600 dark:text-yellow-400"
        label={t('resumes.stats.processing')}
        value={stats.processing}
        delay={0.2}
      />
      <StatCard
        icon={ChartBarIcon}
        iconBgColor="bg-purple-100 dark:bg-purple-900/30"
        iconColor="text-purple-600 dark:text-purple-400"
        label={t('resumes.stats.avgScore')}
        value={`${stats.avgScore}%`}
        delay={0.3}
      />
    </div>
  );
};

export default StatsCards;
