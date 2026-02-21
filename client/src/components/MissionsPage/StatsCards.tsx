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

const StatsCards = ({ stats, missionsCount, t }: StatsCardsProps): JSX.Element => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <StatCard
        icon={ClipboardDocumentListIcon}
        iconBgColor="bg-blue-100 dark:bg-blue-900/30"
        iconColor="text-blue-600 dark:text-blue-400"
        label={t('missions.stats.total')}
        value={stats.total}
        delay={0}
      />
      <StatCard
        icon={BuildingOfficeIcon}
        iconBgColor="bg-green-100 dark:bg-green-900/30"
        iconColor="text-green-600 dark:text-green-400"
        label={t('missions.stats.firms')}
        value={stats.firms}
        delay={0.1}
      />
      <StatCard
        icon={BriefcaseIcon}
        iconBgColor="bg-purple-100 dark:bg-purple-900/30"
        iconColor="text-purple-600 dark:text-purple-400"
        label={t('missions.stats.active')}
        value={missionsCount}
        delay={0.2}
      />
    </div>
  );
};

export default StatsCards;
