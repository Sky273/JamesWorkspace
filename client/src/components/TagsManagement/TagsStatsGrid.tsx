import { motion } from 'framer-motion';
import { TagIcon } from '@heroicons/react/24/outline';
import type { CategoryConfig, Tags } from './types';

interface TagsStatsGridProps {
  tags: Tags;
  totalTags: number;
  categoryConfig: Record<string, CategoryConfig>;
  t: (key: string) => string;
}

export default function TagsStatsGrid({
  tags,
  totalTags,
  categoryConfig,
  t,
}: TagsStatsGridProps): JSX.Element {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="tags-stat-card rounded-[1.5rem] border border-gray-200/80 bg-white/80 p-4 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/30"
      >
        <div className="flex items-center gap-3">
          <div className="tags-icon-shell rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
            <TagIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('tags.stats.totalTags')}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalTags}</div>
          </div>
        </div>
      </motion.div>
      {Object.entries(categoryConfig).map(([category, config], index) => {
        const IconComponent = config.icon;
        const count = tags[category]?.length || 0;
        return (
          <motion.div
            key={category}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * (index + 1) }}
            className="tags-stat-card rounded-[1.5rem] border border-gray-200/80 bg-white/80 p-4 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/30"
          >
            <div className="flex items-center gap-3">
              <div className={`tags-icon-shell rounded-lg p-2 ${config.bgLight}`}>
                <IconComponent className={`h-6 w-6 ${config.textColor}`} />
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{category}</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{count}</div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
