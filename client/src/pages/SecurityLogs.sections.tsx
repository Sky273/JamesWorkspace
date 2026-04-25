import { motion } from 'framer-motion';
import { ClipboardDocumentListIcon, CommandLineIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import Pagination from '../components/Pagination';
import ResponsivePageTabs from '../components/page/ResponsivePageTabs';
import Switch from '../components/ui/Switch';
import type {
  ObservabilityCheckSummary,
  ObservabilityHealthResponse,
  ObservabilityOperationsMetrics,
  SecurityLogEntry,
  SecurityLogFilters,
  SecurityLogFilterOptions,
  SecurityLogStats,
  SecurityLogsTab,
} from './SecurityLogs.types';
import {
  formatSecurityTimestamp,
  getSecurityLevelColor,
  getSecurityLevelIcon,
  getSecuritySourceBadgeClass,
  getSecurityStatusCodeClass,
} from './SecurityLogs.utils';

function formatObservabilityTimestamp(timestamp?: string): string {
  if (!timestamp) {
    return '-';
  }

  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}

function formatMetricValue(value?: number): string {
  return new Intl.NumberFormat('fr-FR').format(value ?? 0);
}

function getObservabilityStatusClass(status?: string): string {
  switch ((status || '').toLowerCase()) {
    case 'ok':
    case 'healthy':
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'degraded':
    case 'slow':
    case 'rejected':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'error':
    case 'failed':
    case 'unhealthy':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

function getMainFlowStatus(successes?: number, failures?: number): string {
  if ((failures ?? 0) > 0) {
    return 'degraded';
  }

  if ((successes ?? 0) > 0) {
    return 'completed';
  }

  return 'idle';
}

function getRecentObservabilityItems(health: ObservabilityHealthResponse | null): Array<{
  id: string;
  label: string;
  summary: ObservabilityCheckSummary;
}> {
  const items = [
    { id: 'export', label: 'Export batch', summary: health?.checks?.recentBatchActivity?.export },
    { id: 'textExtraction', label: 'Extraction/OCR', summary: health?.checks?.recentBatchActivity?.textExtraction },
    { id: 'consent', label: 'Consentement/Purge', summary: health?.checks?.recentConsentActivity?.scheduler },
    { id: 'pipeline', label: 'Pipeline', summary: health?.checks?.recentPipelineActivity?.pipeline },
  ];

  return items.filter((item): item is { id: string; label: string; summary: ObservabilityCheckSummary } => Boolean(item.summary));
}

export function SecurityStatsGrid({
  stats,
  onResetFilters,
  t,
}: {
  stats: SecurityLogStats;
  onResetFilters: () => void;
  t: TFunction;
}): JSX.Element {
  return (
    <div className="mb-2 grid grid-cols-1 gap-4 md:grid-cols-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="cursor-pointer rounded-[1.5rem] border border-gray-200/80 bg-white/80 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:ring-2 hover:ring-gray-300 dark:border-gray-700/80 dark:bg-gray-900/30 dark:hover:ring-gray-600"
        onClick={onResetFilters}
      >
        <div className="text-sm text-gray-600 dark:text-gray-400">{t('security.totalLogs')}</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="rounded-[1.5rem] border border-gray-200/80 bg-white/80 p-4 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/30">
        <div className="text-sm text-gray-600 dark:text-gray-400">{t('security.lastHour')}</div>
        <div className="text-2xl font-bold text-blue-600">{stats.recent.lastHour}</div>
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="rounded-[1.5rem] border border-gray-200/80 bg-white/80 p-4 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/30">
        <div className="text-sm text-gray-600 dark:text-gray-400">{t('security.last24h')}</div>
        <div className="text-2xl font-bold text-green-600">{stats.recent.last24h}</div>
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="rounded-[1.5rem] border border-gray-200/80 bg-white/80 p-4 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/30">
        <div className="text-sm text-gray-600 dark:text-gray-400">{t('security.errors')}</div>
        <div className="text-2xl font-bold text-red-600">{stats.byLevel.ERROR || 0}</div>
      </motion.div>
    </div>
  );
}

export function SecurityTabs({
  activeTab,
  onTabChange,
  t,
}: {
  activeTab: SecurityLogsTab;
  onTabChange: (tab: SecurityLogsTab) => void;
  t: TFunction;
}): JSX.Element {
  return (
    <ResponsivePageTabs
      label={t('security.sections.title', { defaultValue: 'Sections' })}
      minItemWidthRem={11}
      onChange={onTabChange}
      options={[
        { value: 'logs', label: t('security.tabs.logs', { defaultValue: 'Logs' }), icon: ClipboardDocumentListIcon },
        { value: 'observability', label: t('security.tabs.observability', { defaultValue: 'Observabilité' }), icon: CommandLineIcon },
      ]}
      value={activeTab}
    />
  );
}

interface FiltersBarProps {
  autoRefresh: boolean;
  fetchLogs: () => Promise<void>;
  fetchStats: () => Promise<void>;
  filters: SecurityLogFilters;
  filterOptions: SecurityLogFilterOptions;
  onAutoRefreshChange: (enabled: boolean) => void;
  onClearFilters: () => void;
  onFilterChange: (next: Partial<SecurityLogFilters>) => void;
  setLoading: (value: boolean) => void;
  t: TFunction;
}

export function SecurityFiltersBar({
  autoRefresh,
  fetchLogs,
  fetchStats,
  filters,
  filterOptions,
  onAutoRefreshChange,
  onClearFilters,
  onFilterChange,
  setLoading,
  t,
}: FiltersBarProps): JSX.Element {
  return (
    <div className="mb-6 rounded-[1.75rem] border border-gray-200/80 bg-white/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/30">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('security.filters.level')}</label>
          <select value={filters.level} onChange={(e) => onFilterChange({ level: e.target.value })} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
            <option value="">{t('security.filters.all')}</option>
            {filterOptions.levels.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('security.filters.event')}</label>
          <select value={filters.event} onChange={(e) => onFilterChange({ event: e.target.value })} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
            <option value="">{t('security.filters.all')}</option>
            {filterOptions.events.map((event) => (
              <option key={event} value={event}>{event}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('security.filters.source')}</label>
          <select value={filters.source} onChange={(e) => onFilterChange({ source: e.target.value })} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
            <option value="">{t('security.filters.allSources')}</option>
            {filterOptions.sources.map((source) => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Switch
              checked={autoRefresh}
              onChange={onAutoRefreshChange}
              label={t('security.autoRefresh')}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('security.autoRefresh')}</span>
          </div>
          <button
            onClick={async () => {
              setLoading(true);
              await Promise.all([fetchLogs(), fetchStats()]);
              setLoading(false);
            }}
            className="cv-gradient-button inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-semibold"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {t('security.refresh')}
          </button>
          {(filters.level || filters.event || filters.source) && (
            <button
              onClick={onClearFilters}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              title={t('common.resetFilters')}
            >
              <XMarkIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t('common.resetFilters')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SecurityLogsTable({ logs, t }: { logs: SecurityLogEntry[]; t: TFunction }): JSX.Element {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-gray-200/80 bg-white/80 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/30">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">{t('security.table.timestamp')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">{t('security.table.source')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">{t('security.table.level')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">{t('security.table.event')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">{t('security.table.user')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">{t('security.table.customer')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">{t('security.table.ip')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">{t('security.table.action')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">{t('security.table.status')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">{t('security.table.message')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            {logs.map((log, index) => (
              <motion.tr key={index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.02 }} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{formatSecurityTimestamp(log.timestamp)}</td>
                <td className="whitespace-nowrap px-4 py-3"><span className={`rounded px-2 py-1 text-xs font-semibold ${getSecuritySourceBadgeClass(log.source)}`}>{log.source === 'security' ? t('security.badges.security') : t('security.badges.proxy')}</span></td>
                <td className="whitespace-nowrap px-4 py-3"><div className="flex items-center space-x-2">{getSecurityLevelIcon(log.level)}<span className={`rounded px-2 py-1 text-xs font-semibold ${getSecurityLevelColor(log.level)}`}>{log.level}</span></div></td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{log.event}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-300"><div><div className="font-medium">{log.email || '-'}</div>{log.role && <div className="text-xs text-gray-500 dark:text-gray-400">{log.role}</div>}</div></td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{log.customer || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{log.ip}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-300"><div>{log.action && <div className="font-medium">{log.action}</div>}{log.method && log.endpoint && <div className="text-xs text-gray-500 dark:text-gray-400">{log.method} {log.endpoint}</div>}{log.resourceType && log.resourceId && <div className="text-xs text-gray-500 dark:text-gray-400">{log.resourceType}: {log.resourceId.substring(0, 8)}...</div>}</div></td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">{log.statusCode && <span className={`rounded px-2 py-1 text-xs font-semibold ${getSecurityStatusCodeClass(log.statusCode)}`}>{log.statusCode}</span>}</td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">
                  <div>
                    <div>{log.message}</div>
                    {log.duration && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('security.table.duration')}: {log.duration}ms</div>}
                    {typeof log.stack === 'string' && log.stack.trim().length > 0 && (
                      <details className="mt-3 rounded-2xl border border-rose-200/70 bg-rose-50/70 p-3 dark:border-rose-900/60 dark:bg-rose-950/20">
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">
                          {t('security.table.stackTrace', { defaultValue: 'Stacktrace' })}
                        </summary>
                        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950/90 p-3 text-xs leading-6 text-slate-100">
                          {log.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {logs.length === 0 && <div className="py-12 text-center text-gray-500 dark:text-gray-400">{t('security.noLogs')}</div>}
    </div>
  );
}

export function SecurityLogsPagination({
  currentPage,
  loading,
  onPageChange,
  pageSize,
  t,
  totalCount,
  totalPages,
}: {
  currentPage: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  pageSize: number;
  t: TFunction;
  totalCount: number;
  totalPages: number;
}): JSX.Element {
  return (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
      pageSize={pageSize}
      onPageChange={onPageChange}
      loading={loading}
      itemName={t('security.logs')}
    />
  );
}

export function ObservabilityOverview({
  health,
  loading,
  operationsMetrics,
  onRefresh,
  onCopy,
  t,
}: {
  health: ObservabilityHealthResponse | null;
  loading: boolean;
  operationsMetrics: ObservabilityOperationsMetrics | null;
  onRefresh: () => void;
  onCopy: () => void;
  t: TFunction;
}): JSX.Element {
  const mainFlowCards = [
    {
      id: 'import',
      step: '01',
      title: t('security.observability.mainFlow.import', { defaultValue: 'Import CV' }),
      status: getMainFlowStatus(
        operationsMetrics?.operations?.batchImports?.resumeRecordsCreated,
        operationsMetrics?.operations?.batchImports?.failedRuns,
      ),
      metrics: [
        { label: t('security.observability.mainFlow.totalFiles', { defaultValue: 'Fichiers reçus' }), value: formatMetricValue(operationsMetrics?.operations?.batchImports?.runs) },
        { label: t('security.observability.mainFlow.successful', { defaultValue: 'Imports réussis' }), value: formatMetricValue(operationsMetrics?.operations?.batchImports?.resumeRecordsCreated) },
        { label: t('security.observability.mainFlow.failed', { defaultValue: 'Imports en échec' }), value: formatMetricValue(operationsMetrics?.operations?.batchImports?.failedRuns) },
      ],
    },
    {
      id: 'analysis',
      step: '02',
      title: t('security.observability.mainFlow.analysis', { defaultValue: 'Analyse' }),
      status: getMainFlowStatus(
        operationsMetrics?.operations?.batchImports?.analysisRuns,
        operationsMetrics?.operations?.batchImports?.textExtractionFailures,
      ),
      metrics: [
        { label: t('security.observability.mainFlow.analysisRuns', { defaultValue: 'Analyses lancées' }), value: formatMetricValue(operationsMetrics?.operations?.batchImports?.analysisRuns) },
        { label: t('security.observability.mainFlow.textExtractionRuns', { defaultValue: 'Extractions de texte' }), value: formatMetricValue(operationsMetrics?.operations?.batchImports?.textExtractionRuns) },
        { label: t('security.observability.mainFlow.textExtractionFailures', { defaultValue: "Échecs d'extraction" }), value: formatMetricValue(operationsMetrics?.operations?.batchImports?.textExtractionFailures) },
      ],
    },
    {
      id: 'improvement',
      step: '03',
      title: t('security.observability.mainFlow.improvement', { defaultValue: 'Amélioration' }),
      status: getMainFlowStatus(
        operationsMetrics?.operations?.improvement?.successfulRuns,
        operationsMetrics?.operations?.improvement?.failedRuns,
      ),
      metrics: [
        { label: t('security.observability.mainFlow.improvementRuns', { defaultValue: 'Améliorations lancées' }), value: formatMetricValue(operationsMetrics?.operations?.improvement?.runs) },
        { label: t('security.observability.mainFlow.successful', { defaultValue: 'Imports réussis' }), value: formatMetricValue(operationsMetrics?.operations?.improvement?.successfulRuns) },
        { label: t('security.observability.mainFlow.failed', { defaultValue: 'Imports en échec' }), value: formatMetricValue(operationsMetrics?.operations?.improvement?.failedRuns) },
      ],
    },
    {
      id: 'export',
      step: '04',
      title: t('security.observability.mainFlow.export', { defaultValue: 'Export' }),
      status: getMainFlowStatus(
        operationsMetrics?.operations?.batchExports?.successfulRuns,
        operationsMetrics?.operations?.batchExports?.failedRuns,
      ),
      metrics: [
        { label: t('security.observability.mainFlow.exportRuns', { defaultValue: 'Exports lancés' }), value: formatMetricValue(operationsMetrics?.operations?.batchExports?.runs) },
        { label: t('security.observability.mainFlow.generatedFiles', { defaultValue: 'Fichiers générés' }), value: formatMetricValue(operationsMetrics?.operations?.batchExports?.generatedFiles) },
        { label: t('security.observability.mainFlow.failedFiles', { defaultValue: 'Fichiers en échec' }), value: formatMetricValue(operationsMetrics?.operations?.batchExports?.failedFiles) },
      ],
    },
  ];

  const statusCards = [
    {
      label: t('security.observability.overall', { defaultValue: 'Statut global' }),
      value: health?.status || '-',
      extra: health?.responseTime || '-',
      status: health?.status,
    },
    {
      label: t('security.observability.database', { defaultValue: 'Base de données' }),
      value: String(health?.checks?.database?.status || '-'),
      extra: String(health?.checks?.database?.message || '-'),
      status: health?.checks?.database?.status,
    },
    {
      label: t('security.observability.batchWorker', { defaultValue: 'Worker batch' }),
      value: String(health?.checks?.batchWorker?.status || '-'),
      extra: `active=${String(health?.checks?.batchWorker?.activeProcessingCount ?? 0)}`,
      status: health?.checks?.batchWorker?.status,
    },
    {
      label: t('security.observability.ocr', { defaultValue: 'OCR / Extraction' }),
      value: String(health?.checks?.ocr?.status || '-'),
      extra: String(health?.checks?.ocr?.preferredEngine || health?.checks?.ocr?.message || '-'),
      status: health?.checks?.ocr?.status,
    },
  ];

  const detailCards = [
    { id: 'export', title: 'Export batch', summary: health?.checks?.recentBatchActivity?.export },
    { id: 'textExtraction', title: 'Extraction / OCR', summary: health?.checks?.recentBatchActivity?.textExtraction },
    { id: 'consent', title: 'Consentement / Purge', summary: health?.checks?.recentConsentActivity?.scheduler },
    { id: 'pipeline', title: 'Pipeline', summary: health?.checks?.recentPipelineActivity?.pipeline },
  ];

  const recentItems = getRecentObservabilityItems(health);

  return (
    <div className="space-y-6">
      <div className="rounded-[1.75rem] border border-gray-200/80 bg-white/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('security.observability.title', { defaultValue: 'Observabilité' })}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {t('security.observability.subtitle', { defaultValue: "Santé runtime, activité récente et diagnostics d'exploitation." })}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onCopy} className="cv-ghost-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium">
              {t('security.observability.copy', { defaultValue: 'Copier le diagnostic' })}
            </button>
            <button type="button" onClick={onRefresh} className="cv-gradient-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold">
              {loading ? t('security.refreshing', { defaultValue: 'Actualisation...' }) : t('security.refresh', { defaultValue: 'Rafraîchir' })}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-gray-200/80 bg-white/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/30">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t('security.observability.mainFlow.title', { defaultValue: 'Flux principal' })}
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('security.observability.mainFlow.subtitle', { defaultValue: "Import de CV, analyse, amélioration et export." })}
          </p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
          {mainFlowCards.map((card) => (
            <div key={card.id} className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-700/80 dark:bg-slate-900/40">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold tracking-[0.18em] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {card.step}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getObservabilityStatusClass(card.status)}`}>
                  {card.status}
                </span>
              </div>
              <div className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">{card.title}</div>
              <div className="mt-4 space-y-2">
                {card.metrics.map((metric) => (
                  <div key={metric.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{metric.label}</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{metric.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statusCards.map((card) => (
          <div key={card.label} className="rounded-[1.5rem] border border-gray-200/80 bg-white/80 p-4 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/30">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">{card.label}</div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getObservabilityStatusClass(card.status)}`}>{card.value}</span>
            </div>
            <div className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">{card.extra}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,1.8fr]">
        <div className="rounded-[1.75rem] border border-gray-200/80 bg-white/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/30">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t('security.observability.activity', { defaultValue: 'Activité récente' })}
          </h3>
          <div className="mt-4 space-y-3">
            {recentItems.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('security.observability.noActivity', { defaultValue: 'Aucune activité récente disponible.' })}
              </p>
            )}
            {recentItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200/80 px-4 py-3 dark:border-slate-700/80">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{item.label}</div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getObservabilityStatusClass(item.summary.status)}`}>
                    {String(item.summary.status || '-')}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {String(item.summary.operation || '-')} · {formatObservabilityTimestamp(item.summary.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {detailCards.map((card) => (
            <div key={card.id} className="rounded-[1.75rem] border border-gray-200/80 bg-white/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/30">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{card.title}</h3>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getObservabilityStatusClass(card.summary?.status)}`}>
                  {String(card.summary?.status || '-')}
                </span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                {card.summary ? Object.entries(card.summary).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-4 border-b border-slate-100 py-1 last:border-b-0 dark:border-slate-800">
                    <span className="text-gray-500 dark:text-gray-400">{key}</span>
                    <span className="max-w-[60%] break-words text-right">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                  </div>
                )) : (
                  <p className="text-gray-500 dark:text-gray-400">
                    {t('security.observability.noData', { defaultValue: 'Aucune donnée disponible.' })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
