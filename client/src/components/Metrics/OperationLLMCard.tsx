import { motion } from 'framer-motion';
import { ArrowDownTrayIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { formatDateTime } from '../../utils/dateFormatter';

interface OperationRecentEntry {
  timestamp?: string;
  provider?: string;
  event?: string;
  matchRuns?: number;
  successfulRuns?: number;
  failedRuns?: number;
  fallbackRuns?: number;
  structuredRuns?: number;
  inputChars?: number;
  outputChars?: number;
  source?: string;
}

interface OperationMetrics {
  runs?: number;
  matchRuns?: number;
  successfulRuns?: number;
  failedRuns?: number;
  fallbackRuns?: number;
  structuredRuns?: number;
  inputChars?: number;
  outputChars?: number;
  recent?: OperationRecentEntry[];
  byProvider?: Record<string, {
    runs?: number;
    matchRuns?: number;
    successfulRuns?: number;
    failedRuns?: number;
    fallbackRuns?: number;
    structuredRuns?: number;
    inputChars?: number;
    outputChars?: number;
  }>;
}

interface OperationLLMCardProps {
  metrics: OperationMetrics | null | undefined;
  successRatio: number | null;
  mode: 'improvement' | 'adaptation';
  t: any;
  safeNumber: (value: unknown, defaultValue?: number) => number;
  formatNumber: (value?: number) => string;
}

export default function OperationLLMCard({
  metrics,
  successRatio,
  mode,
  t,
  safeNumber,
  formatNumber
}: OperationLLMCardProps): JSX.Element | null {
  if (!metrics) return null;

  const isAdaptation = mode === 'adaptation';
  const accentClasses = isAdaptation
    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:text-rose-400 dark:border-rose-700'
    : 'bg-amber-50 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-700';
  const tileClasses = isAdaptation ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-amber-100 dark:bg-amber-900/30';
  const tableBorder = isAdaptation ? 'border-rose-200 dark:border-rose-700' : 'border-amber-200 dark:border-amber-700';
  const rowBorder = isAdaptation ? 'border-rose-100 dark:border-rose-800' : 'border-amber-100 dark:border-amber-800';
  const recentTile = isAdaptation ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-amber-100 dark:bg-amber-900/30';
  const titleKey = isAdaptation ? 'metrics.resumeAdaptationTitle' : 'metrics.resumeImprovementTitle';
  const subtitleKey = isAdaptation ? 'metrics.resumeAdaptationSubtitle' : 'metrics.resumeImprovementSubtitle';
  const recentKey = isAdaptation ? 'metrics.resumeAdaptationRecent' : 'metrics.resumeImprovementRecent';
  const icon = isAdaptation ? SparklesIcon : ArrowDownTrayIcon;
  const delay = isAdaptation ? 0.205 : 0.2;
  const Icon = icon;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className={`rounded-xl border dark:bg-gray-800 p-6 ${accentClasses}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium opacity-80">{t(titleKey)}</p>
          <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(metrics.runs))}</p>
          <p className="text-xs mt-1 opacity-60">{t(subtitleKey)}</p>
        </div>
        <Icon className="w-10 h-10 opacity-50" />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div className={`${tileClasses} rounded-lg p-3`}>
          <p className="opacity-70">{t('metrics.successFailures')}</p>
          <p className="font-semibold">{safeNumber(metrics.successfulRuns)} / {safeNumber(metrics.failedRuns)}</p>
        </div>
        {isAdaptation ? (
          <div className={`${tileClasses} rounded-lg p-3`}>
            <p className="opacity-70">{t('metrics.matchRuns')}</p>
            <p className="font-semibold">{safeNumber(metrics.matchRuns)}</p>
          </div>
        ) : (
          <div className={`${tileClasses} rounded-lg p-3`}>
            <p className="opacity-70">{t('metrics.structuredFallback')}</p>
            <p className="font-semibold">{safeNumber(metrics.structuredRuns)} / {safeNumber(metrics.fallbackRuns)}</p>
          </div>
        )}
        {isAdaptation && (
          <div className={`${tileClasses} rounded-lg p-3`}>
            <p className="opacity-70">{t('metrics.structuredFallback')}</p>
            <p className="font-semibold">{safeNumber(metrics.structuredRuns)} / {safeNumber(metrics.fallbackRuns)}</p>
          </div>
        )}
        <div className={`${tileClasses} rounded-lg p-3`}>
          <p className="opacity-70">{t('metrics.successRatio')}</p>
          <p className="font-semibold">{successRatio !== null ? `${(successRatio * 100).toFixed(1)}%` : 'N/A'}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div className={`${tileClasses} rounded-lg p-3`}>
          <p className="opacity-70">{t('metrics.inputChars')}</p>
          <p className="font-semibold">{formatNumber(safeNumber(metrics.inputChars))}</p>
        </div>
        <div className={`${tileClasses} rounded-lg p-3`}>
          <p className="opacity-70">{t('metrics.outputChars')}</p>
          <p className="font-semibold">{formatNumber(safeNumber(metrics.outputChars))}</p>
        </div>
      </div>
      {metrics.byProvider && Object.keys(metrics.byProvider).length > 0 && (
        <div className="overflow-x-auto max-h-40 mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${tableBorder}`}>
                <th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.model')}</th>
                <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.calls')}</th>
                {isAdaptation ? (
                  <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.matchRuns')}</th>
                ) : (
                  <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.successes')}</th>
                )}
                <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.fallbacks')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.byProvider)
                .sort(([, left], [, right]) => safeNumber(right.runs) - safeNumber(left.runs))
                .slice(0, 5)
                .map(([provider, stats]) => (
                  <tr key={provider} className={`border-b ${rowBorder}`}>
                    <td className="py-2 px-2 font-mono text-xs">{provider}</td>
                    <td className="py-2 px-2 text-right font-semibold">{safeNumber(stats.runs)}</td>
                    {isAdaptation ? (
                      <td className="py-2 px-2 text-right opacity-70">{safeNumber(stats.matchRuns)}</td>
                    ) : (
                      <td className="py-2 px-2 text-right opacity-70">{safeNumber(stats.successfulRuns)}</td>
                    )}
                    <td className="py-2 px-2 text-right opacity-70">{safeNumber(stats.fallbackRuns)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {metrics.recent && metrics.recent.length > 0 && (
        <div>
          <p className="text-xs font-semibold opacity-70 mb-2">{t(recentKey)}</p>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {metrics.recent.slice().reverse().map((entry, index) => (
              <div key={`${entry.timestamp || 'entry'}-${index}`} className={`${recentTile} rounded-lg p-2 text-xs`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{entry.provider || 'unknown'}</span>
                  <span className="opacity-60">{entry.timestamp ? formatDateTime(entry.timestamp) : 'N/A'}</span>
                </div>
                <div className="mt-1 opacity-80">
                  {entry.event || 'run'} | {t('metrics.successFailures')}: {safeNumber(entry.successfulRuns)} / {safeNumber(entry.failedRuns)}
                  {isAdaptation ? ` | ${t('metrics.matchRuns')}: ${safeNumber(entry.matchRuns)}` : ''}
                </div>
                <div className="mt-1 opacity-70">
                  {t('metrics.structuredFallback')}: {safeNumber(entry.structuredRuns)} / {safeNumber(entry.fallbackRuns)}
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
