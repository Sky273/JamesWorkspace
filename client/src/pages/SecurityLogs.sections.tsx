import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ChangeEvent } from 'react';
import type { TFunction } from 'i18next';
import Pagination from '../components/Pagination';
import type {
  SecurityLogEntry,
  SecurityLogFilters,
  SecurityLogFilterOptions,
  SecurityLogStats,
} from './SecurityLogs.types';
import {
  formatSecurityTimestamp,
  getSecurityLevelColor,
  getSecurityLevelIcon,
  getSecuritySourceBadgeClass,
  getSecurityStatusCodeClass,
} from './SecurityLogs.utils';

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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600 transition-all"
        onClick={onResetFilters}
      >
        <div className="text-sm text-gray-600 dark:text-gray-400">{t('security.totalLogs')}</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">{t('security.lastHour')}</div>
        <div className="text-2xl font-bold text-blue-600">{stats.recent.lastHour}</div>
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">{t('security.last24h')}</div>
        <div className="text-2xl font-bold text-green-600">{stats.recent.last24h}</div>
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">{t('security.errors')}</div>
        <div className="text-2xl font-bold text-red-600">{stats.byLevel.ERROR || 0}</div>
      </motion.div>
    </div>
  );
}

interface FiltersBarProps {
  autoRefresh: boolean;
  fetchLogs: () => Promise<void>;
  fetchStats: () => Promise<void>;
  filters: SecurityLogFilters;
  filterOptions: SecurityLogFilterOptions;
  onAutoRefreshChange: (event: ChangeEvent<HTMLInputElement>) => void;
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
      <div className="flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('security.filters.level')}</label>
          <select value={filters.level} onChange={(e) => onFilterChange({ level: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <option value="">{t('security.filters.all')}</option>
            {filterOptions.levels.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('security.filters.event')}</label>
          <select value={filters.event} onChange={(e) => onFilterChange({ event: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <option value="">{t('security.filters.all')}</option>
            {filterOptions.events.map((event) => (
              <option key={event} value={event}>{event}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('security.filters.source')}</label>
          <select value={filters.source} onChange={(e) => onFilterChange({ source: e.target.value })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <option value="">{t('security.filters.allSources')}</option>
            {filterOptions.sources.map((source) => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={onAutoRefreshChange} className="rounded" />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('security.autoRefresh')}</span>
          </label>
          <button
            onClick={async () => {
              setLoading(true);
              await Promise.all([fetchLogs(), fetchStats()]);
              setLoading(false);
            }}
            className="btn btn-primary px-4 py-2 text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {t('security.refresh')}
          </button>
          {(filters.level || filters.event || filters.source) && (
            <button
              onClick={onClearFilters}
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
  );
}

export function SecurityLogsTable({ logs, t }: { logs: SecurityLogEntry[]; t: TFunction }): JSX.Element {
  return (
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
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">{formatSecurityTimestamp(log.timestamp)}</td>
                <td className="px-4 py-3 whitespace-nowrap"><span className={`px-2 py-1 text-xs font-semibold rounded ${getSecuritySourceBadgeClass(log.source)}`}>{log.source === 'security' ? t('security.badges.security') : t('security.badges.proxy')}</span></td>
                <td className="px-4 py-3 whitespace-nowrap"><div className="flex items-center space-x-2">{getSecurityLevelIcon(log.level)}<span className={`px-2 py-1 text-xs font-semibold rounded ${getSecurityLevelColor(log.level)}`}>{log.level}</span></div></td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">{log.event}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300"><div><div className="font-medium">{log.email || '-'}</div>{log.role && <div className="text-xs text-gray-500 dark:text-gray-400">{log.role}</div>}</div></td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">{log.customer || '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">{log.ip}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300"><div>{log.action && <div className="font-medium">{log.action}</div>}{log.method && log.endpoint && <div className="text-xs text-gray-500 dark:text-gray-400">{log.method} {log.endpoint}</div>}{log.resourceType && log.resourceId && <div className="text-xs text-gray-500 dark:text-gray-400">{log.resourceType}: {log.resourceId.substring(0, 8)}...</div>}</div></td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">{log.statusCode && <span className={`px-2 py-1 text-xs font-semibold rounded ${getSecurityStatusCodeClass(log.statusCode)}`}>{log.statusCode}</span>}</td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300"><div><div>{log.message}</div>{log.duration && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('security.table.duration')}: {log.duration}ms</div>}</div></td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {logs.length === 0 && <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t('security.noLogs')}</div>}
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
