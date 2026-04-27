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
  className = 'mb-5 grid grid-cols-1 gap-3 md:grid-cols-3',
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
            className="lux-card rounded-[13px] p-4"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="cv-kicker mb-1">{item.label}</div>
                <div className="cv-display text-2xl font-bold tracking-tight text-[var(--cv-text)]">{item.value}</div>
              </div>
              <div className={`flex h-9 w-9 items-center justify-center rounded-[9px] ${item.iconBgClassName}`}>
                <Icon className={`h-4 w-4 ${item.iconClassName}`} />
              </div>
            </div>
            {item.helper ? <p className="text-xs leading-5 text-[var(--cv-muted)]">{item.helper}</p> : null}
          </motion.div>
        );
      })}
    </div>
  );
}
