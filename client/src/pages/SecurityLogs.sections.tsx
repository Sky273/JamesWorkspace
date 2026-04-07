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
          <label className="flex cursor-pointer items-center space-x-2">
            <input type="checkbox" checked={autoRefresh} onChange={onAutoRefreshChange} className="rounded" />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('security.autoRefresh')}</span>
          </label>
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
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300"><div><div>{log.message}</div>{log.duration && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('security.table.duration')}: {log.duration}ms</div>}</div></td>
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
