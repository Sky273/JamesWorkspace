import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthFetch } from '../hooks/useAuthFetch';
import {
  ShieldCheckIcon,
  FunnelIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  UserIcon,
  BuildingOfficeIcon,
  CpuChipIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import logger from '../utils/logger.frontend';

interface GdprAuditLog {
  id: string;
  action: string;
  category: string;
  firm_id: string | null;
  firm_name: string | null;
  user_id: string | null;
  user_name: string | null;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  target_email: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  is_automated: boolean;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface Firm {
  firm_id: string;
  firm_name: string;
  action_count: number;
}

interface ActionType {
  key: string;
  value: string;
  label: string;
}

interface Stats {
  period: string;
  total: number;
  byCategory: Record<string, number>;
  byAction: { action: string; count: number }[];
  automated: { automated: number; manual: number };
  dailyActivity: { date: string; count: number }[];
}

const GdprAuditPage = () => {
  const { t } = useTranslation();
  const { authGet } = useAuthFetch();

  // State
  const [logs, setLogs] = useState<GdprAuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [categories, setCategories] = useState<ActionType[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    firmId: '',
    action: '',
    category: '',
    isAutomated: '',
    targetEmail: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  // Fetch action types and categories
  const fetchActionTypes = useCallback(async () => {
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

  // Fetch firms
  const fetchFirms = useCallback(async () => {
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

  // Fetch stats
  const fetchStats = useCallback(async () => {
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

  // Fetch logs
  const fetchLogs = useCallback(async () => {
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

  // Initial load
  useEffect(() => {
    fetchActionTypes();
    fetchFirms();
  }, [fetchActionTypes, fetchFirms]);

  // Fetch logs when filters or page change
  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [fetchLogs, fetchStats]);

  // Reset page when filters change
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      firmId: '',
      action: '',
      category: '',
      isAutomated: '',
      targetEmail: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  };

  // Format action name for display
  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  // Get action icon
  const getActionIcon = (action: string, category: string) => {
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

  // Get category badge color
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      consent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      data: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      cv: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      automated: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      admin: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ShieldCheckIcon className="h-8 w-8 text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {t('gdprAudit.title', 'Journal RGPD')}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('gdprAudit.subtitle', 'Historique des actions de conformité RGPD')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                  showFilters
                    ? 'border-primary-500 text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <FunnelIcon className="h-4 w-4 mr-2" />
                {t('gdprAudit.filters', 'Filtres')}
              </button>
              <button
                onClick={() => { fetchLogs(); fetchStats(); }}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {t('gdprAudit.refresh', 'Actualiser')}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('gdprAudit.totalActions', 'Actions (30j)')}
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.total}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('gdprAudit.consentActions', 'Consentements')}
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {stats.byCategory.consent || 0}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('gdprAudit.automatedActions', 'Automatisées')}
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {stats.automated.automated}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('gdprAudit.manualActions', 'Manuelles')}
              </div>
              <div className="text-2xl font-bold text-green-600">
                {stats.automated.manual}
              </div>
            </div>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Firm filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <BuildingOfficeIcon className="h-4 w-4 inline mr-1" />
                  {t('gdprAudit.firm', 'Cabinet')}
                </label>
                <select
                  value={filters.firmId}
                  onChange={(e) => handleFilterChange('firmId', e.target.value)}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                >
                  <option value="">{t('gdprAudit.allFirms', 'Tous les cabinets')}</option>
                  {firms.map((firm) => (
                    <option key={firm.firm_id} value={firm.firm_id}>
                      {firm.firm_name} ({firm.action_count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('gdprAudit.category', 'Catégorie')}
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                >
                  <option value="">{t('gdprAudit.allCategories', 'Toutes')}</option>
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('gdprAudit.action', 'Action')}
                </label>
                <select
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                >
                  <option value="">{t('gdprAudit.allActions', 'Toutes')}</option>
                  {actionTypes.map((action) => (
                    <option key={action.value} value={action.value}>
                      {action.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Automated filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <CpuChipIcon className="h-4 w-4 inline mr-1" />
                  {t('gdprAudit.type', 'Type')}
                </label>
                <select
                  value={filters.isAutomated}
                  onChange={(e) => handleFilterChange('isAutomated', e.target.value)}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                >
                  <option value="">{t('gdprAudit.all', 'Tous')}</option>
                  <option value="true">{t('gdprAudit.automated', 'Automatisé')}</option>
                  <option value="false">{t('gdprAudit.manual', 'Manuel')}</option>
                </select>
              </div>

              {/* Target email filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('gdprAudit.targetEmail', 'Email cible')}
                </label>
                <input
                  type="text"
                  value={filters.targetEmail}
                  onChange={(e) => handleFilterChange('targetEmail', e.target.value)}
                  placeholder="email@example.com"
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                />
              </div>

              {/* Start date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('gdprAudit.startDate', 'Date début')}
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                />
              </div>

              {/* End date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('gdprAudit.endDate', 'Date fin')}
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                />
              </div>

              {/* Clear filters */}
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('gdprAudit.clearFilters', 'Effacer les filtres')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
          </div>
        )}

        {/* Logs Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('gdprAudit.dateTime', 'Date/Heure')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('gdprAudit.action', 'Action')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('gdprAudit.firm', 'Cabinet')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('gdprAudit.target', 'Cible')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('gdprAudit.type', 'Type')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('gdprAudit.details', 'Détails')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <ArrowPathIcon className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      {t('gdprAudit.noLogs', 'Aucune action RGPD enregistrée')}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getActionIcon(log.action, log.category)}
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {formatAction(log.action)}
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(log.category)}`}>
                              {log.category}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.firm_name ? (
                          <div className="flex items-center">
                            <BuildingOfficeIcon className="h-4 w-4 text-gray-400 mr-1" />
                            <span className="text-sm text-gray-900 dark:text-gray-100">{log.firm_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.target_name || log.target_email ? (
                          <div>
                            {log.target_name && (
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {log.target_name}
                              </div>
                            )}
                            {log.target_email && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {log.target_email}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.is_automated ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            <CpuChipIcon className="h-3 w-3 mr-1" />
                            Auto
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                            <UserIcon className="h-3 w-3 mr-1" />
                            Manuel
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <details className="cursor-pointer">
                            <summary className="text-primary-600 hover:text-primary-700">
                              {t('gdprAudit.viewDetails', 'Voir')}
                            </summary>
                            <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-auto max-w-xs">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('gdprAudit.showing', 'Affichage')} {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} {t('gdprAudit.of', 'sur')} {pagination.total}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrev}
                  className="p-2 rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={!pagination.hasNext}
                  className="p-2 rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GdprAuditPage;
