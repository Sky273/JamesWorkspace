/**
 * MetricsPage Component
 * TypeScript version
 */

import { useState, useEffect, useCallback, ChangeEvent, ForwardRefExoticComponent, RefAttributes, SVGProps, memo } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { 
  ChartBarIcon, 
  ServerIcon, 
  ClockIcon, 
  CpuChipIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CircleStackIcon,
  SparklesIcon,
  TableCellsIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { fetchWithAuth, createAuthOptions } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';
import { formatDateTime } from '../utils/dateFormatter';

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

// ============================================
// INTERFACES (needed before memoized components)
// ============================================

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: HeroIcon;
  color?: string;
}

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
}

// ============================================
// UTILITY FUNCTIONS (defined outside component to avoid recreation)
// ============================================

const formatUptime = (seconds?: number): string => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(' ');
};

const formatBytes = (bytes?: number): string => {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (isNaN(i) || i < 0) return '0 B';
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatNumber = (num?: number): string => {
  if (!num || isNaN(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const safeNumber = (value: unknown, defaultValue = 0): number => {
  if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) return defaultValue;
  return value;
};

// ============================================
// MEMOIZED SUB-COMPONENTS
// ============================================

const StatCard = memo(({ title, value, subtitle, icon: Icon, color = 'blue' }: StatCardProps): JSX.Element => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    green: 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800',
    red: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    purple: 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800'
  };
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs mt-1 opacity-60">{subtitle}</p>}
        </div>
        <Icon className="w-10 h-10 opacity-50" />
      </div>
    </motion.div>
  );
});
StatCard.displayName = 'StatCard';

const ProgressBar = memo(({ label, value, max, color = 'blue' }: ProgressBarProps): JSX.Element => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const colorClasses: Record<string, string> = { blue: 'bg-blue-500', green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500' };
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-medium">{value} / {max}</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div className={`h-2 rounded-full ${colorClasses[color]} transition-all duration-500`} style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
    </div>
  );
});
ProgressBar.displayName = 'ProgressBar';

interface Metrics {
  server?: { uptimeSeconds?: number; startTime?: string };
  requests?: { 
    total?: number; 
    last24h?: number; 
    byMethod?: Record<string, number>;
    byStatus?: Record<string, number>;
    topEndpoints?: Array<{ endpoint?: string; path?: string; count?: number }>;
  };
  performance?: { avgResponseTime?: number; minResponseTime?: number; maxResponseTime?: number };
  errors?: { rate?: number; total?: number };
  memory?: { heapUsed?: number; heapTotal?: number; rss?: number; external?: number };
  cache?: { hitRate?: number; hits?: number; misses?: number };
  llm?: { 
    requests?: number; 
    totalTokens?: number; 
    estimatedCost?: number;
    byProvider?: Record<string, { requests?: number } | number>;
  };
}

interface DatabaseMetrics {
  database?: { size?: number; sizePretty?: string };
  tables?: Array<{ name: string; rowCount: number; deadRows: number; lastVacuum?: string; lastAnalyze?: string }>;
  connections?: { total?: number; active?: number; idle?: number };
  queryTime?: string;
  timestamp?: string;
}

const MetricsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [dbMetrics, setDbMetrics] = useState<DatabaseMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async (): Promise<void> => {
    try {
      const response = await fetchWithAuth('/api/metrics', createAuthOptions());
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (response.status === 403) toast.error(t('metrics.accessDenied'));
        else if (response.status === 401) toast.error(t('metrics.sessionExpired'));
        else toast.error(`${t('common.error')} ${response.status}: ${errorData.error || t('metrics.error')}`);
        throw new Error(`Failed to fetch metrics: ${response.status}`);
      }
      const data = await response.json();
      setMetrics(data);
      setLastUpdated(new Date());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching metrics:', error);
      }
    }
  };

  const fetchDbMetrics = async (): Promise<void> => {
    try {
      const response = await fetchWithAuth('/api/metrics/database', createAuthOptions());
      if (response.ok) {
        const data = await response.json();
        setDbMetrics(data);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching database metrics:', error);
      }
    }
  };

  const exportMetrics = (format: 'json' | 'csv'): void => {
    if (!metrics) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `metrics-${timestamp}.${format}`;
    
    let content: string;
    let mimeType: string;
    
    if (format === 'json') {
      const exportData = {
        exportedAt: new Date().toISOString(),
        metrics,
        database: dbMetrics
      };
      content = JSON.stringify(exportData, null, 2);
      mimeType = 'application/json';
    } else {
      // CSV format - flatten key metrics
      const rows = [
        ['Metric', 'Value'],
        ['Uptime (seconds)', String(metrics.server?.uptimeSeconds || 0)],
        ['Total Requests', String(metrics.requests?.total || 0)],
        ['Requests Last 24h', String(metrics.requests?.last24h || 0)],
        ['Avg Response Time (ms)', String(metrics.performance?.avgResponseTime || 0)],
        ['Error Rate', String((metrics.errors?.rate || 0) * 100) + '%'],
        ['Total Errors', String(metrics.errors?.total || 0)],
        ['Heap Used (bytes)', String(metrics.memory?.heapUsed || 0)],
        ['Heap Total (bytes)', String(metrics.memory?.heapTotal || 0)],
        ['Cache Hit Rate', String((metrics.cache?.hitRate || 0) * 100) + '%'],
        ['Cache Hits', String(metrics.cache?.hits || 0)],
        ['Cache Misses', String(metrics.cache?.misses || 0)],
        ['LLM Requests', String(metrics.llm?.requests || 0)],
        ['LLM Total Tokens', String(metrics.llm?.totalTokens || 0)],
        ['DB Size', dbMetrics?.database?.sizePretty || 'N/A'],
        ['DB Connections Total', String(dbMetrics?.connections?.total || 0)],
        ['DB Connections Active', String(dbMetrics?.connections?.active || 0)]
      ];
      content = rows.map(row => row.join(',')).join('\n');
      mimeType = 'text/csv';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(t('metrics.exportSuccess', `Métriques exportées (${format.toUpperCase()})`));
  };

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      setLoading(true);
      await Promise.all([fetchMetrics(), fetchDbMetrics()]);
      setLoading(false);
    };
    // Load immediately without delay for faster initial render
    loadData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(async () => {
      await Promise.all([fetchMetrics(), fetchDbMetrics()]);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('metrics.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400">{t('metrics.subtitle')}</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input type="checkbox" checked={autoRefresh} onChange={(e: ChangeEvent<HTMLInputElement>) => setAutoRefresh(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" />
              {t('metrics.autoRefresh')}
            </label>
            <button onClick={fetchMetrics} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <ArrowPathIcon className="w-4 h-4" />
              {t('metrics.refresh')}
            </button>
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                <ArrowDownTrayIcon className="w-4 h-4" />
                {t('metrics.export', 'Export')}
              </button>
              <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button onClick={() => exportMetrics('json')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg">
                  JSON
                </button>
                <button onClick={() => exportMetrics('csv')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg">
                  CSV
                </button>
              </div>
            </div>
          </div>
        </div>
        {lastUpdated && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{t('metrics.lastUpdate')}: {formatDateTime(lastUpdated)}</p>}
      </div>

      {metrics ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard title={t('metrics.uptime')} value={formatUptime(safeNumber(metrics.server?.uptimeSeconds))} subtitle={`${t('metrics.startedAt')}: ${metrics.server?.startTime ? formatDateTime(metrics.server.startTime) : 'N/A'}`} icon={ServerIcon} color="green" />
            <StatCard title={t('metrics.totalRequests')} value={formatNumber(safeNumber(metrics.requests?.total))} subtitle={`${t('metrics.last24h')}: ${formatNumber(safeNumber(metrics.requests?.last24h))}`} icon={ChartBarIcon} color="blue" />
            <StatCard title={t('metrics.avgResponseTime')} value={`${safeNumber(metrics.performance?.avgResponseTime).toFixed(0)}ms`} subtitle={`Min: ${safeNumber(metrics.performance?.minResponseTime)}ms / Max: ${safeNumber(metrics.performance?.maxResponseTime)}ms`} icon={ClockIcon} color="purple" />
            <StatCard title={t('metrics.errorRate')} value={`${(safeNumber(metrics.errors?.rate) * 100).toFixed(2)}%`} subtitle={`${t('metrics.totalErrors')}: ${safeNumber(metrics.errors?.total)}`} icon={ExclamationTriangleIcon} color={safeNumber(metrics.errors?.rate) > 0.05 ? 'red' : 'green'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-indigo-50 text-indigo-600 border-indigo-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium opacity-80">{t('metrics.serverMemory')}</p>
                  <p className="text-2xl font-bold mt-1">{formatBytes(safeNumber(metrics.memory?.heapUsed))}</p>
                  <p className="text-xs mt-1 opacity-60">{t('metrics.heapUsed', { total: formatBytes(safeNumber(metrics.memory?.heapTotal)) })}</p>
                </div>
                <CpuChipIcon className="w-10 h-10 opacity-50" />
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-2 mb-4">
                <div className="h-2 rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${safeNumber(metrics.memory?.heapTotal) > 0 ? (safeNumber(metrics.memory?.heapUsed) / safeNumber(metrics.memory?.heapTotal)) * 100 : 0}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-indigo-100 rounded-lg p-3"><p className="opacity-70">{t('metrics.rss')}</p><p className="font-semibold">{formatBytes(safeNumber(metrics.memory?.rss))}</p></div>
                <div className="bg-indigo-100 rounded-lg p-3"><p className="opacity-70">{t('metrics.external')}</p><p className="font-semibold">{formatBytes(safeNumber(metrics.memory?.external))}</p></div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-green-50 text-green-600 border-green-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium opacity-80">{t('metrics.cachePerformance')}</p>
                  <p className="text-2xl font-bold mt-1">{(safeNumber(metrics.cache?.hitRate) * 100).toFixed(1)}%</p>
                  <p className="text-xs mt-1 opacity-60">{t('metrics.cacheHitRate')}</p>
                </div>
                <CircleStackIcon className="w-10 h-10 opacity-50" />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-green-100 rounded-lg p-3"><p className="opacity-70">{t('metrics.cacheHits')}</p><p className="font-semibold">{formatNumber(safeNumber(metrics.cache?.hits))}</p></div>
                <div className="bg-green-100 rounded-lg p-3"><p className="opacity-70">{t('metrics.cacheMisses')}</p><p className="font-semibold">{formatNumber(safeNumber(metrics.cache?.misses))}</p></div>
              </div>
            </motion.div>
          </div>

          {/* Database Metrics Section */}
          {dbMetrics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border bg-orange-50 text-orange-600 border-orange-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium opacity-80">{t('metrics.database', 'Base de données')}</p>
                    <p className="text-2xl font-bold mt-1">{dbMetrics.database?.sizePretty || 'N/A'}</p>
                    <p className="text-xs mt-1 opacity-60">{t('metrics.dbSize', 'Taille totale')}</p>
                  </div>
                  <TableCellsIcon className="w-10 h-10 opacity-50" />
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                  <div className="bg-orange-100 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.connections', 'Connexions')}</p>
                    <p className="font-semibold">{safeNumber(dbMetrics.connections?.total)}</p>
                  </div>
                  <div className="bg-orange-100 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.active', 'Actives')}</p>
                    <p className="font-semibold">{safeNumber(dbMetrics.connections?.active)}</p>
                  </div>
                  <div className="bg-orange-100 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.idle', 'Inactives')}</p>
                    <p className="font-semibold">{safeNumber(dbMetrics.connections?.idle)}</p>
                  </div>
                </div>
                <p className="text-xs opacity-60">{t('metrics.queryTime', 'Temps de requête')}: {dbMetrics.queryTime || 'N/A'}</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="rounded-xl border bg-orange-50 text-orange-600 border-orange-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium opacity-80">{t('metrics.tables', 'Tables')}</p>
                    <p className="text-2xl font-bold mt-1">{dbMetrics.tables?.length || 0}</p>
                    <p className="text-xs mt-1 opacity-60">{t('metrics.topTables', 'Tables principales')}</p>
                  </div>
                  <ServerIcon className="w-10 h-10 opacity-50" />
                </div>
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-orange-200">
                        <th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.tableName', 'Table')}</th>
                        <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.rows', 'Lignes')}</th>
                        <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.deadRows', 'Mortes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbMetrics.tables?.slice(0, 8).map((table, index) => (
                        <tr key={index} className="border-b border-orange-100">
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
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border bg-blue-50 text-blue-600 border-blue-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium opacity-80">{t('metrics.httpMethods')}</p>
                  <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(metrics.requests?.total))}</p>
                  <p className="text-xs mt-1 opacity-60">{t('metrics.totalApiRequests')}</p>
                </div>
                <ChartBarIcon className="w-10 h-10 opacity-50" />
              </div>
              <div className="space-y-2">
                {metrics.requests?.byMethod && Object.entries(metrics.requests.byMethod).map(([method, count]) => (
                  <ProgressBar key={method} label={method} value={safeNumber(count)} max={safeNumber(metrics.requests?.total, 1)} color={method === 'GET' ? 'blue' : method === 'POST' ? 'green' : method === 'PUT' ? 'yellow' : 'red'} />
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-xl border bg-yellow-50 text-yellow-600 border-yellow-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium opacity-80">{t('metrics.httpStatus')}</p>
                  <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(metrics.requests?.byStatus?.['2xx']))}</p>
                  <p className="text-xs mt-1 opacity-60">{t('metrics.successfulRequests')}</p>
                </div>
                <ExclamationTriangleIcon className="w-10 h-10 opacity-50" />
              </div>
              <div className="space-y-2">
                {metrics.requests?.byStatus && Object.entries(metrics.requests.byStatus).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => (
                  <ProgressBar key={status} label={status} value={safeNumber(count)} max={safeNumber(metrics.requests?.total, 1)} color={status.startsWith('2') ? 'green' : status.startsWith('3') ? 'blue' : status.startsWith('4') ? 'yellow' : 'red'} />
                ))}
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-xl border bg-purple-50 text-purple-600 border-purple-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium opacity-80">{t('metrics.llmUsage')}</p>
                  <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(metrics.llm?.requests))}</p>
                  <p className="text-xs mt-1 opacity-60">{t('metrics.llmCalls')}</p>
                </div>
                <SparklesIcon className="w-10 h-10 opacity-50" />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div className="bg-purple-100 rounded-lg p-3"><p className="opacity-70">{t('metrics.tokensConsumed')}</p><p className="font-semibold">{formatNumber(safeNumber(metrics.llm?.totalTokens))}</p></div>
                <div className="bg-purple-100 rounded-lg p-3"><p className="opacity-70">{t('metrics.estimatedCost')}</p><p className="font-semibold">${parseFloat(String(metrics.llm?.estimatedCost || 0)).toFixed(2)}</p></div>
              </div>
              {metrics.llm?.byProvider && Object.keys(metrics.llm.byProvider).length > 0 && (
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-purple-200"><th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.model')}</th><th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.calls')}</th></tr></thead>
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
                            <tr key={model} className="border-b border-purple-100">
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

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="rounded-xl border bg-cyan-50 text-cyan-600 border-cyan-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium opacity-80">{t('metrics.topEndpoints')}</p>
                  <p className="text-2xl font-bold mt-1">{metrics.requests?.topEndpoints?.length || 0}</p>
                  <p className="text-xs mt-1 opacity-60">{t('metrics.activeEndpoints')}</p>
                </div>
                <ServerIcon className="w-10 h-10 opacity-50" />
              </div>
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-cyan-200"><th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.route')}</th><th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.calls')}</th></tr></thead>
                  <tbody>
                    {metrics.requests?.topEndpoints?.slice(0, 5).map((endpoint, index) => (
                      <tr key={index} className="border-b border-cyan-100">
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
      ) : (
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">{t('metrics.error')}</p>
          <button onClick={fetchMetrics} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('metrics.retry')}</button>
        </div>
      )}
    </motion.div>
  );
};

export default MetricsPage;
