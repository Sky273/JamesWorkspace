import {
  ArrowPathIcon,
  BuildingOfficeIcon,
  CpuChipIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { GdprAuditLog } from './types';

interface GdprAuditLogsTableProps {
  logs: GdprAuditLog[];
  loading: boolean;
  formatDate: (dateStr: string) => string;
  formatAction: (action: string) => string;
  getActionIcon: (action: string, category: string) => JSX.Element;
  getCategoryColor: (category: string) => string;
  t: TFunction;
}

export default function GdprAuditLogsTable({
  logs,
  loading,
  formatDate,
  formatAction,
  getActionIcon,
  getCategoryColor,
  t,
}: GdprAuditLogsTableProps): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="gdpr-audit-table-head bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('gdprAudit.dateTime', { defaultValue: 'Date/Heure' })}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('gdprAudit.action', { defaultValue: 'Action' })}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('gdprAudit.firm', { defaultValue: 'Cabinet' })}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('gdprAudit.target', { defaultValue: 'Cible' })}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('gdprAudit.type', { defaultValue: 'Type' })}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t('gdprAudit.details', { defaultValue: 'Détails' })}
            </th>
          </tr>
        </thead>
        <tbody className="gdpr-audit-table-body divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
          {loading ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center">
                <ArrowPathIcon className="mx-auto h-6 w-6 animate-spin text-gray-400" />
              </td>
            </tr>
          ) : logs.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
              >
                {t('gdprAudit.noLogs', {
                  defaultValue: 'Aucune action RGPD enregistrée',
                })}
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(log.created_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center space-x-2">
                    {getActionIcon(log.action, log.category)}
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatAction(log.action)}
                      </div>
                      <span
                        className={`gdpr-audit-badge inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${getCategoryColor(log.category)}`}
                      >
                        {log.category}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {log.firm_name ? (
                    <div className="flex items-center">
                      <BuildingOfficeIcon className="mr-1 h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {log.firm_name}
                      </span>
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
                <td className="whitespace-nowrap px-4 py-3">
                  {log.is_automated ? (
                    <span className="gdpr-audit-badge inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      <CpuChipIcon className="mr-1 h-3 w-3" />
                      Auto
                    </span>
                  ) : (
                    <span className="gdpr-audit-badge inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                      <UserIcon className="mr-1 h-3 w-3" />
                      Manuel
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {log.details && Object.keys(log.details).length > 0 ? (
                    <details className="cursor-pointer">
                      <summary className="text-primary-600 hover:text-primary-700">
                        {t('gdprAudit.viewDetails', { defaultValue: 'Voir' })}
                      </summary>
                      <pre className="gdpr-audit-details-block mt-1 max-w-xs overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-900">
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
  );
}
