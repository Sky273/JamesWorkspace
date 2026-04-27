import { motion } from 'framer-motion';
import { SparklesIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

interface ResumeImproveEmptyStateProps {
  onImprove: () => void;
  t: TFunction;
}

export default function ResumeImproveEmptyState({
  onImprove,
  t
}: ResumeImproveEmptyStateProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-[13px] border border-[#e4e4e7] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_14px_rgba(0,0,0,0.07)] dark:border-white/10 dark:bg-[#182235]"
    >
      <div className="absolute inset-0 bg-[#f8f8f7] dark:bg-[#111827]" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 8 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-[#6b4eff]/20"
            style={{ left: `${12 + i * 11}%`, top: `${20 + (i % 3) * 25}%`, width: 3 + (i % 3), height: 3 + (i % 3) }}
            animate={{ y: [0, -14, 0], opacity: [0, 0.6, 0], scale: [0.5, 1.3, 0.5] }}
            transition={{ duration: 3 + i * 0.4, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center py-16 px-6">
        <motion.div
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-[13px] bg-[#6b4eff] shadow-none"
          animate={{ scale: [1, 1.06, 1], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <SparklesIcon className="w-10 h-10 text-white" />
          <motion.div
            className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
          />
        </motion.div>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t('resume.improve.notYetImproved')}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto text-center">
          {t('resume.improve.description')}
        </p>

        <motion.button
          onClick={onImprove}
          className="inline-flex items-center gap-2.5 rounded-[9px] bg-[#6b4eff] px-7 py-3.5 font-semibold text-white shadow-none transition-all hover:bg-[#5b3eee]"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <SparklesIcon className="w-5 h-5" />
          {t('resume.actions.improveNow')}
        </motion.button>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
          {t('resume.improve.duration')}
        </p>
      </div>
    </motion.div>
  );
}
