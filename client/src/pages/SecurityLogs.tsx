/**
 * SecurityLogs Page
 * TypeScript version
 */

import { useState, useEffect, ChangeEvent, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
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
  const [filters, setFilters] = useState<SecurityLogFilters>({ level: '', event: '', source: '' });
  const [filterOptions, setFilterOptions] = useState<SecurityLogFilterOptions>({ levels: [], events: [], sources: [] });
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  
  // Server-side pagination state
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
        ...(filters.source && { source: filters.source })
      });
      const response = await fetchWithAuth(`/api/admin/security-logs?${queryParams}`, createAuthOptions());
      if (!response.ok) {
        toast.error(getSecurityLoadErrorMessage(response.status, t));
        throw new Error(`Failed to fetch logs: ${response.status}`);
      }
      const data = await response.json();
      setLogs(data.logs);
      setTotalCount(data.total || data.logs.length);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('[SecurityLogs] Error fetching logs:', error);
      }
    }
  }, [currentPage, filters, t]);

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / pageSize);

  // Pagination handler
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Reset page when filters change
  const handleFilterChange = (newFilters: Partial<SecurityLogFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  };

  const fetchStats = useCallback(async (): Promise<void> => {
    try {
      const response = await fetchWithAuth('/api/admin/security-stats', createAuthOptions());
      if (!response.ok) throw new Error(`Failed to fetch stats: ${response.status}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('[SecurityLogs] Error fetching stats:', error);
      }
    }
  }, []); // No dependencies - stats are global, not filtered

  const fetchFilterOptions = useCallback(async (): Promise<void> => {
    try {
      const response = await fetchWithAuth('/api/admin/security-filters', createAuthOptions());
      if (!response.ok) throw new Error(`Failed to fetch filter options: ${response.status}`);
      const data = await response.json();
      setFilterOptions(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Session expired')) {
        logger.error('[SecurityLogs] Error fetching filter options:', error);
      }
    }
  }, []);

  // Load data on mount and when fetchLogs changes (filters/page change)
  useEffect(() => {
    const loadData = async (): Promise<void> => {
      setLoading(true);
      await Promise.all([fetchLogs(), fetchStats(), fetchFilterOptions()]);
      setLoading(false);
    };
    loadData();
  }, [fetchLogs, fetchStats, fetchFilterOptions]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(async () => {
      try { 
        await Promise.all([fetchLogs(), fetchStats()]); 
      } catch (error: unknown) {
        if (error instanceof Error && (error.message.includes('401') || error.message.includes('403'))) {
          setAutoRefresh(false);
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs, fetchStats]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="text-xl">{t('security.loading')}</div></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="p-6">      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-8 rounded-full bg-primary-500" />
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">{t('security.title')}</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">{t('security.subtitle')}</p>
      </div>

      {stats && <SecurityStatsGrid stats={stats} onResetFilters={() => handleFilterChange({ level: '', event: '', source: '' })} t={t} />}

      <SecurityFiltersBar
        autoRefresh={autoRefresh}
        fetchLogs={fetchLogs}
        fetchStats={fetchStats}
        filters={filters}
        filterOptions={filterOptions}
        onAutoRefreshChange={(e: ChangeEvent<HTMLInputElement>) => setAutoRefresh(e.target.checked)}
        onClearFilters={() => setFilters({ level: '', event: '', source: '' })}
        onFilterChange={handleFilterChange}
        setLoading={setLoading}
        t={t}
      />

      <SecurityLogsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
        loading={loading}
        t={t}
      />

      <SecurityLogsTable logs={logs} t={t} />

      <SecurityLogsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
        loading={loading}
        t={t}
      />
    </motion.div>
  );
};

export default SecurityLogs;
