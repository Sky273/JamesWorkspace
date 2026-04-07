/**
 * SecurityLogs Page
 * TypeScript version
 */

import { useState, useEffect, ChangeEvent, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import PageHeader from '../components/page/PageHeader';
import { fetchWithAuth, createAuthOptions } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';
import {
  SecurityFiltersBar,
  SecurityLogsPagination,
  SecurityLogsTable,
  SecurityStatsGrid,
} from './SecurityLogs.sections';
import type {
  SecurityLogEntry,
  SecurityLogFilterOptions,
  SecurityLogFilters,
  SecurityLogStats,
} from './SecurityLogs.types';
import { getSecurityLoadErrorMessage } from './SecurityLogs.utils';

const SecurityLogs = (): JSX.Element => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<SecurityLogEntry[]>([]);
  const [stats, setStats] = useState<SecurityLogStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SecurityLogFilters>({
    level: '',
    event: '',
    source: '',
  });
  const [filterOptions, setFilterOptions] = useState<SecurityLogFilterOptions>({
    levels: [],
    events: [],
    sources: [],
  });
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const pageSize = 50;

  const fetchLogs = useCallback(async (): Promise<void> => {
    try {
      const offset = (currentPage - 1) * pageSize;
      const queryParams = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
        ...(filters.level && { level: filters.level }),
        ...(filters.event && { event: filters.event }),
        ...(filters.source && { source: filters.source }),
      });
      const response = await fetchWithAuth(
        `/api/admin/security-logs?${queryParams}`,
        createAuthOptions(),
      );
      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }
      const data = await response.json();
      setLogs(data.logs);
      setTotalCount(data.total || data.logs.length);
      setLoadError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      const statusMatch = errorMessage.match(/^HTTP_(\d+)$/);
      const loadMessage = statusMatch
        ? getSecurityLoadErrorMessage(Number(statusMatch[1]), t)
        : errorMessage.includes('Session expired')
          ? t('security.sessionExpired')
          : t('security.loadError', { defaultValue: 'Unable to load security logs.' });

      setLoadError(loadMessage);
      if (!errorMessage.includes('Session expired')) {
        toast.error(loadMessage);
        logger.error('[SecurityLogs] Error fetching logs:', error);
      }
    }
  }, [currentPage, filters, t]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleFilterChange = (newFilters: Partial<SecurityLogFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  };

  const fetchStats = useCallback(async (): Promise<void> => {
    try {
      const response = await fetchWithAuth(
        '/api/admin/security-stats',
        createAuthOptions(),
      );
      if (!response.ok) throw new Error(`Failed to fetch stats: ${response.status}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('[SecurityLogs] Error fetching stats:', error);
      }
    }
  }, []);

  const fetchFilterOptions = useCallback(async (): Promise<void> => {
    try {
      const response = await fetchWithAuth(
        '/api/admin/security-filters',
        createAuthOptions(),
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch filter options: ${response.status}`);
      }
      const data = await response.json();
      setFilterOptions(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('[SecurityLogs] Error fetching filter options:', error);
      }
    }
  }, []);

  const refreshPage = useCallback(async (): Promise<void> => {
    setLoading(true);
    await Promise.all([fetchLogs(), fetchStats(), fetchFilterOptions()]);
    setLoading(false);
  }, [fetchFilterOptions, fetchLogs, fetchStats]);

  useEffect(() => {
    void refreshPage();
  }, [refreshPage]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(async () => {
      try {
        await Promise.all([fetchLogs(), fetchStats()]);
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          (error.message.includes('401') || error.message.includes('403'))
        ) {
          setAutoRefresh(false);
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs, fetchStats]);

  const hasActiveFilters = Boolean(filters.level || filters.event || filters.source);

  if (loading) {
    return (
      <div className="cv-surface app-page-shell max-w-6xl">
        <div className="section-shell rounded-[2rem] p-8">
          <div className="flex items-start gap-4">
            <ArrowPathIcon className="mt-1 h-6 w-6 animate-spin text-primary-500" />
            <div className="flex-1 space-y-4">
              <div>
                <div className="h-8 w-72 max-w-full animate-pulse rounded-full bg-gray-200/80 dark:bg-gray-700/70" />
                <div className="mt-3 h-4 w-[34rem] max-w-full animate-pulse rounded-full bg-gray-200/70 dark:bg-gray-700/60" />
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="h-24 animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-800" />
                <div className="h-24 animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-800" />
                <div className="h-24 animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-800" />
                <div className="h-24 animate-pulse rounded-3xl bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="cv-surface app-page-shell max-w-6xl"
    >
      <PageHeader title={t('security.title')} subtitle={t('security.subtitle')} />

      {stats && (
        <div className="section-shell mb-6 rounded-[2rem] p-6">
          <SecurityStatsGrid
            stats={stats}
            onResetFilters={() => handleFilterChange({ level: '', event: '', source: '' })}
            t={t}
          />
        </div>
      )}

      {loadError && logs.length > 0 && (
        <div className="section-shell mb-6 rounded-[2rem] border border-amber-200/70 bg-amber-50/80 p-4 dark:border-amber-800/70 dark:bg-amber-900/15">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-amber-500" />
              <p className="text-sm text-amber-800 dark:text-amber-200">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void refreshPage();
              }}
              className="cv-ghost-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium"
            >
              {t('common.retry')}
            </button>
          </div>
        </div>
      )}

      <div className="section-shell mb-6 rounded-[2rem] p-4">
        <SecurityFiltersBar
          autoRefresh={autoRefresh}
          fetchLogs={fetchLogs}
          fetchStats={fetchStats}
          filters={filters}
          filterOptions={filterOptions}
          onAutoRefreshChange={(e: ChangeEvent<HTMLInputElement>) =>
            setAutoRefresh(e.target.checked)
          }
          onClearFilters={() => {
            setFilters({ level: '', event: '', source: '' });
            setCurrentPage(1);
          }}
          onFilterChange={handleFilterChange}
          setLoading={setLoading}
          t={t}
        />
      </div>

      <div className="section-shell mb-6 rounded-[2rem] p-4">
        <SecurityLogsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={goToPage}
          loading={loading}
          t={t}
        />
      </div>

      {loadError && !logs.length ? (
        <div className="section-shell rounded-[2rem] border border-amber-200/70 bg-amber-50/80 p-8 dark:border-amber-800/70 dark:bg-amber-900/15">
          <div className="flex items-start gap-4">
            <ExclamationTriangleIcon className="mt-1 h-6 w-6 text-amber-500" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                {t('security.loadErrorTitle', { defaultValue: 'Unable to load security logs.' })}
              </h2>
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">{loadError}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilters({ level: '', event: '', source: '' });
                      setCurrentPage(1);
                    }}
                    className="cv-ghost-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium"
                  >
                    {t('common.resetFilters')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void refreshPage();
                  }}
                  className="cv-gradient-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold"
                >
                  {t('security.refresh')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="section-shell mb-6 overflow-hidden rounded-[2rem]">
            <SecurityLogsTable logs={logs} t={t} />
            {!logs.length && (
              <div className="border-t border-slate-200/80 px-6 py-8 text-center dark:border-slate-700/80">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('security.noLogs')}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilters({ level: '', event: '', source: '' });
                        setCurrentPage(1);
                      }}
                      className="cv-ghost-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium"
                    >
                      {t('common.resetFilters')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      void refreshPage();
                    }}
                    className="cv-gradient-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold"
                  >
                    {t('security.refresh')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="section-shell rounded-[2rem] p-4">
            <SecurityLogsPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={goToPage}
              loading={loading}
              t={t}
            />
          </div>
        </>
      )}
    </motion.div>
  );
};

export default SecurityLogs;
