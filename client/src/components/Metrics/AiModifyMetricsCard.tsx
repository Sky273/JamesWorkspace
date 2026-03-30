import { motion } from 'framer-motion';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { formatDateTime } from '../../utils/dateFormatter';

interface AiModifyRecentEntry {
  timestamp?: string;
  provider?: string;
  event?: string;
  successfulRuns?: number;
  failedRuns?: number;
  fallbackRuns?: number;
  selectionRuns?: number;
  inputChars?: number;
  outputChars?: number;
  source?: string;
}

interface AiModifyMetrics {
  runs?: number;
  successfulRuns?: number;
  failedRuns?: number;
  fallbackRuns?: number;
  selectionRuns?: number;
  inputChars?: number;
  outputChars?: number;
  recent?: AiModifyRecentEntry[];
  byProvider?: Record<string, {
    runs?: number;
    successfulRuns?: number;
    failedRuns?: number;
    fallbackRuns?: number;
    selectionRuns?: number;
    inputChars?: number;
    outputChars?: number;
  }>;
}

interface AiModifyMetricsCardProps {
  metrics: AiModifyMetrics | null | undefined;
  successRatio: number | null;
  t: any;
  safeNumber: (value: unknown, defaultValue?: number) => number;
  formatNumber: (value?: number) => string;
}

export default function AiModifyMetricsCard({
  metrics,
  successRatio,
  t,
  safeNumber,
  formatNumber
}: AiModifyMetricsCardProps): JSX.Element | null {
  if (!metrics) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.192 }} className="rounded-xl border bg-sky-50 text-sky-700 border-sky-200 dark:bg-gray-800 dark:text-sky-300 dark:border-sky-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium opacity-80">{t('metrics.aiModifyTitle')}</p>
          <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(metrics.runs))}</p>
          <p className="text-xs mt-1 opacity-60">{t('metrics.aiModifySubtitle')}</p>
        </div>
        <SparklesIcon className="w-10 h-10 opacity-50" />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.successFailures')}</p>
          <p className="font-semibold">{safeNumber(metrics.successfulRuns)} / {safeNumber(metrics.failedRuns)}</p>
        </div>
        <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.successRatio')}</p>
          <p className="font-semibold">{successRatio !== null ? `${(successRatio * 100).toFixed(1)}%` : 'N/A'}</p>
        </div>
        <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.fallbacks')}</p>
          <p className="font-semibold">{safeNumber(metrics.fallbackRuns)}</p>
        </div>
        <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.selectionRuns')}</p>
          <p className="font-semibold">{safeNumber(metrics.selectionRuns)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.inputChars')}</p>
          <p className="font-semibold">{formatNumber(safeNumber(metrics.inputChars))}</p>
        </div>
        <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.outputChars')}</p>
          <p className="font-semibold">{formatNumber(safeNumber(metrics.outputChars))}</p>
        </div>
      </div>
      {metrics.byProvider && Object.keys(metrics.byProvider).length > 0 && (
        <div className="overflow-x-auto max-h-40 mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sky-200 dark:border-sky-700">
                <th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.model')}</th>
                <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.calls')}</th>
                <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.fallbacks')}</th>
                <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.selectionRuns')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.byProvider)
                .sort(([, left], [, right]) => safeNumber(right.runs) - safeNumber(left.runs))
                .slice(0, 5)
                .map(([provider, stats]) => (
                  <tr key={provider} className="border-b border-sky-100 dark:border-sky-800">
                    <td className="py-2 px-2 font-mono text-xs">{provider}</td>
                    <td className="py-2 px-2 text-right font-semibold">{safeNumber(stats.runs)}</td>
                    <td className="py-2 px-2 text-right opacity-70">{safeNumber(stats.fallbackRuns)}</td>
                    <td className="py-2 px-2 text-right opacity-70">{safeNumber(stats.selectionRuns)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {metrics.recent && metrics.recent.length > 0 && (
        <div>
          <p className="text-xs font-semibold opacity-70 mb-2">{t('metrics.aiModifyRecent')}</p>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {metrics.recent.slice().reverse().map((entry, index) => (
              <div key={`${entry.timestamp || 'entry'}-${index}`} className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{entry.provider || 'unknown'}</span>
                  <span className="opacity-60">{entry.timestamp ? formatDateTime(entry.timestamp) : 'N/A'}</span>
                </div>
                <div className="mt-1 opacity-80">
                  {entry.event || 'run'} | {t('metrics.successFailures')}: {safeNumber(entry.successfulRuns)} / {safeNumber(entry.failedRuns)}
                </div>
                <div className="mt-1 opacity-70">
                  {t('metrics.fallbacks')}: {safeNumber(entry.fallbackRuns)} | {t('metrics.selectionRuns')}: {safeNumber(entry.selectionRuns)}
                  {entry.source ? ` | ${t('metrics.source')}: ${entry.source}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
