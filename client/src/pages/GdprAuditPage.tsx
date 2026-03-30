import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthFetch } from '../hooks/useAuthFetch';
import {
  ArrowPathIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
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
  const { t } = useTranslation();
  const { authGet } = useAuthFetch();
  const tr = useCallback((key: string, fallback?: string): string => {
    return fallback ? t(key, { defaultValue: fallback }) : t(key);
  }, [t]);

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

  const fetchFirms = useCallback(async (): Promise<void> => {
    try {
      const response = await authGet('/api/gdpr-audit/firms');
      if (response.ok) {
        const data = await response.json();
        setFirms(data || []);
      }
    } catch (err) {
      logger.error('[GdprAudit] Failed to fetch firms:', err);
    }
  }, [authGet]);

  const fetchStats = useCallback(async (): Promise<void> => {
    try {
      const params = new URLSearchParams({ days: '30' });
      if (filters.firmId) params.append('firmId', filters.firmId);

      const response = await authGet(`/api/gdpr-audit/stats?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      logger.error('[GdprAudit] Failed to fetch stats:', err);
    }
  }, [authGet, filters.firmId]);

  const fetchLogs = useCallback(async (): Promise<void> => {
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
    if (action.includes('granted') || action.includes('active')) {
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    }
    if (action.includes('refused') || action.includes('expired') || action.includes('purge')) {
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-1 h-8 rounded-full bg-primary-500" />
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
                  {tr('gdprAudit.title', 'Journal RGPD')}
                </h1>
              </div>
              <p className="text-gray-500 dark:text-gray-400 ml-[1.75rem]">
                {tr('gdprAudit.subtitle', 'Historique des actions de conformit? RGPD')}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`btn btn-secondary inline-flex items-center px-3 py-2 text-sm font-medium ${showFilters ? 'ring-2 ring-primary-500' : ''}`}
              >
                <FunnelIcon className="h-4 w-4 mr-2" />
                {tr('gdprAudit.filters', 'Filtres')}
              </button>
              <button
                onClick={() => { void fetchLogs(); void fetchStats(); }}
                className="btn btn-primary inline-flex items-center px-3 py-2 text-sm font-medium"
              >
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {tr('gdprAudit.refresh', 'Actualiser')}
              </button>
            </div>
          </div>
        </div>

        <GdprAuditStatsGrid stats={stats} t={tr} />

        {showFilters && (
          <GdprAuditFiltersPanel
            filters={filters}
            firms={firms}
            categories={categories}
            actionTypes={actionTypes}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
            t={tr}
          />
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <GdprAuditLogsTable
            logs={logs}
            loading={loading}
            formatDate={formatDate}
            formatAction={formatAction}
            getActionIcon={getActionIcon}
            getCategoryColor={getCategoryColor}
            t={tr}
          />
          <GdprAuditPagination pagination={pagination} onPageChange={setPage} t={tr} />
        </div>
      </div>
    </div>
  );
};

export default GdprAuditPage;
