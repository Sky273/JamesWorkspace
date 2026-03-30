import { motion } from 'framer-motion';
import { ExclamationTriangleIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { formatDateTime } from '../../utils/dateFormatter';

interface ProfileMatchingRecentEntry {
  timestamp?: string;
  provider?: string;
  event?: string;
  profilesRequested?: number;
  profilesScored?: number;
  profilesExplained?: number;
  profilesReturned?: number;
  batchesStarted?: number;
  batchesRetried?: number;
  batchesFailed?: number;
  normalizationEvents?: number;
  field?: string;
  source?: string;
  inputType?: string;
}

interface ProfileMatchingMetrics {
  searches?: number;
  batchesStarted?: number;
  batchesRetried?: number;
  batchesFailed?: number;
  normalizationEvents?: number;
  profilesRequested?: number;
  profilesScored?: number;
  profilesExplained?: number;
  profilesReturned?: number;
  recent?: ProfileMatchingRecentEntry[];
  byProvider?: Record<string, {
    searches?: number;
    batchesStarted?: number;
    batchesRetried?: number;
    batchesFailed?: number;
    normalizationEvents?: number;
    profilesRequested?: number;
    profilesScored?: number;
  }>;
}

interface ProfileMatchingMetricsCardProps {
  metrics: ProfileMatchingMetrics | null | undefined;
  requestedToScoredRatio: number | null;
  scoredToExplainedRatio: number | null;
  scoredToReturnedRatio: number | null;
  alerts: string[];
  t: any;
  safeNumber: (value: unknown, defaultValue?: number) => number;
  formatNumber: (value?: number) => string;
}

export default function ProfileMatchingMetricsCard({
  metrics,
  requestedToScoredRatio,
  scoredToExplainedRatio,
  scoredToReturnedRatio,
  alerts,
  t,
  safeNumber,
  formatNumber
}: ProfileMatchingMetricsCardProps): JSX.Element | null {
  if (!metrics) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 0 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.195 }} className="rounded-xl border bg-violet-50 text-violet-700 border-violet-200 dark:bg-gray-800 dark:text-violet-400 dark:border-violet-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium opacity-80">{t('metrics.profileMatchingTitle')}</p>
          <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(metrics.searches))}</p>
          <p className="text-xs mt-1 opacity-60">{t('metrics.profileMatchingSubtitle')}</p>
        </div>
        <SparklesIcon className="w-10 h-10 opacity-50" />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.profilesRequested')}</p>
          <p className="font-semibold">{formatNumber(safeNumber(metrics.profilesRequested))}</p>
        </div>
        <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.profilesScored')}</p>
          <p className="font-semibold">{formatNumber(safeNumber(metrics.profilesScored))}</p>
        </div>
        <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.batchesStarted')}</p>
          <p className="font-semibold">{safeNumber(metrics.batchesStarted)}</p>
        </div>
        <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.batchesRetriedFailed')}</p>
          <p className="font-semibold">{safeNumber(metrics.batchesRetried)} / {safeNumber(metrics.batchesFailed)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.profilesExplained')}</p>
          <p className="font-semibold">{formatNumber(safeNumber(metrics.profilesExplained))}</p>
        </div>
        <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.profilesReturned')}</p>
          <p className="font-semibold">{formatNumber(safeNumber(metrics.profilesReturned))}</p>
        </div>
        <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.profileNormalizationEvents')}</p>
          <p className="font-semibold">{formatNumber(safeNumber(metrics.normalizationEvents))}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-4">
        <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.requestedToScoredRatio')}</p>
          <p className="font-semibold">{requestedToScoredRatio !== null ? `${(requestedToScoredRatio * 100).toFixed(1)}%` : 'N/A'}</p>
        </div>
        <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.scoredToExplainedRatio')}</p>
          <p className="font-semibold">{scoredToExplainedRatio !== null ? `${(scoredToExplainedRatio * 100).toFixed(1)}%` : 'N/A'}</p>
        </div>
        <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.scoredToReturnedRatio')}</p>
          <p className="font-semibold">{scoredToReturnedRatio !== null ? `${(scoredToReturnedRatio * 100).toFixed(1)}%` : 'N/A'}</p>
        </div>
      </div>
      {alerts.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <ExclamationTriangleIcon className="h-4 w-4" />
            {t('metrics.profileMatchingAlerts')}
          </div>
          <div className="space-y-1">
            {alerts.map((alert, index) => (
              <p key={`${alert}-${index}`}>{alert}</p>
            ))}
          </div>
        </div>
      )}
      {metrics.byProvider && Object.keys(metrics.byProvider).length > 0 && (
        <div className="overflow-x-auto max-h-48">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-violet-200 dark:border-violet-700">
                <th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.model')}</th>
                <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.searches')}</th>
                <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.calls')}</th>
                <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.profileNormalizationEventsShort')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.byProvider)
                .sort(([, left], [, right]) => safeNumber(right.searches) - safeNumber(left.searches))
                .slice(0, 5)
                .map(([provider, stats]) => (
                  <tr key={provider} className="border-b border-violet-100 dark:border-violet-800">
                    <td className="py-2 px-2 font-mono text-xs">{provider}</td>
                    <td className="py-2 px-2 text-right font-semibold">{safeNumber(stats.searches)}</td>
                    <td className="py-2 px-2 text-right opacity-70">{safeNumber(stats.batchesStarted)}</td>
                    <td className="py-2 px-2 text-right opacity-70">{safeNumber(stats.normalizationEvents)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {metrics.recent && metrics.recent.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold opacity-70 mb-2">{t('metrics.profileMatchingRecent')}</p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {metrics.recent.slice().reverse().map((entry, index) => (
              <div key={`${entry.timestamp || 'entry'}-${index}`} className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{entry.provider || 'unknown'}</span>
                  <span className="opacity-60">{entry.timestamp ? formatDateTime(entry.timestamp) : 'N/A'}</span>
                </div>
                <div className="mt-1 opacity-80">
                  {entry.event || 'search'} | {t('metrics.profilesRequested')}: {safeNumber(entry.profilesRequested)} | {t('metrics.profilesScored')}: {safeNumber(entry.profilesScored)}
                </div>
                {(safeNumber(entry.normalizationEvents) > 0 || entry.field || entry.inputType) && (
                  <div className="mt-1 opacity-70">
                    {t('metrics.profileNormalizationEvents')}: {safeNumber(entry.normalizationEvents)}
                    {entry.field ? ` | ${t('metrics.field')}: ${entry.field}` : ''}
                    {entry.inputType ? ` | ${t('metrics.inputType')}: ${entry.inputType}` : ''}
                    {entry.source ? ` | ${t('metrics.source')}: ${entry.source}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
