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
import BatchImportMetricsCard from '../components/Metrics/BatchImportMetricsCard';
import AiModifyMetricsCard from '../components/Metrics/AiModifyMetricsCard';
import ProfileMatchingMetricsCard from '../components/Metrics/ProfileMatchingMetricsCard';
import OperationLLMCard from '../components/Metrics/OperationLLMCard';
import ServerHealthCards from '../components/Metrics/ServerHealthCards';
import DatabaseMetricsCards from '../components/Metrics/DatabaseMetricsCards';
import OperationsInfraCards from '../components/Metrics/OperationsInfraCards';
import HttpTrafficCards from '../components/Metrics/HttpTrafficCards';

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
    batchImports?: {
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
      recent?: Array<{
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
      }>;
    };
    aiModify?: {
      runs?: number;
      successfulRuns?: number;
      failedRuns?: number;
      fallbackRuns?: number;
      selectionRuns?: number;
      inputChars?: number;
      outputChars?: number;
      recent?: Array<{
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
      }>;
      byProvider?: Record<string, {
        runs?: number;
        successfulRuns?: number;
        failedRuns?: number;
        fallbackRuns?: number;
        selectionRuns?: number;
        inputChars?: number;
        outputChars?: number;
      }>;
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
        setOperationsMetricsError(`${t('metrics.operationsUnavailable')} (${response.status})`);
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
      setOperationsMetricsError(t('metrics.operationsUnavailable'));
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
        [t('metrics.resumeBinaryStorageCsv'), formatBytes(operationsMetrics?.binaryStorage?.resumeBinaryBytes)],
        [t('metrics.batchFileDataStorageCsv'), formatBytes(operationsMetrics?.binaryStorage?.batchFileDataBytes)],
        [t('metrics.uploadFilesTotalCsv'), String(operationsMetrics?.operations?.uploads?.total || 0)],
        [t('metrics.ocrRunsCsv'), String(operationsMetrics?.operations?.ocr?.runs || 0)],
        [t('metrics.cleanupRunsCsv'), String(operationsMetrics?.operations?.cleanup?.runs || 0)],
        [t('metrics.batchImportRunsCsv'), String(operationsMetrics?.operations?.batchImports?.runs || 0)],
        [t('metrics.aiModifyRunsCsv'), String(operationsMetrics?.operations?.aiModify?.runs || 0)],
        [t('metrics.improvementRunsCsv'), String(operationsMetrics?.operations?.improvement?.runs || 0)],
        [t('metrics.adaptationRunsCsv'), String(operationsMetrics?.operations?.adaptation?.runs || 0)],
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
  const batchImportMetrics = operationsMetrics?.operations?.batchImports;
  const aiModifyMetrics = operationsMetrics?.operations?.aiModify;
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
      ? t('metrics.profileMatchingAlertRequestedScored')
      : null,
    scoredToExplainedRatio !== null && scoredToExplainedRatio < 0.2
      ? t('metrics.profileMatchingAlertScoredExplained')
      : null,
    scoredToReturnedRatio !== null && scoredToReturnedRatio < 0.5
      ? t('metrics.profileMatchingAlertScoredReturned')
      : null
  ].filter(Boolean) as string[];
  const improvementSuccessRatio = computeRatio(
    safeNumber(improvementMetrics?.successfulRuns),
    safeNumber(improvementMetrics?.runs)
  );
  const batchImportSuccessRatio = computeRatio(
    safeNumber(batchImportMetrics?.successfulRuns),
    safeNumber(batchImportMetrics?.runs)
  );
  const aiModifySuccessRatio = computeRatio(
    safeNumber(aiModifyMetrics?.successfulRuns),
    safeNumber(aiModifyMetrics?.runs)
  );
  const adaptationSuccessRatio = computeRatio(
    safeNumber(adaptationMetrics?.successfulRuns),
    safeNumber(adaptationMetrics?.runs)
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="p-6">
      <div className="mb-8">
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
                {t('metrics.export')}
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

          <ServerHealthCards
            metrics={metrics}
            cacheBackend={cacheBackend}
            cacheConnected={cacheConnected}
            cacheFallbackReason={cacheFallbackReason}
            t={t}
            safeNumber={safeNumber}
            formatBytes={formatBytes}
            formatNumber={formatNumber}
          />

          <DatabaseMetricsCards
            metrics={dbMetrics}
            t={t}
            safeNumber={safeNumber}
            formatNumber={formatNumber}
          />

          {operationsMetricsError && !operationsMetrics && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.185 }} className="rounded-xl border bg-amber-50 text-amber-700 border-amber-200 dark:bg-gray-800 dark:text-amber-400 dark:border-amber-700 p-6 mb-8">
              <div className="flex items-center gap-3 mb-2">
                <ExclamationTriangleIcon className="w-6 h-6 opacity-80" />
                <p className="text-sm font-semibold">{t('metrics.operationsUnavailable')}</p>
              </div>
              <p className="text-sm opacity-80">{operationsMetricsError}</p>
              <p className="text-xs opacity-60 mt-2">{t('metrics.operationsHint')}</p>
            </motion.div>
          )}

          {operationsMetrics && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <OperationsInfraCards
                metrics={operationsMetrics}
                t={t}
                safeNumber={safeNumber}
                formatNumber={formatNumber}
                formatBytes={formatBytes}
              />

              <BatchImportMetricsCard
                metrics={batchImportMetrics}
                successRatio={batchImportSuccessRatio}
                t={t}
                safeNumber={safeNumber}
                formatNumber={formatNumber}
                formatBytes={formatBytes}
              />
              <AiModifyMetricsCard
                metrics={aiModifyMetrics}
                successRatio={aiModifySuccessRatio}
                t={t}
                safeNumber={safeNumber}
                formatNumber={formatNumber}
              />

              <ProfileMatchingMetricsCard
                metrics={profileMatchingMetrics}
                requestedToScoredRatio={requestedToScoredRatio}
                scoredToExplainedRatio={scoredToExplainedRatio}
                scoredToReturnedRatio={scoredToReturnedRatio}
                alerts={profileMatchingAlerts}
                t={t}
                safeNumber={safeNumber}
                formatNumber={formatNumber}
              />

              <OperationLLMCard
                metrics={improvementMetrics}
                successRatio={improvementSuccessRatio}
                mode="improvement"
                t={t}
                safeNumber={safeNumber}
                formatNumber={formatNumber}
              />

              <OperationLLMCard
                metrics={adaptationMetrics}
                successRatio={adaptationSuccessRatio}
                mode="adaptation"
                t={t}
                safeNumber={safeNumber}
                formatNumber={formatNumber}
              />
            </div>
          )}

          {/* APM (Application Performance Monitoring) Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }} className="rounded-xl border bg-rose-50 text-rose-600 border-rose-200 dark:bg-gray-800 dark:text-rose-400 dark:border-rose-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium opacity-80">{t('metrics.apm')}</p>
                    <p className="text-2xl font-bold mt-1">{safeNumber(apmMetrics?.summary?.totalTracked)}</p>
                    <p className="text-xs mt-1 opacity-60">{t('metrics.slowRequests')} ({t('metrics.last5min')}: {safeNumber(apmMetrics?.summary?.last5min)})</p>
                  </div>
                  <BoltIcon className="w-10 h-10 opacity-50" />
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                  <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
                    <p className="opacity-70 text-xs">{t('metrics.slow')}</p>
                    <p className="font-semibold">{safeNumber(apmMetrics?.summary?.severityCounts?.slow)}</p>
                    <p className="text-xs opacity-50">&gt; {apmMetrics?.config?.slowThreshold || 1000}ms</p>
                  </div>
                  <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
                    <p className="opacity-70 text-xs">{t('metrics.verySlow')}</p>
                    <p className="font-semibold">{safeNumber(apmMetrics?.summary?.severityCounts?.very_slow)}</p>
                    <p className="text-xs opacity-50">&gt; {apmMetrics?.config?.verySlowThreshold || 5000}ms</p>
                  </div>
                  <div className="bg-rose-100 dark:bg-rose-900/30 rounded-lg p-3">
                    <p className="opacity-70 text-xs">{t('metrics.critical')}</p>
                    <p className="font-semibold text-rose-700 dark:text-rose-300">{safeNumber(apmMetrics?.summary?.severityCounts?.critical)}</p>
                    <p className="text-xs opacity-50">&gt; {apmMetrics?.config?.criticalThreshold || 30000}ms</p>
                  </div>
                </div>
                {safeNumber(apmMetrics?.summary?.totalTracked) === 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                    {t('metrics.noSlowRequests')}
                  </p>
                )}
                {safeNumber(apmMetrics?.summary?.avgDuration) > 0 && (
                  <p className="text-xs opacity-60 mt-2">
                    {t('metrics.avgDuration')}: {safeNumber(apmMetrics?.summary?.avgDuration)}ms
                  </p>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }} className="rounded-xl border bg-rose-50 text-rose-600 border-rose-200 dark:bg-gray-800 dark:text-rose-400 dark:border-rose-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium opacity-80">{t('metrics.slowEndpoints')}</p>
                    <p className="text-2xl font-bold mt-1">{apmMetrics?.topSlowEndpoints?.length || 0}</p>
                    <p className="text-xs mt-1 opacity-60">{t('metrics.topSlowEndpoints')}</p>
                  </div>
                  <ClockIcon className="w-10 h-10 opacity-50" />
                </div>
                {apmMetrics?.topSlowEndpoints && apmMetrics.topSlowEndpoints.length > 0 ? (
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-rose-200 dark:border-rose-700">
                          <th className="text-left py-2 px-2 font-medium opacity-70">{t('metrics.endpoint')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.count')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.avgMs')}</th>
                          <th className="text-right py-2 px-2 font-medium opacity-70">{t('metrics.maxMs')}</th>
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
                  <p className="text-sm opacity-60 text-center py-4">{t('metrics.noData')}</p>
                )}
              </motion.div>
            </div>

          <HttpTrafficCards
            metrics={metrics}
            ProgressBar={ProgressBar}
            t={t}
            safeNumber={safeNumber}
            formatNumber={formatNumber}
          />
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
