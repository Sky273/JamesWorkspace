import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowDownTrayIcon, CheckCircleIcon, MagnifyingGlassIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

interface ResumeAnalysisStepIndicatorProps {
  resumeId: string;
  hasImprovedText: boolean;
  onImprove: () => void;
  t: TFunction;
}

export default function ResumeAnalysisStepIndicator({
  resumeId,
  hasImprovedText,
  onImprove,
  t
}: ResumeAnalysisStepIndicatorProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mb-6"
    >
      <div className="cv-panel flex flex-wrap items-center gap-y-3 rounded-[2rem] px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <motion.div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6b4eff] shadow-none"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <MagnifyingGlassIcon className="h-4 w-4 text-white" />
          </motion.div>
          <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            {t('resume.steps.analysis')}
          </span>
        </div>

        <div className="mx-2 h-[3px] w-10 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10 sm:w-16">
          <motion.div
            className="h-full rounded-full bg-[#6b4eff]"
            initial={false}
            animate={{ width: hasImprovedText ? '100%' : '30%' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>

        {hasImprovedText ? (
          <Link to={`/resumes/${resumeId}/improve`} className="group flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-600 shadow-sm shadow-green-500/20">
              <CheckCircleIcon className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-medium text-emerald-600 group-hover:underline dark:text-emerald-400">
              {t('resume.steps.improve')} ✓
            </span>
          </Link>
        ) : (
          <button onClick={onImprove} className="group flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 transition-colors group-hover:border-indigo-400 dark:border-gray-600">
              <SparklesIcon className="h-4 w-4 text-gray-400 transition-colors group-hover:text-indigo-500 dark:text-gray-500" />
            </div>
            <span className="text-sm text-gray-500 transition-colors group-hover:text-indigo-600 dark:text-gray-400 dark:group-hover:text-indigo-400">
              {t('resume.steps.improve')}
            </span>
          </button>
        )}

        <div className="mx-2 h-[3px] w-10 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10 sm:w-16">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-purple-500"
            initial={false}
            animate={{ width: hasImprovedText ? '60%' : '0%' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>

        <Link to={`/resumes/${resumeId}/export`} className="group flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 transition-colors group-hover:border-purple-400 dark:border-gray-600">
            <ArrowDownTrayIcon className="h-4 w-4 text-gray-400 transition-colors group-hover:text-purple-500 dark:text-gray-500" />
          </div>
          <span className="text-sm text-gray-500 transition-colors group-hover:text-purple-600 dark:text-gray-400 dark:group-hover:text-purple-400">
            {t('resume.steps.export')}
          </span>
        </Link>
      </div>
    </motion.div>
  );
}
