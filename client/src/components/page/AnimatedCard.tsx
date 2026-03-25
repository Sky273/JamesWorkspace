import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const BASE_CARD_CLASS_NAME =
  'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-shadow';

export default function AnimatedCard({
  children,
  className = '',
  contentClassName,
  hoverClassName = 'hover:shadow-lg',
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  hoverClassName?: string;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={[BASE_CARD_CLASS_NAME, hoverClassName, className].filter(Boolean).join(' ')}
    >
      {contentClassName ? <div className={contentClassName}>{children}</div> : children}
    </motion.div>
  );
}
