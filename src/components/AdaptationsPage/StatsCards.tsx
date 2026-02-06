/**
 * Stats Cards Component for Adaptations Page
 * TypeScript version
 */

import { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
import { motion } from 'framer-motion';
import { 
  SparklesIcon, 
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

interface StatCardProps {
  icon: HeroIcon;
  iconBgColor: string;
  iconColor: string;
  label: string;
  value: string | number;
  delay: number;
}

interface Stats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  avgScore: number;
}

interface StatsCardsProps {
  stats: Stats;
  t: (key: string) => string;
}

const StatCard = ({ icon: Icon, iconBgColor, iconColor, label, value, delay }: StatCardProps): JSX.Element => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }} 
    animate={{ opacity: 1, scale: 1 }} 
    transition={{ delay }}
    className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
  >
    <div className="flex items-center gap-3">
      <div className={`p-2 ${iconBgColor} rounded-lg`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <div>
        <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      </div>
    </div>
  </motion.div>
);

const StatsCards = ({ stats, t }: StatsCardsProps): JSX.Element => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <StatCard
        icon={SparklesIcon}
        iconBgColor="bg-blue-100 dark:bg-blue-900/30"
        iconColor="text-blue-600 dark:text-blue-400"
        label={t('adaptations.stats.total')}
        value={stats.total}
        delay={0}
      />
      <StatCard
        icon={CheckCircleIcon}
        iconBgColor="bg-green-100 dark:bg-green-900/30"
        iconColor="text-green-600 dark:text-green-400"
        label={t('adaptations.stats.completed')}
        value={stats.completed}
        delay={0.1}
      />
      <StatCard
        icon={ClockIcon}
        iconBgColor="bg-yellow-100 dark:bg-yellow-900/30"
        iconColor="text-yellow-600 dark:text-yellow-400"
        label={t('adaptations.stats.processing')}
        value={stats.processing}
        delay={0.2}
      />
      <StatCard
        icon={XCircleIcon}
        iconBgColor="bg-red-100 dark:bg-red-900/30"
        iconColor="text-red-600 dark:text-red-400"
        label={t('adaptations.stats.failed')}
        value={stats.failed}
        delay={0.3}
      />
      <StatCard
        icon={ChartBarIcon}
        iconBgColor="bg-purple-100 dark:bg-purple-900/30"
        iconColor="text-purple-600 dark:text-purple-400"
        label={t('adaptations.stats.avgScore')}
        value={`${stats.avgScore}%`}
        delay={0.4}
      />
    </div>
  );
};

export default StatsCards;
