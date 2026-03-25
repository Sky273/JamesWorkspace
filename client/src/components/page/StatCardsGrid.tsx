import type { ComponentType, SVGProps } from 'react';
import { motion } from 'framer-motion';

interface StatCardItem {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconBgClassName: string;
  iconClassName: string;
  label: string;
  value: number | string;
}

interface StatCardsGridProps {
  className?: string;
  items: StatCardItem[];
}

export default function StatCardsGrid({
  className = 'grid grid-cols-1 md:grid-cols-3 gap-4 mb-6',
  items,
}: StatCardsGridProps) {
  return (
    <div className={className}>
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={`${item.label}-${index}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.iconBgClassName}`}>
                <Icon className={`w-6 h-6 ${item.iconClassName}`} />
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{item.label}</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{item.value}</div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
