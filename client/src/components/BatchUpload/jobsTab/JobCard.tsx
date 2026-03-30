import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownTrayIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import CollectionJobDetails from './CollectionJobDetails';
import JobItemsDetails from './JobItemsDetails';
import type { Job, TranslateFn } from './types';
import {
  formatDate,
  getEstimatedTimeRemaining,
  getJobTypeIcon,
  getJobTypeText,
  getProgressPercentage,
  getStatusBadgeClass,
  getStatusIcon,
  getStatusText,
  getSummaryText,
  isCollectionJob,
} from './helpers';

interface JobCardProps {
  job: Job;
  expanded: boolean;
  pendingNameInputs: Record<string, string>;
  submittingName: string | null;
  onToggleExpand: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  onDownloadExport: (jobId: string, fileName: string) => void;
  onPendingNameChange: (itemId: string, value: string) => void;
  onProvideName: (itemId: string) => void;
  t: TranslateFn;
}

export default function JobCard({
  job,
  expanded,
  pendingNameInputs,
  submittingName,
  onToggleExpand,
  onCancelJob,
  onDeleteJob,
  onDownloadExport,
  onPendingNameChange,
  onProvideName,
  t,
}: JobCardProps): JSX.Element {
  const progressPercentage = getProgressPercentage(job);
  const estimatedTimeRemaining = getEstimatedTimeRemaining(job);
  const isCollection = isCollectionJob(job.job_type);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors" onClick={() => onToggleExpand(job.id)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(job.status)}
            <div>
              <div className="flex items-center gap-2">
                {getJobTypeIcon(job.job_type)}
                <span className="font-medium text-gray-900 dark:text-gray-100">{getJobTypeText(job, t)}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadgeClass(job.status)}`}>{getStatusText(job.status, t)}</span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {formatDate(job.created_at)}
                {job.user_name && ` • ${job.user_name}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right min-w-[80px]">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{job.processed_items} / {job.total_items}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{getSummaryText(job)}</div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="w-32 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                <motion.div
                  className={`h-full ${job.status === 'failed' ? 'bg-red-500' : job.status === 'completed' ? 'bg-green-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
                {job.status === 'processing' && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`font-semibold ${job.status === 'completed' ? 'text-green-600 dark:text-green-400' : job.status === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                  {progressPercentage}%
                </span>
                {estimatedTimeRemaining && <span className="text-gray-500 dark:text-gray-400">{estimatedTimeRemaining}</span>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {job.status === 'completed' && job.export_file_available && job.export_file_name && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadExport(job.id, job.export_file_name!);
                  }}
                  className="p-1.5 text-green-500 hover:text-green-600 transition-colors"
                  title={t('batchJobs.download')}
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                </button>
              )}

              {(job.status === 'pending' || job.status === 'processing') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelJob(job.id);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  title={t('batchJobs.cancel')}
                >
                  <XCircleIcon className="w-5 h-5" />
                </button>
              )}

              {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteJob(job.id);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  title={t('batchJobs.delete')}
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}

              {expanded ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && isCollection && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-gray-200 dark:border-gray-700">
            <CollectionJobDetails job={job} formatDate={formatDate} t={t} />
          </motion.div>
        )}

        {expanded && !isCollection && job.items && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-gray-200 dark:border-gray-700">
            <JobItemsDetails
              job={job}
              pendingNameInputs={pendingNameInputs}
              submittingName={submittingName}
              onPendingNameChange={onPendingNameChange}
              onProvideName={onProvideName}
              t={t}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
