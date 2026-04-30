import type { TFunction } from 'i18next';
import type { Stats } from './types';

interface GdprAuditStatsGridProps {
  stats: Stats | null;
  t: TFunction;
}

export default function GdprAuditStatsGrid({
  stats,
  t,
}: GdprAuditStatsGridProps): JSX.Element | null {
  if (!stats) {
    return null;
  }

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
      <div className="gdpr-audit-stat-card rounded-lg bg-white p-4 shadow dark:bg-gray-800">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {t('gdprAudit.totalActions', { defaultValue: 'Actions (30j)' })}
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {stats.total}
        </div>
      </div>
      <div className="gdpr-audit-stat-card rounded-lg bg-white p-4 shadow dark:bg-gray-800">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {t('gdprAudit.consentActions', { defaultValue: 'Consentements' })}
        </div>
        <div className="text-2xl font-bold text-blue-600">
          {stats.byCategory.consent || 0}
        </div>
      </div>
      <div className="gdpr-audit-stat-card rounded-lg bg-white p-4 shadow dark:bg-gray-800">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {t('gdprAudit.automatedActions', { defaultValue: 'Automatisées' })}
        </div>
        <div className="text-2xl font-bold text-purple-600">
          {stats.automated.automated}
        </div>
      </div>
      <div className="gdpr-audit-stat-card rounded-lg bg-white p-4 shadow dark:bg-gray-800">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {t('gdprAudit.manualActions', { defaultValue: 'Manuelles' })}
        </div>
        <div className="text-2xl font-bold text-green-600">
          {stats.automated.manual}
        </div>
      </div>
    </div>
  );
}
