import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowDownTrayIcon, CheckCircleIcon, MagnifyingGlassIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface ResumeAnalysisStepIndicatorProps {
  resumeId: string;
  hasImprovedText: boolean;
  onImprove: () => void;
  t: any;
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
      <div className="flex items-center">
        <div className="flex items-center gap-2">
          <motion.div
            className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/25"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <MagnifyingGlassIcon className="w-4 h-4 text-white" />
          </motion.div>
          <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            {t('resume.steps.analysis')}
          </span>
        </div>

        <div className="w-10 sm:w-16 h-[3px] mx-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-emerald-500"
            initial={false}
            animate={{ width: hasImprovedText ? '100%' : '30%' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>

        {hasImprovedText ? (
          <Link to={`/resumes/${resumeId}/improve`} className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-sm shadow-green-500/20">
              <CheckCircleIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 group-hover:underline">
              {t('resume.steps.improve')} ✓
            </span>
          </Link>
        ) : (
          <button onClick={onImprove} className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center group-hover:border-indigo-400 transition-colors">
              <SparklesIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 transition-colors" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {t('resume.steps.improve')}
            </span>
          </button>
        )}

        <div className="w-10 sm:w-16 h-[3px] mx-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-purple-500"
            initial={false}
            animate={{ width: hasImprovedText ? '60%' : '0%' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>

        <Link to={`/resumes/${resumeId}/export`} className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center group-hover:border-purple-400 transition-colors">
            <ArrowDownTrayIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-purple-500 transition-colors" />
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {t('resume.steps.export')}
          </span>
        </Link>
      </div>
    </motion.div>
  );
}
