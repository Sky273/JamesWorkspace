import { motion } from 'framer-motion';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PaperAirplaneIcon,
  UserIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import type { Job, JobItem, TranslateFn } from './types';
import { getItemRenameText, getProcessingDetailsText } from './helpers';

interface JobItemsDetailsProps {
  job: Job;
  pendingNameInputs: Record<string, string>;
  submittingName: string | null;
  onPendingNameChange: (itemId: string, value: string) => void;
  onProvideName: (itemId: string) => void;
  t: TranslateFn;
}

function getItemStatusIcon(item: JobItem): JSX.Element {
  if (item.status === 'success') return <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />;
  if (item.status === 'error') return <ExclamationCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />;
  if (item.status === 'processing') return <ArrowPathIcon className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />;
  if (item.status === 'pending') return <ClockIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />;
  if (item.status === 'pending_name') return <UserIcon className="w-4 h-4 text-orange-500 flex-shrink-0" />;
  return <XCircleIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />;
}

export default function JobItemsDetails({
  job,
  pendingNameInputs,
  submittingName,
  onPendingNameChange,
  onProvideName,
  t,
}: JobItemsDetailsProps): JSX.Element {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 max-h-64 overflow-y-auto">
      {job.items && job.items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('batchJobs.noItems')}</p>
      ) : (
        <div className="space-y-2">
          {job.items?.map((item) => {
            const processingDetails = getProcessingDetailsText(item);
            return (
              <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getItemStatusIcon(item)}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate" title={item.file_name}>{item.file_name}</span>

                    {item.relative_path && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate" title={item.relative_path}>{item.relative_path}</span>
                    )}

                    {job.job_type === 'deal-export' && !item.relative_path && item.original_name && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate" title={item.original_name}>{item.original_name}</span>
                    )}

                    {job.job_type !== 'deal-export' && item.original_name && !item.display_name && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate" title={item.original_name}>{item.original_name}</span>
                    )}

                    {job.job_type !== 'deal-export' && item.original_name && item.display_name && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {getItemRenameText(item.original_name, item.display_name)}
                      </span>
                    )}

                    {item.status === 'processing' && processingDetails && (
                      <span className="text-xs text-cyan-600 dark:text-cyan-400 truncate">{processingDetails}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {item.status === 'processing' && (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-blue-500" initial={{ width: 0 }} animate={{ width: `${item.progress}%` }} transition={{ duration: 0.3 }} />
                      </div>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 min-w-[32px]">{item.progress}%</span>
                    </div>
                  )}

                  {item.status !== 'pending_name' && item.error_message && (
                    <span className="text-xs text-red-500 truncate max-w-xs" title={item.error_message}>{item.error_message}</span>
                  )}
                </div>

                {item.status === 'pending_name' && (
                  <div className="flex items-center gap-2 ml-2">
                    <input
                      type="text"
                      value={pendingNameInputs[item.id] || ''}
                      onChange={(e) => onPendingNameChange(item.id, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onProvideName(item.id)}
                      placeholder={t('batchJobs.enterCandidateName')}
                      className="w-40 px-2 py-1 text-sm border border-orange-300 dark:border-orange-600 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                      disabled={submittingName === item.id}
                    />
                    <button
                      onClick={() => onProvideName(item.id)}
                      disabled={submittingName === item.id || !pendingNameInputs[item.id]?.trim()}
                      className="p-1.5 text-white bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded transition-colors"
                      title={t('batchJobs.submitName')}
                    >
                      {submittingName === item.id ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <PaperAirplaneIcon className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
