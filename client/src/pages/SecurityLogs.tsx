/**
 * SecurityLogs Page
 * TypeScript version
 */

import { useState, useEffect, ChangeEvent, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { ShieldCheckIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { fetchWithAuth, createAuthOptions } from '../utils/apiInterceptor';
import Pagination from '../components/Pagination';
import logger from '../utils/logger.frontend';
import { formatDateTime } from '../utils/dateFormatter';
import Breadcrumbs from '../components/Breadcrumbs';

interface Log {
  timestamp: string;
  source?: string;
  level?: string;
  event?: string;
  email?: string;
  role?: string;
  customer?: string;
  ip?: string;
  action?: string;
  method?: string;
  endpoint?: string;
  resourceType?: string;
  resourceId?: string;
  statusCode?: number;
  message?: string;
  duration?: number;
}

interface Stats {
  total: number;
  recent: { lastHour: number; last24h: number };
  byLevel: Record<string, number>;
}

interface Filters {
  level: string;
  event: string;
  source: string;
}

interface FilterOptions {
  levels: string[];
  events: string[];
  sources: string[];
}

const SecurityLogs = (): JSX.Element => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filters, setFilters] = useState<Filters>({ level: '', event: '', source: '' });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ levels: [], events: [], sources: [] });
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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (response.status === 403) toast.error(t('security.accessDenied'));
        else if (response.status === 401) toast.error(t('security.sessionExpired'));
        else toast.error(`${t('common.error')} ${response.status}: ${errorData.error}`);
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
  const handleFilterChange = (newFilters: Partial<Filters>) => {
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

  const getLevelIcon = (level?: string): JSX.Element => {
    switch (level) {
      case 'SECURITY': return <ShieldCheckIcon className="w-5 h-5 text-red-500" />;
      case 'ERROR': return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'WARNING': return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'INFO': return <InformationCircleIcon className="w-5 h-5 text-blue-500" />;
      default: return <InformationCircleIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getLevelColor = (level?: string): string => {
    switch (level) {
      case 'SECURITY': case 'ERROR': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'WARNING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'INFO': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'DEBUG': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    return formatDateTime(timestamp, true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="text-xl">{t('security.loading')}</div></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="p-6">
      <Breadcrumbs className="mb-4" />
      
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-8 rounded-full bg-primary-500" />
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">{t('security.title')}</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">{t('security.subtitle')}</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600 transition-all"
            onClick={() => handleFilterChange({ level: '', event: '', source: '' })}
          >
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('security.totalLogs')}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ delay: 0.1 }} 
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
          >
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('security.lastHour')}</div>
            <div className="text-2xl font-bold text-blue-600">{stats.recent.lastHour}</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ delay: 0.2 }} 
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
          >
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('security.last24h')}</div>
            <div className="text-2xl font-bold text-green-600">{stats.recent.last24h}</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ delay: 0.3 }} 
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
          >
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('security.errors')}</div>
            <div className="text-2xl font-bold text-red-600">{stats.byLevel.ERROR || 0}</div>
          </motion.div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('security.filters.level')}</label>
            <select value={filters.level} onChange={(e: ChangeEvent<HTMLSelectElement>) => handleFilterChange({ level: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              <option value="">{t('security.filters.all')}</option>
              {filterOptions.levels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('security.filters.event')}</label>
            <select value={filters.event} onChange={(e: ChangeEvent<HTMLSelectElement>) => handleFilterChange({ event: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              <option value="">{t('security.filters.all')}</option>
              {filterOptions.events.map(event => (
                <option key={event} value={event}>{event}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('security.filters.source')}</label>
            <select value={filters.source} onChange={(e: ChangeEvent<HTMLSelectElement>) => handleFilterChange({ source: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              <option value="">{t('security.filters.allSources')}</option>
              {filterOptions.sources.map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={(e: ChangeEvent<HTMLInputElement>) => setAutoRefresh(e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('security.autoRefresh')}</span>
            </label>
            <button onClick={async () => { setLoading(true); await Promise.all([fetchLogs(), fetchStats()]); setLoading(false); }} className="btn btn-primary px-4 py-2 text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              {t('security.refresh')}
            </button>
            {(filters.level || filters.event || filters.source) && (
              <button
                onClick={() => setFilters({ level: '', event: '', source: '' })}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title={t('common.resetFilters')}
              >
                <XMarkIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{t('common.resetFilters')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
        loading={loading}
        itemName={t('security.logs')}
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('security.table.timestamp')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('security.table.source')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('security.table.level')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('security.table.event')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('security.table.user')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('security.table.customer')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('security.table.ip')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('security.table.action')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('security.table.status')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('security.table.message')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {logs.map((log, index) => (
                <motion.tr key={index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.02 }} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">{formatTimestamp(log.timestamp)}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><span className={`px-2 py-1 text-xs font-semibold rounded ${log.source === 'security' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>{log.source === 'security' ? t('security.badges.security') : t('security.badges.proxy')}</span></td>
                  <td className="px-4 py-3 whitespace-nowrap"><div className="flex items-center space-x-2">{getLevelIcon(log.level)}<span className={`px-2 py-1 text-xs font-semibold rounded ${getLevelColor(log.level)}`}>{log.level}</span></div></td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">{log.event}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300"><div><div className="font-medium">{log.email || '-'}</div>{log.role && <div className="text-xs text-gray-500 dark:text-gray-400">{log.role}</div>}</div></td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">{log.customer || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">{log.ip}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300"><div>{log.action && <div className="font-medium">{log.action}</div>}{log.method && log.endpoint && <div className="text-xs text-gray-500 dark:text-gray-400">{log.method} {log.endpoint}</div>}{log.resourceType && log.resourceId && <div className="text-xs text-gray-500 dark:text-gray-400">{log.resourceType}: {log.resourceId.substring(0, 8)}...</div>}</div></td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{log.statusCode && <span className={`px-2 py-1 text-xs font-semibold rounded ${log.statusCode >= 500 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : log.statusCode >= 400 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : log.statusCode >= 200 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>{log.statusCode}</span>}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300"><div><div>{log.message}</div>{log.duration && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('security.table.duration')}: {log.duration}ms</div>}</div></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 && <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t('security.noLogs')}</div>}
      </div>

      {/* Pagination controls */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={goToPage}
        loading={loading}
        itemName={t('security.logs')}
      />
    </motion.div>
  );
};

export default SecurityLogs;
