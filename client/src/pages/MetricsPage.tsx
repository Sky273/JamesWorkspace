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
  ArrowDownTrayIcon,
  BoltIcon
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

const computeRatio = (numerator: number, denominator: number): number | null => {
  if (denominator <= 0) return null;
  return numerator / denominator;
};

// ============================================
// MEMOIZED SUB-COMPONENTS
// ============================================

const StatCard = memo(({ title, value, subtitle, icon: Icon, color = 'blue' }: StatCardProps): JSX.Element => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-gray-800 dark:text-blue-400 dark:border-blue-700',
    green: 'bg-green-50 text-green-600 border-green-200 dark:bg-gray-800 dark:text-green-400 dark:border-green-700',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-gray-800 dark:text-yellow-400 dark:border-yellow-700',
    red: 'bg-red-50 text-red-600 border-red-200 dark:bg-gray-800 dark:text-red-400 dark:border-red-700',
    purple: 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-gray-800 dark:text-purple-400 dark:border-purple-700',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-gray-800 dark:text-indigo-400 dark:border-indigo-700'
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
  binaryStorage?: {
    resumesWithBinary?: number;
    resumeBinaryBytes?: number;
    avgResumeBinaryBytes?: number;
    maxResumeBinaryBytes?: number;
    batchItemsWithFileData?: number;
    batchFileDataBytes?: number;
  };
  tables?: Array<{ name: string; rowCount: number; deadRows: number; lastVacuum?: string; lastAnalyze?: string }>;
  connections?: { total?: number; active?: number; idle?: number };
  queryTime?: string;
  timestamp?: string;
}

interface CacheAdminMetrics {
  cacheBackend?: {
    backend?: string;
    connected?: boolean | null;
    fallbackReason?: string | null;
  };
  caches?: {
    settings?: {
      entries?: number;
      cache?: {
        backend?: string;
        effectiveBackend?: string;
        connected?: boolean | null;
        disabledReason?: string | null;
      };
    };
  };
}

interface OperationsMetrics {
  operations?: {
    uploads?: {
      total?: number;
      successful?: number;
      failed?: number;
      bytesReceived?: number;
      bytesStoredInDb?: number;
      byEndpoint?: Record<string, number>;
      byMimeType?: Record<string, number>;
    };
    ocr?: {
      runs?: number;
      successfulRuns?: number;
      failedRuns?: number;
      pagesProcessed?: number;
      scannedPagesDetected?: number;
      failedPages?: number;
      totalConfidence?: number;
      confidenceSamples?: number;
      totalExtractionTimeMs?: number;
    };
    cleanup?: {
      runs?: number;
      filesDeleted?: number;
      directoriesDeleted?: number;
      orphanExportFilesDeleted?: number;
      staleExportRefsCleared?: number;
    };
    improvement?: {
      runs?: number;
      successfulRuns?: number;
      failedRuns?: number;
      fallbackRuns?: number;
      structuredRuns?: number;
      inputChars?: number;
      outputChars?: number;
      recent?: Array<{
        timestamp?: string;
        provider?: string;
        event?: string;
        successfulRuns?: number;
        failedRuns?: number;
        fallbackRuns?: number;
        structuredRuns?: number;
        inputChars?: number;
        outputChars?: number;
        source?: string;
      }>;
      byProvider?: Record<string, {
        runs?: number;
        successfulRuns?: number;
        failedRuns?: number;
        fallbackRuns?: number;
        structuredRuns?: number;
        inputChars?: number;
        outputChars?: number;
      }>;
    };
    adaptation?: {
      runs?: number;
      matchRuns?: number;
      successfulRuns?: number;
      failedRuns?: number;
      fallbackRuns?: number;
      structuredRuns?: number;
      inputChars?: number;
      outputChars?: number;
      recent?: Array<{
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
      }>;
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
    };
    profileMatching?: {
      searches?: number;
      batchesStarted?: number;
      batchesRetried?: number;
      batchesFailed?: number;
      normalizationEvents?: number;
      profilesRequested?: number;
      profilesScored?: number;
      profilesExplained?: number;
      profilesReturned?: number;
      recent?: Array<{
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
      }>;
      byProvider?: Record<string, {
        searches?: number;
        batchesStarted?: number;
        batchesRetried?: number;
        batchesFailed?: number;
        normalizationEvents?: number;
        profilesRequested?: number;
        profilesScored?: number;
      }>;
    };
  };
  binaryStorage?: {
    resumesWithBinary?: number;
    resumeBinaryBytes?: number;
    avgResumeBinaryBytes?: number;
    maxResumeBinaryBytes?: number;
    batchItemsWithFileData?: number;
    batchFileDataBytes?: number;
  };
  storage?: {
    tempDirectorySize?: number;
    tempFileCount?: number;
    batchExportDirectorySize?: number;
    batchExportFileCount?: number;
  };
  cleanup?: {
    filesDeleted?: number;
    dirsDeleted?: number;
    lastCleanupTime?: string;
  };
  timestamp?: string;
}

interface APMMetrics {
  config?: {
    slowThreshold?: number;
    verySlowThreshold?: number;
    criticalThreshold?: number;
  };
  summary?: {
    totalTracked?: number;
    last5min?: number;
    last1h?: number;
    avgDuration?: number;
    severityCounts?: {
      slow?: number;
      very_slow?: number;
      critical?: number;
    };
  };
  topSlowEndpoints?: Array<{
    endpoint: string;
    count: number;
    avgDuration: number;
    maxDuration: number;
  }>;
  timestamp?: string;
}

const MetricsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [dbMetrics, setDbMetrics] = useState<DatabaseMetrics | null>(null);
  const [cacheAdminMetrics, setCacheAdminMetrics] = useState<CacheAdminMetrics | null>(null);
  const [apmMetrics, setApmMetrics] = useState<APMMetrics | null>(null);
  const [operationsMetrics, setOperationsMetrics] = useState<OperationsMetrics | null>(null);
  const [operationsMetricsError, setOperationsMetricsError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async (): Promise<void> => {
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
  }, [t]);

  const fetchDbMetrics = useCallback(async (): Promise<void> => {
    try {
      const [databaseResponse, cacheResponse] = await Promise.all([
        fetchWithAuth('/api/metrics/database', createAuthOptions()),
        fetchWithAuth('/api/admin/cache-stats', createAuthOptions())
      ]);

      if (databaseResponse.ok) {
        const data = await databaseResponse.json();
        setDbMetrics(data);
      }

      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();
        setCacheAdminMetrics(cacheData);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching database metrics:', error);
      }
    }
  }, []);

  const fetchApmMetrics = useCallback(async (): Promise<void> => {
    try {
      const response = await fetchWithAuth('/api/metrics/apm', createAuthOptions());
      if (response.ok) {
        const data = await response.json();
        setApmMetrics(data);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching APM metrics:', error);
      }
    }
  }, []);

  const fetchOperationsMetrics = useCallback(async (): Promise<void> => {
    try {
      const response = await fetchWithAuth('/api/metrics/operations', createAuthOptions());
      if (!response.ok) {
        setOperationsMetrics(null);
        setOperationsMetricsError(`${t('metrics.operationsUnavailable', 'Operational metrics unavailable')} (${response.status})`);
        return;
      }
      const data = await response.json();
      setOperationsMetrics(data);
      setOperationsMetricsError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('Error fetching operations metrics:', error);
      }
      setOperationsMetrics(null);
      setOperationsMetricsError(t('metrics.operationsUnavailable', 'Operational metrics unavailable'));
    }
  }, [t]);

  const refreshAllMetrics = useCallback(async (): Promise<void> => {
    await Promise.all([fetchMetrics(), fetchDbMetrics(), fetchApmMetrics(), fetchOperationsMetrics()]);
  }, [fetchMetrics, fetchDbMetrics, fetchApmMetrics, fetchOperationsMetrics]);

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
        database: dbMetrics,
        cacheAdmin: cacheAdminMetrics,
        operations: operationsMetrics
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
        [t('metrics.resumeBinaryStorageCsv', 'Resume Binary Storage'), formatBytes(operationsMetrics?.binaryStorage?.resumeBinaryBytes)],
        [t('metrics.batchFileDataStorageCsv', 'Batch File Data Storage'), formatBytes(operationsMetrics?.binaryStorage?.batchFileDataBytes)],
        [t('metrics.uploadFilesTotalCsv', 'Upload Files Total'), String(operationsMetrics?.operations?.uploads?.total || 0)],
        [t('metrics.ocrRunsCsv', 'OCR Runs'), String(operationsMetrics?.operations?.ocr?.runs || 0)],
        [t('metrics.cleanupRunsCsv', 'Cleanup Runs'), String(operationsMetrics?.operations?.cleanup?.runs || 0)],
        [t('metrics.improvementRunsCsv', 'Resume Improvement Runs'), String(operationsMetrics?.operations?.improvement?.runs || 0)],
        [t('metrics.adaptationRunsCsv', 'Resume Adaptation Runs'), String(operationsMetrics?.operations?.adaptation?.runs || 0)],
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
      await refreshAllMetrics();
      setLoading(false);
    };
    // Load immediately without delay for faster initial render
    loadData();
  }, [refreshAllMetrics]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(async () => {
      await refreshAllMetrics();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshAllMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const profileMatchingMetrics = operationsMetrics?.operations?.profileMatching;
  const improvementMetrics = operationsMetrics?.operations?.improvement;
  const adaptationMetrics = operationsMetrics?.operations?.adaptation;
  const cacheBackend = cacheAdminMetrics?.cacheBackend?.backend || 'unknown';
  const cacheConnected = cacheAdminMetrics?.cacheBackend?.connected;
  const cacheFallbackReason = cacheAdminMetrics?.cacheBackend?.fallbackReason;
  const requestedToScoredRatio = computeRatio(
    safeNumber(profileMatchingMetrics?.profilesScored),
    safeNumber(profileMatchingMetrics?.profilesRequested)
  );
  const scoredToExplainedRatio = computeRatio(
    safeNumber(profileMatchingMetrics?.profilesExplained),
    safeNumber(profileMatchingMetrics?.profilesScored)
  );
  const scoredToReturnedRatio = computeRatio(
    safeNumber(profileMatchingMetrics?.profilesReturned),
    safeNumber(profileMatchingMetrics?.profilesScored)
  );
  const profileMatchingAlerts = [
    requestedToScoredRatio !== null && requestedToScoredRatio < 0.6
      ? t('metrics.profileMatchingAlertRequestedScored', 'Profile matching scoring ratio is degraded. Too many requested profiles are not reaching LLM scoring.')
      : null,
    scoredToExplainedRatio !== null && scoredToExplainedRatio < 0.2
      ? t('metrics.profileMatchingAlertScoredExplained', 'Profile matching explanation ratio is low. Explanations are only being generated for a small part of scored profiles.')
      : null,
    scoredToReturnedRatio !== null && scoredToReturnedRatio < 0.5
      ? t('metrics.profileMatchingAlertScoredReturned', 'Profile matching return ratio is degraded. Too many scored profiles are filtered out or failing later in the pipeline.')
      : null
  ].filter(Boolean) as string[];
  const improvementSuccessRatio = computeRatio(
    safeNumber(improvementMetrics?.successfulRuns),
    safeNumber(improvementMetrics?.runs)
  );
  const adaptationSuccessRatio = computeRatio(
    safeNumber(adaptationMetrics?.successfulRuns),
    safeNumber(adaptationMetrics?.runs)
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="p-6">      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-1 h-8 rounded-full bg-primary-500" />
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">{t('metrics.title')}</h1>
            </div>
            <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">{t('metrics.subtitle')}</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input type="checkbox" checked={autoRefresh} onChange={(e: ChangeEvent<HTMLInputElement>) => setAutoRefresh(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" />
              {t('metrics.autoRefresh')}
            </label>
            <button onClick={refreshAllMetrics} className="btn btn-primary flex items-center gap-2 px-4 py-2">
              <ArrowPathIcon className="w-4 h-4" />
              {t('metrics.refresh')}
            </button>
            <div className="relative group">
              <button className="btn btn-secondary flex items-center gap-2 px-4 py-2">
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
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-gray-800 dark:text-indigo-400 dark:border-indigo-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium opacity-80">{t('metrics.serverMemory')}</p>
                  <p className="text-2xl font-bold mt-1">{formatBytes(safeNumber(metrics.memory?.heapUsed))}</p>
                  <p className="text-xs mt-1 opacity-60">{t('metrics.heapUsed', { total: formatBytes(safeNumber(metrics.memory?.heapTotal)) })}</p>
                </div>
                <CpuChipIcon className="w-10 h-10 opacity-50" />
              </div>
              <div className="w-full bg-indigo-200 dark:bg-indigo-900/50 rounded-full h-2 mb-4">
                <div className="h-2 rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${safeNumber(metrics.memory?.heapTotal) > 0 ? (safeNumber(metrics.memory?.heapUsed) / safeNumber(metrics.memory?.heapTotal)) * 100 : 0}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-lg p-3"><p className="opacity-70">{t('metrics.rss')}</p><p className="font-semibold">{formatBytes(safeNumber(metrics.memory?.rss))}</p></div>
                <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-lg p-3"><p className="opacity-70">{t('metrics.external')}</p><p className="font-semibold">{formatBytes(safeNumber(metrics.memory?.external))}</p></div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-green-50 text-green-600 border-green-200 dark:bg-gray-800 dark:text-green-400 dark:border-green-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium opacity-80">{t('metrics.cachePerformance')}</p>
                  <p className="text-2xl font-bold mt-1">{(safeNumber(metrics.cache?.hitRate) * 100).toFixed(1)}%</p>
                  <p className="text-xs mt-1 opacity-60">{t('metrics.cacheHitRate')}</p>
                </div>
                <CircleStackIcon className="w-10 h-10 opacity-50" />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3"><p className="opacity-70">{t('metrics.cacheHits')}</p><p className="font-semibold">{formatNumber(safeNumber(metrics.cache?.hits))}</p></div>
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3"><p className="opacity-70">{t('metrics.cacheMisses')}</p><p className="font-semibold">{formatNumber(safeNumber(metrics.cache?.misses))}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm mt-4">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
                  <p className="opacity-70">{t('metrics.cacheBackend', 'Cache backend')}</p>
                  <p className="font-semibold uppercase">{cacheBackend}</p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
                  <p className="opacity-70">{t('metrics.cacheConnected', 'Redis connected')}</p>
                  <p className="font-semibold">
                    {cacheConnected === null || cacheConnected === undefined
                      ? t('metrics.notApplicable', 'N/A')
                      : cacheConnected
                        ? t('common.yes', 'Oui')
                        : t('common.no', 'Non')}
                  </p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
                  <p className="opacity-70">{t('metrics.cacheFallbackReason', 'Fallback')}</p>
                  <p className="font-semibold break-words">{cacheFallbackReason || t('metrics.none', 'Aucun')}</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Database Metrics Section */}
          {dbMetrics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border bg-orange-50 text-orange-600 border-orange-200 dark:bg-gray-800 dark:text-orange-400 dark:border-orange-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium opacity-80">{t('metrics.database', 'Base de données')}</p>
                    <p className="text-2xl font-bold mt-1">{dbMetrics.database?.sizePretty || 'N/A'}</p>
                    <p className="text-xs mt-1 opacity-60">{t('metrics.dbSize', 'Taille totale')}</p>
                  </div>
                  <TableCellsIcon className="w-10 h-10 opacity-50" />
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                  <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.connections', 'Connexions')}</p>
                    <p className="font-semibold">{safeNumber(dbMetrics.connections?.total)}</p>
                  </div>
                  <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.active', 'Actives')}</p>
                    <p className="font-semibold">{safeNumber(dbMetrics.connections?.active)}</p>
                  </div>
                  <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.idle', 'Inactives')}</p>
                    <p className="font-semibold">{safeNumber(dbMetrics.connections?.idle)}</p>
                  </div>
                </div>
                <p className="text-xs opacity-60">{t('metrics.queryTime', 'Temps de requête')}: {dbMetrics.queryTime || 'N/A'}</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="rounded-xl border bg-orange-50 text-orange-600 border-orange-200 dark:bg-gray-800 dark:text-orange-400 dark:border-orange-700 p-6">
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
                      <tr className="border-b border-orange-200 dark:border-orange-700">
                        <th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.tableName', 'Table')}</th>
                        <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.rows', 'Lignes')}</th>
                        <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.deadRows', 'Mortes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbMetrics.tables?.slice(0, 8).map((table, index) => (
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
          )}

          {operationsMetricsError && !operationsMetrics && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.185 }} className="rounded-xl border bg-amber-50 text-amber-700 border-amber-200 dark:bg-gray-800 dark:text-amber-400 dark:border-amber-700 p-6 mb-8">
              <div className="flex items-center gap-3 mb-2">
                <ExclamationTriangleIcon className="w-6 h-6 opacity-80" />
                <p className="text-sm font-semibold">{t('metrics.operationsUnavailable', 'Operational metrics unavailable')}</p>
              </div>
              <p className="text-sm opacity-80">{operationsMetricsError}</p>
              <p className="text-xs opacity-60 mt-2">{t('metrics.operationsHint', 'Deploy the backend exposing /api/metrics/operations to enable uploads, OCR, storage and cleanup metrics.')}</p>
            </motion.div>
          )}

          {operationsMetrics && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.185 }} className="rounded-xl border bg-sky-50 text-sky-700 border-sky-200 dark:bg-gray-800 dark:text-sky-400 dark:border-sky-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium opacity-80">{t('metrics.operationsUploadsTitle', 'Uploads and binary storage')}</p>
                    <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(operationsMetrics.operations?.uploads?.total))}</p>
                    <p className="text-xs mt-1 opacity-60">{t('metrics.operationsUploadsSubtitle', 'Files received, stored and kept in the database')}</p>
                  </div>
                  <ArrowDownTrayIcon className="w-10 h-10 opacity-50" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.successFailures', 'Success / failures')}</p>
                    <p className="font-semibold">{safeNumber(operationsMetrics.operations?.uploads?.successful)} / {safeNumber(operationsMetrics.operations?.uploads?.failed)}</p>
                  </div>
                  <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.receivedStoredDb', 'Received / stored in DB')}</p>
                    <p className="font-semibold">{formatBytes(safeNumber(operationsMetrics.operations?.uploads?.bytesReceived))} / {formatBytes(safeNumber(operationsMetrics.operations?.uploads?.bytesStoredInDb))}</p>
                  </div>
                  <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.binaryResumes', 'Binary resumes')}</p>
                    <p className="font-semibold">{safeNumber(operationsMetrics.binaryStorage?.resumesWithBinary)}</p>
                  </div>
                  <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.binaryStorage', 'Binary storage')}</p>
                    <p className="font-semibold">{formatBytes(safeNumber(operationsMetrics.binaryStorage?.resumeBinaryBytes))}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.averagePerResume', 'Average per resume')}</p>
                    <p className="font-semibold">{formatBytes(safeNumber(operationsMetrics.binaryStorage?.avgResumeBinaryBytes))}</p>
                  </div>
                  <div className="bg-sky-100 dark:bg-sky-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.batchFileData', 'Batch file_data')}</p>
                    <p className="font-semibold">{formatBytes(safeNumber(operationsMetrics.binaryStorage?.batchFileDataBytes))}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }} className="rounded-xl border bg-teal-50 text-teal-700 border-teal-200 dark:bg-gray-800 dark:text-teal-400 dark:border-teal-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium opacity-80">{t('metrics.operationsOcrTitle', 'OCR and cleanup')}</p>
                    <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(operationsMetrics.operations?.ocr?.runs))}</p>
                    <p className="text-xs mt-1 opacity-60">{t('metrics.operationsOcrSubtitle', 'Scanned PDF extraction, temporary files and batch exports')}</p>
                  </div>
                  <BoltIcon className="w-10 h-10 opacity-50" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.ocrSuccessFailures', 'OCR success / failures')}</p>
                    <p className="font-semibold">{safeNumber(operationsMetrics.operations?.ocr?.successfulRuns)} / {safeNumber(operationsMetrics.operations?.ocr?.failedRuns)}</p>
                  </div>
                  <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.ocrPagesFailures', 'OCR pages / failures')}</p>
                    <p className="font-semibold">{safeNumber(operationsMetrics.operations?.ocr?.scannedPagesDetected)} / {safeNumber(operationsMetrics.operations?.ocr?.failedPages)}</p>
                  </div>
                  <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.averageConfidence', 'Average confidence')}</p>
                    <p className="font-semibold">{safeNumber(operationsMetrics.operations?.ocr?.confidenceSamples) > 0 ? ((safeNumber(operationsMetrics.operations?.ocr?.totalConfidence) / safeNumber(operationsMetrics.operations?.ocr?.confidenceSamples)).toFixed(1) + '%') : 'N/A'}</p>
                  </div>
                  <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.cumulativeOcrTime', 'Cumulative OCR time')}</p>
                    <p className="font-semibold">{Math.round(safeNumber(operationsMetrics.operations?.ocr?.totalExtractionTimeMs) / 1000) + 's'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.cleanupRuns', 'Cleanup runs')}</p>
                    <p className="font-semibold">{safeNumber(operationsMetrics.operations?.cleanup?.runs)}</p>
                  </div>
                  <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.filesDirsDeleted', 'Files / directories deleted')}</p>
                    <p className="font-semibold">{safeNumber(operationsMetrics.operations?.cleanup?.filesDeleted)} / {safeNumber(operationsMetrics.operations?.cleanup?.directoriesDeleted)}</p>
                  </div>
                  <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.orphanBatchExports', 'Orphan batch exports')}</p>
                    <p className="font-semibold">{safeNumber(operationsMetrics.operations?.cleanup?.orphanExportFilesDeleted)}</p>
                  </div>
                  <div className="bg-teal-100 dark:bg-teal-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.staleBatchRefs', 'Cleared batch references')}</p>
                    <p className="font-semibold">{safeNumber(operationsMetrics.operations?.cleanup?.staleExportRefsCleared)}</p>
                  </div>
                </div>
                <p className="text-xs opacity-60">
                  {t('metrics.tempStorageSummary', 'Temp')}: {formatBytes(safeNumber(operationsMetrics.storage?.tempDirectorySize))} / {safeNumber(operationsMetrics.storage?.tempFileCount)} {t('metrics.filesUnit', 'files')}
                  {' | '}
                  {t('metrics.batchExportsSummary', 'Batch exports')}: {formatBytes(safeNumber(operationsMetrics.storage?.batchExportDirectorySize))} / {safeNumber(operationsMetrics.storage?.batchExportFileCount)} {t('metrics.filesUnit', 'files')}
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.195 }} className="rounded-xl border bg-violet-50 text-violet-700 border-violet-200 dark:bg-gray-800 dark:text-violet-400 dark:border-violet-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium opacity-80">{t('metrics.profileMatchingTitle', 'Profile matching')}</p>
                    <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(operationsMetrics.operations?.profileMatching?.searches))}</p>
                    <p className="text-xs mt-1 opacity-60">{t('metrics.profileMatchingSubtitle', 'Searches, scoring batches and explained profiles')}</p>
                  </div>
                  <SparklesIcon className="w-10 h-10 opacity-50" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.profilesRequested', 'Profiles requested')}</p>
                    <p className="font-semibold">{formatNumber(safeNumber(operationsMetrics.operations?.profileMatching?.profilesRequested))}</p>
                  </div>
                  <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.profilesScored', 'Profiles scored')}</p>
                    <p className="font-semibold">{formatNumber(safeNumber(operationsMetrics.operations?.profileMatching?.profilesScored))}</p>
                  </div>
                  <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.batchesStarted', 'Batches started')}</p>
                    <p className="font-semibold">{safeNumber(operationsMetrics.operations?.profileMatching?.batchesStarted)}</p>
                  </div>
                  <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.batchesRetriedFailed', 'Retried / failed')}</p>
                    <p className="font-semibold">{safeNumber(operationsMetrics.operations?.profileMatching?.batchesRetried)} / {safeNumber(operationsMetrics.operations?.profileMatching?.batchesFailed)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.profilesExplained', 'Profiles explained')}</p>
                    <p className="font-semibold">{formatNumber(safeNumber(operationsMetrics.operations?.profileMatching?.profilesExplained))}</p>
                  </div>
                  <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.profilesReturned', 'Profiles returned')}</p>
                    <p className="font-semibold">{formatNumber(safeNumber(operationsMetrics.operations?.profileMatching?.profilesReturned))}</p>
                  </div>
                  <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.profileNormalizationEvents', 'Normalized LLM fields')}</p>
                    <p className="font-semibold">{formatNumber(safeNumber(operationsMetrics.operations?.profileMatching?.normalizationEvents))}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-4">
                  <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.requestedToScoredRatio', 'Requested -> scored')}</p>
                    <p className="font-semibold">
                      {requestedToScoredRatio !== null
                        ? `${(requestedToScoredRatio * 100).toFixed(1)}%`
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.scoredToExplainedRatio', 'Scored -> explained')}</p>
                    <p className="font-semibold">
                      {scoredToExplainedRatio !== null
                        ? `${(scoredToExplainedRatio * 100).toFixed(1)}%`
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.scoredToReturnedRatio', 'Scored -> returned')}</p>
                    <p className="font-semibold">
                      {scoredToReturnedRatio !== null
                        ? `${(scoredToReturnedRatio * 100).toFixed(1)}%`
                        : 'N/A'}
                    </p>
                  </div>
                </div>
                {profileMatchingAlerts.length > 0 && (
                  <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                    <div className="mb-2 flex items-center gap-2 font-semibold">
                      <ExclamationTriangleIcon className="h-4 w-4" />
                      {t('metrics.profileMatchingAlerts', 'Profile matching alerts')}
                    </div>
                    <div className="space-y-1">
                      {profileMatchingAlerts.map((alert, index) => (
                        <p key={`${alert}-${index}`}>{alert}</p>
                      ))}
                    </div>
                  </div>
                )}
                {operationsMetrics.operations?.profileMatching?.byProvider && Object.keys(operationsMetrics.operations.profileMatching.byProvider).length > 0 && (
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-violet-200 dark:border-violet-700">
                          <th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.model', 'Model')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.searches', 'Searches')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.calls', 'Calls')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.profileNormalizationEventsShort', 'Normalized')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(operationsMetrics.operations.profileMatching.byProvider)
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
                {operationsMetrics.operations?.profileMatching?.recent && operationsMetrics.operations.profileMatching.recent.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold opacity-70 mb-2">{t('metrics.profileMatchingRecent', 'Recent activity')}</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {operationsMetrics.operations.profileMatching.recent.slice().reverse().map((entry, index) => (
                        <div key={`${entry.timestamp || 'entry'}-${index}`} className="bg-violet-100 dark:bg-violet-900/30 rounded-lg p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono">{entry.provider || 'unknown'}</span>
                            <span className="opacity-60">{entry.timestamp ? formatDateTime(entry.timestamp) : 'N/A'}</span>
                          </div>
                          <div className="mt-1 opacity-80">
                            {entry.event || 'search'} | {t('metrics.profilesRequested', 'Profiles requested')}: {safeNumber(entry.profilesRequested)} | {t('metrics.profilesScored', 'Profiles scored')}: {safeNumber(entry.profilesScored)}
                          </div>
                          {(safeNumber(entry.normalizationEvents) > 0 || entry.field || entry.inputType) && (
                            <div className="mt-1 opacity-70">
                              {t('metrics.profileNormalizationEvents', 'Normalized LLM fields')}: {safeNumber(entry.normalizationEvents)}
                              {entry.field ? ` | ${t('metrics.field', 'Field')}: ${entry.field}` : ''}
                              {entry.inputType ? ` | ${t('metrics.inputType', 'Input type')}: ${entry.inputType}` : ''}
                              {entry.source ? ` | ${t('metrics.source', 'Source')}: ${entry.source}` : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border bg-amber-50 text-amber-700 border-amber-200 dark:bg-gray-800 dark:text-amber-400 dark:border-amber-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium opacity-80">{t('metrics.resumeImprovementTitle', 'Resume improvement')}</p>
                    <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(improvementMetrics?.runs))}</p>
                    <p className="text-xs mt-1 opacity-60">{t('metrics.resumeImprovementSubtitle', 'Improvement calls, structured outputs and fallback usage')}</p>
                  </div>
                  <ArrowDownTrayIcon className="w-10 h-10 opacity-50" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.successFailures', 'Success / failures')}</p>
                    <p className="font-semibold">{safeNumber(improvementMetrics?.successfulRuns)} / {safeNumber(improvementMetrics?.failedRuns)}</p>
                  </div>
                  <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.structuredFallback', 'Structured / fallback')}</p>
                    <p className="font-semibold">{safeNumber(improvementMetrics?.structuredRuns)} / {safeNumber(improvementMetrics?.fallbackRuns)}</p>
                  </div>
                  <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.inputChars', 'Input chars')}</p>
                    <p className="font-semibold">{formatNumber(safeNumber(improvementMetrics?.inputChars))}</p>
                  </div>
                  <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.outputChars', 'Output chars')}</p>
                    <p className="font-semibold">{formatNumber(safeNumber(improvementMetrics?.outputChars))}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.successRatio', 'Success ratio')}</p>
                    <p className="font-semibold">{improvementSuccessRatio !== null ? `${(improvementSuccessRatio * 100).toFixed(1)}%` : 'N/A'}</p>
                  </div>
                </div>
                {improvementMetrics?.byProvider && Object.keys(improvementMetrics.byProvider).length > 0 && (
                  <div className="overflow-x-auto max-h-40 mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-amber-200 dark:border-amber-700">
                          <th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.model', 'Model')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.calls', 'Calls')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.successes', 'Successes')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.fallbacks', 'Fallbacks')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(improvementMetrics.byProvider)
                          .sort(([, left], [, right]) => safeNumber(right.runs) - safeNumber(left.runs))
                          .slice(0, 5)
                          .map(([provider, stats]) => (
                            <tr key={provider} className="border-b border-amber-100 dark:border-amber-800">
                              <td className="py-2 px-2 font-mono text-xs">{provider}</td>
                              <td className="py-2 px-2 text-right font-semibold">{safeNumber(stats.runs)}</td>
                              <td className="py-2 px-2 text-right opacity-70">{safeNumber(stats.successfulRuns)}</td>
                              <td className="py-2 px-2 text-right opacity-70">{safeNumber(stats.fallbackRuns)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {improvementMetrics?.recent && improvementMetrics.recent.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold opacity-70 mb-2">{t('metrics.resumeImprovementRecent', 'Recent activity')}</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {improvementMetrics.recent.slice().reverse().map((entry, index) => (
                        <div key={`${entry.timestamp || 'entry'}-${index}`} className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono">{entry.provider || 'unknown'}</span>
                            <span className="opacity-60">{entry.timestamp ? formatDateTime(entry.timestamp) : 'N/A'}</span>
                          </div>
                          <div className="mt-1 opacity-80">
                            {entry.event || 'run'} | {t('metrics.successFailures', 'Success / failures')}: {safeNumber(entry.successfulRuns)} / {safeNumber(entry.failedRuns)}
                          </div>
                          <div className="mt-1 opacity-70">
                            {t('metrics.structuredFallback', 'Structured / fallback')}: {safeNumber(entry.structuredRuns)} / {safeNumber(entry.fallbackRuns)}
                            {entry.source ? ` | ${t('metrics.source', 'Source')}: ${entry.source}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.205 }} className="rounded-xl border bg-rose-50 text-rose-700 border-rose-200 dark:bg-gray-800 dark:text-rose-400 dark:border-rose-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium opacity-80">{t('metrics.resumeAdaptationTitle', 'Resume adaptation')}</p>
                    <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(adaptationMetrics?.runs))}</p>
                    <p className="text-xs mt-1 opacity-60">{t('metrics.resumeAdaptationSubtitle', 'Match analyses, adaptation calls and structured outputs')}</p>
                  </div>
                  <SparklesIcon className="w-10 h-10 opacity-50" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.successFailures', 'Success / failures')}</p>
                    <p className="font-semibold">{safeNumber(adaptationMetrics?.successfulRuns)} / {safeNumber(adaptationMetrics?.failedRuns)}</p>
                  </div>
                  <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.matchRuns', 'Match runs')}</p>
                    <p className="font-semibold">{safeNumber(adaptationMetrics?.matchRuns)}</p>
                  </div>
                  <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.structuredFallback', 'Structured / fallback')}</p>
                    <p className="font-semibold">{safeNumber(adaptationMetrics?.structuredRuns)} / {safeNumber(adaptationMetrics?.fallbackRuns)}</p>
                  </div>
                  <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.successRatio', 'Success ratio')}</p>
                    <p className="font-semibold">{adaptationSuccessRatio !== null ? `${(adaptationSuccessRatio * 100).toFixed(1)}%` : 'N/A'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.inputChars', 'Input chars')}</p>
                    <p className="font-semibold">{formatNumber(safeNumber(adaptationMetrics?.inputChars))}</p>
                  </div>
                  <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
                    <p className="opacity-70">{t('metrics.outputChars', 'Output chars')}</p>
                    <p className="font-semibold">{formatNumber(safeNumber(adaptationMetrics?.outputChars))}</p>
                  </div>
                </div>
                {adaptationMetrics?.byProvider && Object.keys(adaptationMetrics.byProvider).length > 0 && (
                  <div className="overflow-x-auto max-h-40 mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-rose-200 dark:border-rose-700">
                          <th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.model', 'Model')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.calls', 'Calls')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.matchRuns', 'Match runs')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.fallbacks', 'Fallbacks')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(adaptationMetrics.byProvider)
                          .sort(([, left], [, right]) => safeNumber(right.runs) - safeNumber(left.runs))
                          .slice(0, 5)
                          .map(([provider, stats]) => (
                            <tr key={provider} className="border-b border-rose-100 dark:border-rose-800">
                              <td className="py-2 px-2 font-mono text-xs">{provider}</td>
                              <td className="py-2 px-2 text-right font-semibold">{safeNumber(stats.runs)}</td>
                              <td className="py-2 px-2 text-right opacity-70">{safeNumber(stats.matchRuns)}</td>
                              <td className="py-2 px-2 text-right opacity-70">{safeNumber(stats.fallbackRuns)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {adaptationMetrics?.recent && adaptationMetrics.recent.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold opacity-70 mb-2">{t('metrics.resumeAdaptationRecent', 'Recent activity')}</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {adaptationMetrics.recent.slice().reverse().map((entry, index) => (
                        <div key={`${entry.timestamp || 'entry'}-${index}`} className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono">{entry.provider || 'unknown'}</span>
                            <span className="opacity-60">{entry.timestamp ? formatDateTime(entry.timestamp) : 'N/A'}</span>
                          </div>
                          <div className="mt-1 opacity-80">
                            {entry.event || 'run'} | {t('metrics.matchRuns', 'Match runs')}: {safeNumber(entry.matchRuns)} | {t('metrics.successFailures', 'Success / failures')}: {safeNumber(entry.successfulRuns)} / {safeNumber(entry.failedRuns)}
                          </div>
                          <div className="mt-1 opacity-70">
                            {t('metrics.structuredFallback', 'Structured / fallback')}: {safeNumber(entry.structuredRuns)} / {safeNumber(entry.fallbackRuns)}
                            {entry.source ? ` | ${t('metrics.source', 'Source')}: ${entry.source}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* APM (Application Performance Monitoring) Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }} className="rounded-xl border bg-rose-50 text-rose-600 border-rose-200 dark:bg-gray-800 dark:text-rose-400 dark:border-rose-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium opacity-80">{t('metrics.apm', 'Performance (APM)')}</p>
                    <p className="text-2xl font-bold mt-1">{safeNumber(apmMetrics?.summary?.totalTracked)}</p>
                    <p className="text-xs mt-1 opacity-60">{t('metrics.slowRequests', 'Requêtes lentes')} ({t('metrics.last5min', '5 min')}: {safeNumber(apmMetrics?.summary?.last5min)})</p>
                  </div>
                  <BoltIcon className="w-10 h-10 opacity-50" />
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                  <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
                    <p className="opacity-70 text-xs">{t('metrics.slow', 'Lentes')}</p>
                    <p className="font-semibold">{safeNumber(apmMetrics?.summary?.severityCounts?.slow)}</p>
                    <p className="text-xs opacity-50">&gt; {apmMetrics?.config?.slowThreshold || 1000}ms</p>
                  </div>
                  <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
                    <p className="opacity-70 text-xs">{t('metrics.verySlow', 'Très lentes')}</p>
                    <p className="font-semibold">{safeNumber(apmMetrics?.summary?.severityCounts?.very_slow)}</p>
                    <p className="text-xs opacity-50">&gt; {apmMetrics?.config?.verySlowThreshold || 5000}ms</p>
                  </div>
                  <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
                    <p className="opacity-70 text-xs">{t('metrics.critical', 'Critiques')}</p>
                    <p className="font-semibold text-rose-700 dark:text-rose-300">{safeNumber(apmMetrics?.summary?.severityCounts?.critical)}</p>
                    <p className="text-xs opacity-50">&gt; {apmMetrics?.config?.criticalThreshold || 30000}ms</p>
                  </div>
                </div>
                {safeNumber(apmMetrics?.summary?.totalTracked) === 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                    {t('metrics.noSlowRequests', 'Aucune requête lente détectée')}
                  </p>
                )}
                {safeNumber(apmMetrics?.summary?.avgDuration) > 0 && (
                  <p className="text-xs opacity-60 mt-2">
                    {t('metrics.avgDuration', 'Durée moyenne')}: {safeNumber(apmMetrics?.summary?.avgDuration)}ms
                  </p>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }} className="rounded-xl border bg-rose-50 text-rose-600 border-rose-200 dark:bg-gray-800 dark:text-rose-400 dark:border-rose-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium opacity-80">{t('metrics.slowEndpoints', 'Endpoints lents')}</p>
                    <p className="text-2xl font-bold mt-1">{apmMetrics?.topSlowEndpoints?.length || 0}</p>
                    <p className="text-xs mt-1 opacity-60">{t('metrics.topSlowEndpoints', 'Endpoints les plus lents')}</p>
                  </div>
                  <ClockIcon className="w-10 h-10 opacity-50" />
                </div>
                {apmMetrics?.topSlowEndpoints && apmMetrics.topSlowEndpoints.length > 0 ? (
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-rose-200 dark:border-rose-700">
                          <th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.endpoint', 'Endpoint')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.count', 'Nb')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.avgMs', 'Moy.')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.maxMs', 'Max')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apmMetrics.topSlowEndpoints.slice(0, 5).map((item, index) => (
                          <tr key={index} className="border-b border-rose-100 dark:border-rose-800">
                            <td className="py-2 px-2 font-mono text-xs truncate max-w-[150px]" title={item.endpoint}>{item.endpoint}</td>
                            <td className="py-2 px-2 text-right font-semibold">{item.count}</td>
                            <td className="py-2 px-2 text-right opacity-70">{item.avgDuration}ms</td>
                            <td className="py-2 px-2 text-right text-rose-700 dark:text-rose-300">{item.maxDuration}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm opacity-60 text-center py-4">{t('metrics.noData', 'Aucune donnée')}</p>
                )}
              </motion.div>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border bg-blue-50 text-blue-600 border-blue-200 dark:bg-gray-800 dark:text-blue-400 dark:border-blue-700 p-6">
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

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-xl border bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-gray-800 dark:text-yellow-400 dark:border-yellow-700 p-6">
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
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-xl border bg-purple-50 text-purple-600 border-purple-200 dark:bg-gray-800 dark:text-purple-400 dark:border-purple-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium opacity-80">{t('metrics.llmUsage')}</p>
                  <p className="text-2xl font-bold mt-1">{formatNumber(safeNumber(metrics.llm?.requests))}</p>
                  <p className="text-xs mt-1 opacity-60">{t('metrics.llmCalls')}</p>
                </div>
                <SparklesIcon className="w-10 h-10 opacity-50" />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-3"><p className="opacity-70">{t('metrics.tokensConsumed')}</p><p className="font-semibold">{formatNumber(safeNumber(metrics.llm?.totalTokens))}</p></div>
                <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-3"><p className="opacity-70">{t('metrics.estimatedCost')}</p><p className="font-semibold">${parseFloat(String(metrics.llm?.estimatedCost || 0)).toFixed(2)}</p></div>
              </div>
              {metrics.llm?.byProvider && Object.keys(metrics.llm.byProvider).length > 0 && (
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
                  <p className="text-2xl font-bold mt-1">{metrics.requests?.topEndpoints?.length || 0}</p>
                  <p className="text-xs mt-1 opacity-60">{t('metrics.activeEndpoints')}</p>
                </div>
                <ServerIcon className="w-10 h-10 opacity-50" />
              </div>
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-cyan-200 dark:border-cyan-700"><th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.route')}</th><th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.calls')}</th></tr></thead>
                  <tbody>
                    {metrics.requests?.topEndpoints?.slice(0, 5).map((endpoint, index) => (
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
      ) : (
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">{t('metrics.error')}</p>
          <button onClick={refreshAllMetrics} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('metrics.retry')}</button>
        </div>
      )}
    </motion.div>
  );
};

export default MetricsPage;




