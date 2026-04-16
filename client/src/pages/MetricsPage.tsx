/**
 * MetricsPage Component
 * TypeScript version
 */

import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { fetchWithAuth, createAuthOptions } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';
import DeferredRender from '../components/DeferredRender';
import { ApmMetricsSection, ProgressBar } from './MetricsPage.parts';
import {
  MetricsPageHeader,
  OperationsUnavailableBanner,
  OverviewStatsGrid
} from './MetricsPage.sections';
import type { APMMetrics, CacheAdminMetrics, DatabaseMetrics, Metrics, OperationsMetrics } from './MetricsPage.types';
import { computeRatio, formatBytes, formatNumber, safeNumber } from './MetricsPage.utils';

const BatchImportMetricsCard = lazy(() => import('../components/Metrics/BatchImportMetricsCard'));
const AiModifyMetricsCard = lazy(() => import('../components/Metrics/AiModifyMetricsCard'));
const ProfileMatchingMetricsCard = lazy(() => import('../components/Metrics/ProfileMatchingMetricsCard'));
const OperationLLMCard = lazy(() => import('../components/Metrics/OperationLLMCard'));
const ServerHealthCards = lazy(() => import('../components/Metrics/ServerHealthCards'));
const DatabaseMetricsCards = lazy(() => import('../components/Metrics/DatabaseMetricsCards'));
const OperationsInfraCards = lazy(() => import('../components/Metrics/OperationsInfraCards'));
const HttpTrafficCards = lazy(() => import('../components/Metrics/HttpTrafficCards'));
const ViewRefreshDebugCard = lazy(() => import('../components/Metrics/ViewRefreshDebugCard'));

const MetricsPage = (): JSX.Element => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [dbMetrics, setDbMetrics] = useState<DatabaseMetrics | null>(null);
  const [cacheAdminMetrics, setCacheAdminMetrics] = useState<CacheAdminMetrics | null>(null);
  const [apmMetrics, setApmMetrics] = useState<APMMetrics | null>(null);
  const [operationsMetrics, setOperationsMetrics] = useState<OperationsMetrics | null>(null);
  const [operationsMetricsError, setOperationsMetricsError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondaryReady, setSecondaryReady] = useState<boolean>(false);

  const fetchMetrics = useCallback(async (): Promise<void> => {
    try {
      setPageError(null);
      const response = await fetchWithAuth('/api/metrics', createAuthOptions());
      if (!response.ok) {
        const message = response.status === 403
          ? t('metrics.accessDenied')
          : response.status === 401
            ? t('metrics.sessionExpired')
            : t('metrics.error');
        setPageError(message);
        toast.error(message);
        throw new Error(`Failed to fetch metrics: ${response.status}`);
      }
      const data = await response.json();
      setMetrics(data);
      setLastUpdated(new Date());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      setPageError(t('metrics.error'));
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

  const refreshSecondaryMetrics = useCallback(async (): Promise<void> => {
    await Promise.all([fetchDbMetrics(), fetchApmMetrics(), fetchOperationsMetrics()]);
  }, [fetchDbMetrics, fetchApmMetrics, fetchOperationsMetrics]);

  const handleRefresh = useCallback(async (): Promise<void> => {
    setSecondaryReady(true);
    await Promise.all([fetchMetrics(), refreshSecondaryMetrics()]);
  }, [fetchMetrics, refreshSecondaryMetrics]);

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
    
    toast.success(`${t('metrics.exportSuccess')} (${format.toUpperCase()})`);
  };

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      setLoading(true);
      await fetchMetrics();
      setLoading(false);
    };
    loadData();
  }, [fetchMetrics]);

  useEffect(() => {
    if (loading || secondaryReady) return;

    const timeoutId = window.setTimeout(() => {
      setSecondaryReady(true);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [loading, secondaryReady]);

  useEffect(() => {
    if (!secondaryReady) return;
    void refreshSecondaryMetrics();
  }, [secondaryReady, refreshSecondaryMetrics]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(async () => {
      await fetchMetrics();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchMetrics]);

  useEffect(() => {
    if (!autoRefresh || !secondaryReady) return;
    const interval = setInterval(async () => {
      await refreshSecondaryMetrics();
    }, 120000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshSecondaryMetrics, secondaryReady]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="cv-surface app-page-shell max-w-6xl"
      >
        <div className="section-shell rounded-[2rem] p-8">
          <div className="flex items-start gap-4">
            <ArrowPathIcon className="mt-1 h-6 w-6 animate-spin text-primary-500" />
            <div className="flex-1 space-y-4">
              <div>
                <div className="h-8 w-64 max-w-full rounded-full bg-gray-200/80 dark:bg-gray-700/70 animate-pulse" />
                <div className="mt-3 h-4 w-[34rem] max-w-full rounded-full bg-gray-200/70 dark:bg-gray-700/60 animate-pulse" />
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="h-28 rounded-3xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                <div className="h-28 rounded-3xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                <div className="h-28 rounded-3xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                <div className="h-28 rounded-3xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('metrics.subtitle')}</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!metrics) {
    const message = pageError || t('metrics.error');
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="cv-surface app-page-shell max-w-6xl"
      >
        <div className="section-shell rounded-[2rem] p-8">
          <div className="flex items-start gap-4">
            <ExclamationTriangleIcon className="mt-1 h-6 w-6 text-amber-500" />
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {message}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                  {t('metrics.operationsHint')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="cv-gradient-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold"
              >
                {t('metrics.retry')}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const profileMatchingMetrics = operationsMetrics?.operations?.profileMatching;
  const batchImportMetrics = operationsMetrics?.operations?.batchImports;
  const aiModifyMetrics = operationsMetrics?.operations?.aiModify;
  const improvementMetrics = operationsMetrics?.operations?.improvement;
  const adaptationMetrics = operationsMetrics?.operations?.adaptation;
  const configuredCacheBackend = cacheAdminMetrics?.cacheBackend?.configuredBackend || 'unknown';
  const cacheBackend = cacheAdminMetrics?.cacheBackend?.backend || cacheAdminMetrics?.cacheBackend?.effectiveBackend || 'unknown';
  const cacheConnected = cacheAdminMetrics?.cacheBackend?.connected;
  const cacheFallbackReason = cacheAdminMetrics?.cacheBackend?.fallbackReason;
  const cacheBackendMessage = cacheAdminMetrics?.cacheBackend?.message;
  const cacheBackendBreakdown = cacheAdminMetrics?.cacheBackend?.backendBreakdown;
  const applicationCacheActive = cacheAdminMetrics?.cacheBackend?.applicationCacheActive;
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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="cv-surface app-page-shell max-w-6xl">
      <MetricsPageHeader
        autoRefresh={autoRefresh}
        lastUpdated={lastUpdated}
        onAutoRefreshChange={setAutoRefresh}
        onRefresh={handleRefresh}
        onExport={exportMetrics}
        t={t}
      />

      <div className="space-y-6">
        <div className="section-shell rounded-[2rem] p-6">
          <div className="space-y-8">
            <OverviewStatsGrid metrics={metrics} t={t} />

            <DeferredRender delayMs={500}>
              <Suspense fallback={null}>
                <ServerHealthCards
                  metrics={metrics}
                  cacheSummary={cacheAdminMetrics?.cacheSummary}
                  configuredCacheBackend={configuredCacheBackend}
                  cacheBackend={cacheBackend}
                  cacheConnected={cacheConnected}
                  cacheFallbackReason={cacheFallbackReason}
                  cacheBackendMessage={cacheBackendMessage}
                  cacheBackendBreakdown={cacheBackendBreakdown}
                  applicationCacheActive={applicationCacheActive}
                  t={t}
                  safeNumber={safeNumber}
                  formatBytes={formatBytes}
                  formatNumber={formatNumber}
                />
              </Suspense>
            </DeferredRender>

            <DeferredRender delayMs={600}>
              <Suspense fallback={null}>
                <ViewRefreshDebugCard />
              </Suspense>
            </DeferredRender>

            {secondaryReady ? (
              <Suspense fallback={null}>
                <>
                  <DatabaseMetricsCards
                    metrics={dbMetrics}
                    t={t}
                    safeNumber={safeNumber}
                    formatNumber={formatNumber}
                  />

                  {operationsMetricsError && !operationsMetrics && (
                    <OperationsUnavailableBanner error={operationsMetricsError} t={t} />
                  )}

                  {operationsMetrics && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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

                  <ApmMetricsSection metrics={apmMetrics} t={t} safeNumber={safeNumber} />
                </>
              </Suspense>
            ) : null}

            <DeferredRender delayMs={700}>
              <Suspense fallback={null}>
                <HttpTrafficCards
                  metrics={metrics}
                  ProgressBar={ProgressBar}
                  t={t}
                  safeNumber={safeNumber}
                  formatNumber={formatNumber}
                />
              </Suspense>
            </DeferredRender>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MetricsPage;
