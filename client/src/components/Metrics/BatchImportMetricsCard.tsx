import { motion } from 'framer-motion';
import { ArrowDownTrayIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { formatDateTime } from '../../utils/dateFormatter';

interface BatchImportRecentEntry {
  timestamp?: string;
  event?: string;
  mimeType?: string;
  fileSize?: number;
  extractedChars?: number;
  durationMs?: number;
  successfulRuns?: number;
  failedRuns?: number;
  pendingNameRuns?: number;
  stage?: string | null;
  error?: string;
}

interface BatchImportMetrics {
  runs?: number;
  successfulRuns?: number;
  failedRuns?: number;
  pendingNameRuns?: number;
  improvementRequestedRuns?: number;
  resumeRecordsCreated?: number;
  textExtractionRuns?: number;
  textExtractionFailures?: number;
  analysisRuns?: number;
  totalInputBytes?: number;
  totalExtractedChars?: number;
  totalDurationMs?: number;
  byMimeType?: Record<string, number>;
  stageFailures?: Record<string, number>;
  recent?: BatchImportRecentEntry[];
}

interface BatchImportMetricsCardProps {
  metrics: BatchImportMetrics | null | undefined;
  successRatio: number | null;
  t: any;
  safeNumber: (value: unknown, defaultValue?: number) => number;
  formatNumber: (value?: number) => string;
  formatBytes: (value?: number) => string;
}

export default function BatchImportMetricsCard({
  metrics,
  successRatio,
  t,
  safeNumber,
  formatNumber,
  formatBytes
}: BatchImportMetricsCardProps): JSX.Element | null {
  if (!metrics) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.19 }}
      className="rounded-xl border bg-amber-50 text-amber-700 border-amber-200 dark:bg-gray-800 dark:text-amber-300 dark:border-amber-700 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium opacity-80">{t('metrics.batchImportPipeline')}</p>
          <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(metrics.runs))}</p>
          <p className="text-xs mt-1 opacity-60">{t('metrics.batchImportSubtitle')}</p>
        </div>
        <ArrowDownTrayIcon className="w-10 h-10 opacity-50" />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.successFailures')}</p>
          <p className="font-semibold">{safeNumber(metrics.successfulRuns)} / {safeNumber(metrics.failedRuns)}</p>
        </div>
        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.successRatio')}</p>
          <p className="font-semibold">{successRatio !== null ? `${(successRatio * 100).toFixed(1)}%` : 'N/A'}</p>
        </div>
        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.pendingName')}</p>
          <p className="font-semibold">{safeNumber(metrics.pendingNameRuns)}</p>
        </div>
        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.improvementRequested')}</p>
          <p className="font-semibold">{safeNumber(metrics.improvementRequestedRuns)}</p>
        </div>
        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.textExtraction')}</p>
          <p className="font-semibold">{safeNumber(metrics.textExtractionRuns)} / {safeNumber(metrics.textExtractionFailures)}</p>
        </div>
        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.analysisRuns')}</p>
          <p className="font-semibold">{safeNumber(metrics.analysisRuns)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.inputBytes')}</p>
          <p className="font-semibold">{formatBytes(safeNumber(metrics.totalInputBytes))}</p>
        </div>
        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3">
          <p className="opacity-70">{t('metrics.extractedChars')}</p>
          <p className="font-semibold">{formatNumber(safeNumber(metrics.totalExtractedChars))}</p>
        </div>
      </div>
      {metrics.stageFailures && Object.keys(metrics.stageFailures).length > 0 && (
        <div className="overflow-x-auto max-h-32 mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-amber-200 dark:border-amber-700">
                <th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.stage')}</th>
                <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.failures')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.stageFailures)
                .sort(([, left], [, right]) => safeNumber(right) - safeNumber(left))
                .map(([stage, count]) => (
                  <tr key={stage} className="border-b border-amber-100 dark:border-amber-800">
                    <td className="py-2 px-2 font-mono text-xs">{stage}</td>
                    <td className="py-2 px-2 text-right font-semibold">{safeNumber(count)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {metrics.recent && metrics.recent.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold opacity-70">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <span>{t('metrics.recentActivity')}</span>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {metrics.recent.slice().reverse().map((entry, index) => (
              <div key={`${entry.timestamp || 'entry'}-${index}`} className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{entry.event || 'run'}{entry.stage ? ` | ${entry.stage}` : ''}</span>
                  <span className="opacity-60">{entry.timestamp ? formatDateTime(entry.timestamp) : 'N/A'}</span>
                </div>
                <div className="mt-1 opacity-80">
                  {entry.mimeType || 'unknown'} | {t('metrics.duration')}: {safeNumber(entry.durationMs)}ms
                  {entry.extractedChars ? ` | ${t('metrics.extractedChars')}: ${formatNumber(safeNumber(entry.extractedChars))}` : ''}
                </div>
                <div className="mt-1 opacity-70">
                  {t('metrics.successFailures')}: {safeNumber(entry.successfulRuns)} / {safeNumber(entry.failedRuns)}
                  {entry.error ? ` | ${t('common.error')}: ${entry.error}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
