import { motion } from 'framer-motion';
import { SparklesIcon } from '@heroicons/react/24/outline';

interface ResumeImproveEmptyStateProps {
  onImprove: () => void;
  t: any;
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
      className="relative bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/60 via-transparent to-indigo-50/40 dark:from-blue-950/20 dark:via-transparent dark:to-indigo-950/15" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 8 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-indigo-400/25"
            style={{ left: `${12 + i * 11}%`, top: `${20 + (i % 3) * 25}%`, width: 3 + (i % 3), height: 3 + (i % 3) }}
            animate={{ y: [0, -14, 0], opacity: [0, 0.6, 0], scale: [0.5, 1.3, 0.5] }}
            transition={{ duration: 3 + i * 0.4, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center py-16 px-6">
        <motion.div
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 mb-6"
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
          className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/25 transition-all"
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
