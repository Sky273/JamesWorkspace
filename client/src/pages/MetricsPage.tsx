/**
 * MetricsPage Component
 * TypeScript version
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { fetchWithAuth, createAuthOptions } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';
import BatchImportMetricsCard from '../components/Metrics/BatchImportMetricsCard';
import AiModifyMetricsCard from '../components/Metrics/AiModifyMetricsCard';
import ProfileMatchingMetricsCard from '../components/Metrics/ProfileMatchingMetricsCard';
import OperationLLMCard from '../components/Metrics/OperationLLMCard';
import ServerHealthCards from '../components/Metrics/ServerHealthCards';
import DatabaseMetricsCards from '../components/Metrics/DatabaseMetricsCards';
import OperationsInfraCards from '../components/Metrics/OperationsInfraCards';
import HttpTrafficCards from '../components/Metrics/HttpTrafficCards';
import { ApmMetricsSection, ProgressBar } from './MetricsPage.parts';
import {
  MetricsEmptyState,
  MetricsLoadingState,
  MetricsPageHeader,
  OperationsUnavailableBanner,
  OverviewStatsGrid
} from './MetricsPage.sections';
import type { APMMetrics, CacheAdminMetrics, DatabaseMetrics, Metrics, OperationsMetrics } from './MetricsPage.types';
import { computeRatio, formatBytes, formatNumber, safeNumber } from './MetricsPage.utils';

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
    
    toast.success(`${t('metrics.exportSuccess')} (${format.toUpperCase()})`);
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
    return <MetricsLoadingState />;
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
      <MetricsPageHeader
        autoRefresh={autoRefresh}
        lastUpdated={lastUpdated}
        onAutoRefreshChange={setAutoRefresh}
        onRefresh={refreshAllMetrics}
        onExport={exportMetrics}
        t={t}
      />

      {metrics ? (
        <>
          <OverviewStatsGrid metrics={metrics} t={t} />

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
            <OperationsUnavailableBanner error={operationsMetricsError} t={t} />
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

          <ApmMetricsSection metrics={apmMetrics} t={t} safeNumber={safeNumber} />

          <HttpTrafficCards
            metrics={metrics}
            ProgressBar={ProgressBar}
            t={t}
            safeNumber={safeNumber}
            formatNumber={formatNumber}
          />
        </>
      ) : (
        <MetricsEmptyState onRetry={refreshAllMetrics} t={t} />
      )}
    </motion.div>
  );
};

export default MetricsPage;
