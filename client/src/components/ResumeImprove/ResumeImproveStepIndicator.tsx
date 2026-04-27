import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SparklesIcon, CheckCircleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

interface ResumeImproveStepIndicatorProps {
  resumeId: string;
  hasImprovedText: boolean;
  t: TFunction;
}

export default function ResumeImproveStepIndicator({
  resumeId,
  hasImprovedText,
  t
}: ResumeImproveStepIndicatorProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mb-6"
    >
      <div className="flex items-center">
        <Link to={`/resumes/${resumeId}/analysis`} className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-sm shadow-green-500/20">
            <CheckCircleIcon className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 group-hover:underline">
            {t('resume.steps.analysis')}
          </span>
        </Link>

        <div className="mx-2 h-[3px] w-10 rounded-full bg-[#6b4eff] sm:w-16" />

        <div className="flex items-center gap-2">
          <motion.div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6b4eff] shadow-none"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <SparklesIcon className="w-4 h-4 text-white" />
          </motion.div>
          <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            {t('resume.steps.improve')}
          </span>
        </div>

        <div className="w-10 sm:w-16 h-[3px] mx-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
          <motion.div
            className="h-full rounded-full bg-[#6b4eff]"
            initial={false}
            animate={{ width: hasImprovedText ? '100%' : '30%' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>

        {hasImprovedText ? (
          <Link to={`/resumes/${resumeId}/export`} className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-fuchsia-600 flex items-center justify-center shadow-sm shadow-purple-500/20">
              <ArrowDownTrayIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-purple-600 dark:text-purple-400 group-hover:underline">
              {t('resume.steps.export')}
            </span>
          </Link>
        ) : (
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center">
              <ArrowDownTrayIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            <span className="text-sm text-gray-400 dark:text-gray-500">
              {t('resume.steps.export')}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
