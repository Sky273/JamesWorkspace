import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { TranslateFn } from './types';

interface JobsTabHeaderProps {
  refreshing: boolean;
  onRefresh: () => void;
  t: TranslateFn;
}

export default function JobsTabHeader({ refreshing, onRefresh, t }: JobsTabHeaderProps): JSX.Element {
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('batchJobs.title')}</h2>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {t('batchJobs.refresh')}
        </button>
      </div>

      <div className="batch-jobs-server-info flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="batch-jobs-server-info-content text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">{t('batchJobs.serverInfo.title')}</p>
          <p className="batch-jobs-server-info-description mt-1 text-blue-600 dark:text-blue-400">{t('batchJobs.serverInfo.description')}</p>
        </div>
      </div>
    </>
  );
}
