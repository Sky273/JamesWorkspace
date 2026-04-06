import type { ChangeEvent, JSX } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import { formatDateTime } from '../utils/dateFormatter';
import PageHeader from '../components/page/PageHeader';
import { StatCard } from './MetricsPage.parts';
import { formatNumber, formatUptime, safeNumber } from './MetricsPage.utils';
import type { Metrics } from './MetricsPage.types';

interface MetricsHeaderProps {
  autoRefresh: boolean;
  lastUpdated: Date | null;
  onAutoRefreshChange: (enabled: boolean) => void;
  onRefresh: () => void;
  onExport: (format: 'json' | 'csv') => void;
  t: (key: string) => string;
}

interface OverviewStatsGridProps {
  metrics: Metrics;
  t: (key: string) => string;
}

export function MetricsLoadingState(): JSX.Element {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

export function MetricsPageHeader({
  autoRefresh,
  lastUpdated,
  onAutoRefreshChange,
  onRefresh,
  onExport,
  t,
}: MetricsHeaderProps): JSX.Element {
  return (
    <div className="mb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <PageHeader title={t('metrics.title')} subtitle={t('metrics.subtitle')} />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onAutoRefreshChange(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            {t('metrics.autoRefresh')}
          </label>
          <button onClick={onRefresh} className="app-button-primary flex items-center gap-2 rounded-2xl px-4 py-2.5">
            <ArrowPathIcon className="w-4 h-4" />
            {t('metrics.refresh')}
          </button>
          <div className="relative group">
            <button className="app-button-secondary flex items-center gap-2 rounded-2xl px-4 py-2.5">
              <ArrowDownTrayIcon className="w-4 h-4" />
              {t('metrics.export')}
            </button>
            <div className="section-shell invisible absolute right-0 z-10 mt-2 w-32 rounded-[1.5rem] opacity-0 transition-all group-hover:visible group-hover:opacity-100">
              <button
                onClick={() => onExport('json')}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg"
              >
                JSON
              </button>
              <button
                onClick={() => onExport('csv')}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg"
              >
                CSV
              </button>
            </div>
          </div>
        </div>
      </div>
      {lastUpdated && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          {t('metrics.lastUpdate')}: {formatDateTime(lastUpdated)}
        </p>
      )}
    </div>
  );
}

export function OverviewStatsGrid({ metrics, t }: OverviewStatsGridProps): JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatCard
        title={t('metrics.uptime')}
        value={formatUptime(safeNumber(metrics.server?.uptimeSeconds))}
        subtitle={`${t('metrics.startedAt')}: ${metrics.server?.startTime ? formatDateTime(metrics.server.startTime) : 'N/A'}`}
        icon={ServerIcon}
        color="green"
      />
      <StatCard
        title={t('metrics.totalRequests')}
        value={formatNumber(safeNumber(metrics.requests?.total))}
        subtitle={`${t('metrics.last24h')}: ${formatNumber(safeNumber(metrics.requests?.last24h))}`}
        icon={ChartBarIcon}
        color="blue"
      />
      <StatCard
        title={t('metrics.avgResponseTime')}
        value={`${safeNumber(metrics.performance?.avgResponseTime).toFixed(0)}ms`}
        subtitle={`Min: ${safeNumber(metrics.performance?.minResponseTime)}ms / Max: ${safeNumber(metrics.performance?.maxResponseTime)}ms`}
        icon={ClockIcon}
        color="purple"
      />
      <StatCard
        title={t('metrics.errorRate')}
        value={`${(safeNumber(metrics.errors?.rate) * 100).toFixed(2)}%`}
        subtitle={`${t('metrics.totalErrors')}: ${safeNumber(metrics.errors?.total)}`}
        icon={ExclamationTriangleIcon}
        color={safeNumber(metrics.errors?.rate) > 0.05 ? 'red' : 'green'}
      />
    </div>
  );
}

export function OperationsUnavailableBanner({
  error,
  t,
}: {
  error: string;
  t: (key: string) => string;
}): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.185 }}
      className="rounded-xl border bg-amber-50 text-amber-700 border-amber-200 dark:bg-gray-800 dark:text-amber-400 dark:border-amber-700 p-6 mb-8"
    >
      <div className="flex items-center gap-3 mb-2">
        <ExclamationTriangleIcon className="w-6 h-6 opacity-80" />
        <p className="text-sm font-semibold">{t('metrics.operationsUnavailable')}</p>
      </div>
      <p className="text-sm opacity-80">{error}</p>
      <p className="text-xs opacity-60 mt-2">{t('metrics.operationsHint')}</p>
    </motion.div>
  );
}

export function MetricsEmptyState({
  onRetry,
  t,
}: {
  onRetry: () => void;
  t: (key: string) => string;
}): JSX.Element {
  return (
    <div className="text-center py-12">
      <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <p className="text-gray-500">{t('metrics.error')}</p>
      <button
        onClick={onRetry}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        {t('metrics.retry')}
      </button>
    </div>
  );
}
