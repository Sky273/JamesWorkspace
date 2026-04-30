import { BuildingOfficeIcon, CpuChipIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { ActionType, Firm, GdprAuditFilters } from './types';

interface GdprAuditFiltersPanelProps {
  filters: GdprAuditFilters;
  firms: Firm[];
  categories: ActionType[];
  actionTypes: ActionType[];
  onFilterChange: (key: keyof GdprAuditFilters, value: string) => void;
  onClearFilters: () => void;
  t: TFunction;
}

export default function GdprAuditFiltersPanel({
  filters,
  firms,
  categories,
  actionTypes,
  onFilterChange,
  onClearFilters,
  t,
}: GdprAuditFiltersPanelProps): JSX.Element {
  return (
    <div className="gdpr-audit-filters-panel mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            <BuildingOfficeIcon className="mr-1 inline h-4 w-4" />
            {t('gdprAudit.firm', { defaultValue: 'Cabinet' })}
          </label>
          <select
            value={filters.firmId}
            onChange={(e) => onFilterChange('firmId', e.target.value)}
            className="gdpr-audit-field w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">
              {t('gdprAudit.allFirms', { defaultValue: 'Tous les cabinets' })}
            </option>
            {firms.map((firm) => (
              <option key={firm.firm_id} value={firm.firm_id}>
                {firm.firm_name} ({firm.action_count})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('gdprAudit.category', { defaultValue: 'Catégorie' })}
          </label>
          <select
            value={filters.category}
            onChange={(e) => onFilterChange('category', e.target.value)}
            className="gdpr-audit-field w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">
              {t('gdprAudit.allCategories', { defaultValue: 'Toutes' })}
            </option>
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('gdprAudit.action', { defaultValue: 'Action' })}
          </label>
          <select
            value={filters.action}
            onChange={(e) => onFilterChange('action', e.target.value)}
            className="gdpr-audit-field w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">
              {t('gdprAudit.allActions', { defaultValue: 'Toutes' })}
            </option>
            {actionTypes.map((action) => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            <CpuChipIcon className="mr-1 inline h-4 w-4" />
            {t('gdprAudit.type', { defaultValue: 'Type' })}
          </label>
          <select
            value={filters.isAutomated}
            onChange={(e) => onFilterChange('isAutomated', e.target.value)}
            className="gdpr-audit-field w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">{t('gdprAudit.all', { defaultValue: 'Tous' })}</option>
            <option value="true">
              {t('gdprAudit.automated', { defaultValue: 'Automatisé' })}
            </option>
            <option value="false">
              {t('gdprAudit.manual', { defaultValue: 'Manuel' })}
            </option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('gdprAudit.targetEmail', { defaultValue: 'Email cible' })}
          </label>
          <input
            type="text"
            value={filters.targetEmail}
            onChange={(e) => onFilterChange('targetEmail', e.target.value)}
            placeholder="email@example.com"
            className="gdpr-audit-field w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('gdprAudit.startDate', { defaultValue: 'Date début' })}
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange('startDate', e.target.value)}
            className="gdpr-audit-field w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('gdprAudit.endDate', { defaultValue: 'Date fin' })}
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange('endDate', e.target.value)}
            className="gdpr-audit-field w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={onClearFilters}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
          >
            {t('gdprAudit.clearFilters', { defaultValue: 'Effacer les filtres' })}
          </button>
        </div>
      </div>
    </div>
  );
}
