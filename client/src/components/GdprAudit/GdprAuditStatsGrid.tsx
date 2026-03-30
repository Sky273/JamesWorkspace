import type { Stats } from './types';

interface GdprAuditStatsGridProps {
  stats: Stats | null;
  t: (key: string, fallback?: string) => string;
}

export default function GdprAuditStatsGrid({ stats, t }: GdprAuditStatsGridProps): JSX.Element | null {
  if (!stats) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="text-sm text-gray-500 dark:text-gray-400">{t('gdprAudit.totalActions', 'Actions (30j)')}</div>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="text-sm text-gray-500 dark:text-gray-400">{t('gdprAudit.consentActions', 'Consentements')}</div>
        <div className="text-2xl font-bold text-blue-600">{stats.byCategory.consent || 0}</div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="text-sm text-gray-500 dark:text-gray-400">{t('gdprAudit.automatedActions', 'Automatis?sées')}</div>
        <div className="text-2xl font-bold text-purple-600">{stats.automated.automated}</div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="text-sm text-gray-500 dark:text-gray-400">{t('gdprAudit.manualActions', 'Manuelles')}</div>
        <div className="text-2xl font-bold text-green-600">{stats.automated.manual}</div>
      </div>
    </div>
  );
}
