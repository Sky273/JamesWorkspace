import type { ComponentType, SVGProps } from 'react';
import { motion } from 'framer-motion';

interface StatCardItem {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconBgClassName: string;
  iconClassName: string;
  label: string;
  value: number | string;
  helper?: string;
}

interface StatCardsGridProps {
  className?: string;
  items: StatCardItem[];
}

export default function StatCardsGrid({
  className = 'grid grid-cols-1 gap-4 md:grid-cols-3 mb-6',
  items,
}: StatCardsGridProps) {
  return (
    <div className={className}>
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={`${item.label}-${index}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className="lux-card rounded-[1.75rem] p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="cv-kicker mb-2">{item.label}</div>
                <div className="cv-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-[var(--cv-text)]">{item.value}</div>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.iconBgClassName}`}>
                <Icon className={`h-6 w-6 ${item.iconClassName}`} />
              </div>
            </div>
            {item.helper ? <p className="text-sm text-slate-600 dark:text-[var(--cv-muted)]">{item.helper}</p> : null}
          </motion.div>
        );
      })}
    </div>
  );
}
