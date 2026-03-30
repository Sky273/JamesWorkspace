import { motion } from 'framer-motion';
import { ChartBarIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface HttpTrafficCardsProps {
  metrics: {
    requests?: {
      total?: number;
      byMethod?: Record<string, number>;
      byStatus?: Record<string, number>;
      topEndpoints?: Array<{ endpoint?: string; path?: string; count?: number }>;
    };
    llm?: {
      requests?: number;
      totalTokens?: number;
      estimatedCost?: number;
      byProvider?: Record<string, { requests?: number } | number>;
    };
  } | null;
  ProgressBar: any;
  t: any;
  safeNumber: (value: unknown, defaultValue?: number) => number;
  formatNumber: (value?: number) => string;
}

export default function HttpTrafficCards({
  metrics,
  ProgressBar,
  t,
  safeNumber,
  formatNumber
}: HttpTrafficCardsProps): JSX.Element {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border bg-blue-50 text-blue-600 border-blue-200 dark:bg-gray-800 dark:text-blue-400 dark:border-blue-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium opacity-80">{t('metrics.httpMethods')}</p>
              <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(metrics?.requests?.total))}</p>
              <p className="text-xs mt-1 opacity-60">{t('metrics.totalApiRequests')}</p>
            </div>
            <ChartBarIcon className="w-10 h-10 opacity-50" />
          </div>
          <div className="space-y-2">
            {metrics?.requests?.byMethod && Object.entries(metrics.requests.byMethod).map(([method, count]) => (
              <ProgressBar key={method} label={method} value={safeNumber(count)} max={safeNumber(metrics.requests?.total, 1)} color={method === 'GET' ? 'blue' : method === 'POST' ? 'green' : method === 'PUT' ? 'yellow' : 'red'} />
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-xl border bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-gray-800 dark:text-yellow-400 dark:border-yellow-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium opacity-80">{t('metrics.httpStatus')}</p>
              <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(metrics?.requests?.byStatus?.['2xx']))}</p>
              <p className="text-xs mt-1 opacity-60">{t('metrics.successfulRequests')}</p>
            </div>
            <ExclamationTriangleIcon className="w-10 h-10 opacity-50" />
          </div>
          <div className="space-y-2">
            {metrics?.requests?.byStatus && Object.entries(metrics.requests.byStatus).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => (
              <ProgressBar key={status} label={status} value={safeNumber(count)} max={safeNumber(metrics.requests?.total, 1)} color={status.startsWith('2') ? 'green' : status.startsWith('3') ? 'blue' : status.startsWith('4') ? 'yellow' : 'red'} />
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-xl border bg-purple-50 text-purple-600 border-purple-200 dark:bg-gray-800 dark:text-purple-400 dark:border-purple-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium opacity-80">{t('metrics.llmUsage')}</p>
              <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(metrics?.llm?.requests))}</p>
              <p className="text-xs mt-1 opacity-60">{t('metrics.llmCalls')}</p>
            </div>
            <ChartBarIcon className="w-10 h-10 opacity-50" />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-3"><p className="opacity-70">{t('metrics.tokensConsumed')}</p><p className="font-semibold">{formatNumber(safeNumber(metrics?.llm?.totalTokens))}</p></div>
            <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-3"><p className="opacity-70">{t('metrics.estimatedCost')}</p><p className="font-semibold">${parseFloat(String(metrics?.llm?.estimatedCost || 0)).toFixed(2)}</p></div>
          </div>
          {metrics?.llm?.byProvider && Object.keys(metrics.llm.byProvider).length > 0 && (
            <div className="overflow-x-auto max-h-48">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-purple-200 dark:border-purple-700"><th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.model')}</th><th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.calls')}</th></tr></thead>
                <tbody>
                  {Object.entries(metrics.llm.byProvider)
                    .sort(([, a], [, b]) => {
                      const countA = typeof a === 'object' ? (a.requests || 0) : (a || 0);
                      const countB = typeof b === 'object' ? (b.requests || 0) : (b || 0);
                      return countB - countA;
                    })
                    .map(([model, stats]) => {
                      const count = typeof stats === 'object' ? (stats.requests || 0) : (stats || 0);
                      return (
                        <tr key={model} className="border-b border-purple-100 dark:border-purple-800">
                          <td className="py-2 px-2 font-mono text-xs truncate max-w-[200px]">{model}</td>
                          <td className="py-2 px-2 text-right font-semibold">{formatNumber(count)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="rounded-xl border bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-gray-800 dark:text-cyan-400 dark:border-cyan-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium opacity-80">{t('metrics.topEndpoints')}</p>
              <p className="text-2xl font-bold mt-1">{metrics?.requests?.topEndpoints?.length || 0}</p>
              <p className="text-xs mt-1 opacity-60">{t('metrics.activeEndpoints')}</p>
            </div>
            <ChartBarIcon className="w-10 h-10 opacity-50" />
          </div>
          <div className="overflow-x-auto max-h-48">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-cyan-200 dark:border-cyan-700"><th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.route')}</th><th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.calls')}</th></tr></thead>
              <tbody>
                {metrics?.requests?.topEndpoints?.slice(0, 5).map((endpoint, index) => (
                  <tr key={index} className="border-b border-cyan-100 dark:border-cyan-800">
                    <td className="py-2 px-2 font-mono text-xs truncate max-w-[200px]">{endpoint.endpoint || endpoint.path || 'N/A'}</td>
                    <td className="py-2 px-2 text-right font-semibold">{formatNumber(safeNumber(endpoint.count))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </>
  );
}
