import type { Job, TranslateFn } from './types';

interface CollectionJobDetailsProps {
  job: Job;
  formatDate: (value: string) => string;
  t: TranslateFn;
}

export default function CollectionJobDetails({ job, formatDate, t }: CollectionJobDetailsProps): JSX.Element {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex justify-between px-3 py-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          <span className="text-gray-500 dark:text-gray-400">{t('batchJobs.collection.processed')}</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{job.processed_items}</span>
        </div>
        <div className="flex justify-between px-3 py-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          <span className="text-gray-500 dark:text-gray-400">{t('batchJobs.collection.success')}</span>
          <span className="font-medium text-green-600 dark:text-green-400">{job.success_count}</span>
        </div>
        <div className="flex justify-between px-3 py-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          <span className="text-gray-500 dark:text-gray-400">{t('batchJobs.collection.errors')}</span>
          <span className={`font-medium ${job.error_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{job.error_count}</span>
        </div>
        {job.started_at && (
          <div className="flex justify-between px-3 py-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            <span className="text-gray-500 dark:text-gray-400">{t('batchJobs.collection.startedAt')}</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{formatDate(job.started_at)}</span>
          </div>
        )}
      </div>

      {job.error_message && (
        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
          {job.error_message}
        </div>
      )}
    </div>
  );
}
