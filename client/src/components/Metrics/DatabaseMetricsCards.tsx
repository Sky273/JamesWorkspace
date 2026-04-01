import { motion } from 'framer-motion';
import { ServerIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

interface DatabaseMetrics {
  database?: { sizePretty?: string };
  tables?: Array<{ name: string; rowCount: number; deadRows: number }>;
  connections?: { total?: number; active?: number; idle?: number };
  queryTime?: string;
}

interface DatabaseMetricsCardsProps {
  metrics: DatabaseMetrics | null | undefined;
  t: TFunction;
  safeNumber: (value: unknown, defaultValue?: number) => number;
  formatNumber: (value?: number) => string;
}

export default function DatabaseMetricsCards({
  metrics,
  t,
  safeNumber,
  formatNumber
}: DatabaseMetricsCardsProps): JSX.Element | null {
  if (!metrics) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border bg-orange-50 text-orange-600 border-orange-200 dark:bg-gray-800 dark:text-orange-400 dark:border-orange-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium opacity-80">{t('metrics.database')}</p>
            <p className="text-2xl font-bold mt-1">{metrics.database?.sizePretty || 'N/A'}</p>
            <p className="text-xs mt-1 opacity-60">{t('metrics.dbSize')}</p>
          </div>
          <TableCellsIcon className="w-10 h-10 opacity-50" />
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm mb-4">
          <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.connections')}</p>
            <p className="font-semibold">{safeNumber(metrics.connections?.total)}</p>
          </div>
          <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.active')}</p>
            <p className="font-semibold">{safeNumber(metrics.connections?.active)}</p>
          </div>
          <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-3">
            <p className="opacity-70">{t('metrics.idle')}</p>
            <p className="font-semibold">{safeNumber(metrics.connections?.idle)}</p>
          </div>
        </div>
        <p className="text-xs opacity-60">{t('metrics.queryTime')}: {metrics.queryTime || 'N/A'}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="rounded-xl border bg-orange-50 text-orange-600 border-orange-200 dark:bg-gray-800 dark:text-orange-400 dark:border-orange-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium opacity-80">{t('metrics.tables')}</p>
            <p className="text-2xl font-bold mt-1">{metrics.tables?.length || 0}</p>
            <p className="text-xs mt-1 opacity-60">{t('metrics.topTables')}</p>
          </div>
          <ServerIcon className="w-10 h-10 opacity-50" />
        </div>
        <div className="overflow-x-auto max-h-48">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-orange-200 dark:border-orange-700">
                <th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.tableName')}</th>
                <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.rows')}</th>
                <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.deadRows')}</th>
              </tr>
            </thead>
            <tbody>
              {metrics.tables?.slice(0, 8).map((table, index) => (
                <tr key={index} className="border-b border-orange-100 dark:border-orange-800">
                  <td className="py-2 px-2 font-mono text-xs truncate max-w-[120px]">{table.name}</td>
                  <td className="py-2 px-2 text-right font-semibold">{formatNumber(table.rowCount)}</td>
                  <td className="py-2 px-2 text-right opacity-70">{formatNumber(table.deadRows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
