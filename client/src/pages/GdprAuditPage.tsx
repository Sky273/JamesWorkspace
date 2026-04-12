import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuthFetch } from '../hooks/useAuthFetch';
import {
  ArrowPathIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  TrashIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import PageHeader from '../components/page/PageHeader';
import logger from '../utils/logger.frontend';
import type { ActionType, Firm, GdprAuditFilters, GdprAuditLog, Pagination, Stats } from '../components/GdprAudit/types';
import GdprAuditStatsGrid from '../components/GdprAudit/GdprAuditStatsGrid';
import GdprAuditFiltersPanel from '../components/GdprAudit/GdprAuditFiltersPanel';
import GdprAuditLogsTable from '../components/GdprAudit/GdprAuditLogsTable';
import GdprAuditPagination from '../components/GdprAudit/GdprAuditPagination';

const DEFAULT_FILTERS: GdprAuditFilters = {
  firmId: '',
  action: '',
  category: '',
  isAutomated: '',
  targetEmail: '',
  startDate: '',
  endDate: '',
};

const GdprAuditPage = (): JSX.Element => {
  const { authGet } = useAuthFetch();
  const { t } = useTranslation();

  const [logs, setLogs] = useState<GdprAuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [categories, setCategories] = useState<ActionType[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GdprAuditFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const fetchActionTypes = useCallback(async (): Promise<void> => {
    try {
      const response = await authGet('/api/gdpr-audit/actions');
      if (response.ok) {
        const data = await response.json();
        setActionTypes(data.actions || []);
        setCategories(data.categories || []);
      }
    } catch (err) {
      logger.error('[GdprAudit] Failed to fetch action types:', err);
    }
  }, [authGet]);

  const fetchFirms = useCallback(async (forceRefresh = false): Promise<void> => {
    try {
      const suffix = forceRefresh ? '?refresh=1' : '';
      const response = await authGet(`/api/gdpr-audit/firms${suffix}`);
      if (response.ok) {
        const data = await response.json();
        setFirms(data || []);
      }
    } catch (err) {
      logger.error('[GdprAudit] Failed to fetch firms:', err);
    }
  }, [authGet]);

  const fetchStats = useCallback(async (forceRefresh = false): Promise<void> => {
    try {
      const params = new URLSearchParams({ days: '30' });
      if (filters.firmId) params.append('firmId', filters.firmId);
      if (forceRefresh) params.append('refresh', '1');

      const response = await authGet(`/api/gdpr-audit/stats?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      logger.error('[GdprAudit] Failed to fetch stats:', err);
    }
  }, [authGet, filters.firmId]);

  const fetchLogs = useCallback(async (forceRefresh = false): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      });

      if (filters.firmId) params.append('firmId', filters.firmId);
      if (filters.action) params.append('action', filters.action);
      if (filters.category) params.append('category', filters.category);
      if (filters.isAutomated) params.append('isAutomated', filters.isAutomated);
      if (filters.targetEmail) params.append('targetEmail', filters.targetEmail);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (forceRefresh) params.append('refresh', '1');

      const response = await authGet(`/api/gdpr-audit/logs?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setPagination(data.pagination || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [authGet, page, filters]);

  useEffect(() => {
    void fetchActionTypes();
    void fetchFirms();
  }, [fetchActionTypes, fetchFirms]);

  useEffect(() => {
    void fetchLogs();
    void fetchStats();
  }, [fetchLogs, fetchStats]);

  const handleFilterChange = (key: keyof GdprAuditFilters, value: string): void => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = (): void => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const formatAction = (action: string): string => {
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  const getActionIcon = (action: string, category: string): JSX.Element => {
    if (action.includes('purged') || action === 'auto_purge_executed') {
      return <TrashIcon className="h-5 w-5 text-amber-500" />;
    }
    if (action.includes('granted') || action.includes('active')) {
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    }
    if (action.includes('refused') || action.includes('expired')) {
      return <XCircleIcon className="h-5 w-5 text-red-500" />;
    }
    if (action.includes('reminder') || action.includes('request')) {
      return <ClockIcon className="h-5 w-5 text-yellow-500" />;
    }
    if (category === 'automated') {
      return <CpuChipIcon className="h-5 w-5 text-purple-500" />;
    }
    return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      consent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      data: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      cv: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      automated: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      admin: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="cv-surface app-page-shell max-w-6xl"
    >
      <div className="mb-8 flex items-start justify-between gap-4">
        <PageHeader
          title={t('gdprAudit.title')}
          subtitle={t('gdprAudit.subtitle')}
        />
        <div className="mt-4 flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`cv-ghost-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium ${showFilters ? 'ring-2 ring-[color:color-mix(in_srgb,var(--cv-primary)_25%,transparent)]' : ''}`}
          >
            <FunnelIcon className="mr-2 h-4 w-4" />
            {t('gdprAudit.filters')}
          </button>
          <button
            onClick={() => { void fetchLogs(true); void fetchStats(true); void fetchFirms(true); }}
            className="cv-gradient-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold"
          >
            <ArrowPathIcon className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('gdprAudit.refresh')}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="section-shell rounded-[2rem] p-6">
          <GdprAuditStatsGrid stats={stats} t={t} />
        </div>

        {showFilters && (
          <div className="section-shell rounded-[2rem] p-6">
            <GdprAuditFiltersPanel
              filters={filters}
              firms={firms}
              categories={categories}
              actionTypes={actionTypes}
              onFilterChange={handleFilterChange}
              onClearFilters={clearFilters}
              t={t}
            />
          </div>
        )}

        {error && (
          <div className="section-shell rounded-[2rem] border border-red-200/70 bg-red-50/70 p-4 dark:border-red-800/70 dark:bg-red-900/15">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="mr-2 h-5 w-5 text-red-500" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
          </div>
        )}

        {!loading && !error && logs.length === 0 ? (
          <div className="section-shell rounded-[2rem] p-8 text-center">
            <InformationCircleIcon className="mx-auto h-10 w-10 text-gray-400" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('gdprAudit.noLogs')}
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {hasActiveFilters
                ? 'Clear the current filters to broaden the audit window.'
                : 'Refresh the audit log to fetch the latest entries.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="cv-ghost-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium"
                >
                  {t('gdprAudit.clearFilters')}
                </button>
              )}
              <button
                type="button"
                onClick={() => { void fetchLogs(true); void fetchStats(true); void fetchFirms(true); }}
                className="cv-gradient-button inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold"
              >
                {t('gdprAudit.refresh')}
              </button>
            </div>
          </div>
        ) : (
          <div className="section-shell overflow-hidden rounded-[2rem]">
            <GdprAuditLogsTable
              logs={logs}
              loading={loading}
              formatDate={formatDate}
              formatAction={formatAction}
              getActionIcon={getActionIcon}
              getCategoryColor={getCategoryColor}
              t={t}
            />
            <GdprAuditPagination pagination={pagination} onPageChange={setPage} t={t} />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default GdprAuditPage;
