import { BuildingOfficeIcon, CpuChipIcon } from '@heroicons/react/24/outline';
import type { ActionType, Firm, GdprAuditFilters } from './types';

interface GdprAuditFiltersPanelProps {
  filters: GdprAuditFilters;
  firms: Firm[];
  categories: ActionType[];
  actionTypes: ActionType[];
  onFilterChange: (key: keyof GdprAuditFilters, value: string) => void;
  onClearFilters: () => void;
  t: (key: string, fallback?: string) => string;
}

export default function GdprAuditFiltersPanel({
  filters,
  firms,
  categories,
  actionTypes,
  onFilterChange,
  onClearFilters,
  t
}: GdprAuditFiltersPanelProps): JSX.Element {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <BuildingOfficeIcon className="h-4 w-4 inline mr-1" />
            {t('gdprAudit.firm', 'Cabinet')}
          </label>
          <select
            value={filters.firmId}
            onChange={(e) => onFilterChange('firmId', e.target.value)}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('gdprAudit.category', 'Catégorie')}
          </label>
          <select
            value={filters.category}
            onChange={(e) => onFilterChange('category', e.target.value)}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('gdprAudit.action', 'Action')}
          </label>
          <select
            value={filters.action}
            onChange={(e) => onFilterChange('action', e.target.value)}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <CpuChipIcon className="h-4 w-4 inline mr-1" />
            {t('gdprAudit.type', 'Type')}
          </label>
          <select
            value={filters.isAutomated}
            onChange={(e) => onFilterChange('isAutomated', e.target.value)}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
          >
            <option value="">{t('gdprAudit.all', 'Tous')}</option>
            <option value="true">{t('gdprAudit.automated', 'Automatis?sé')}</option>
            <option value="false">{t('gdprAudit.manual', 'Manuel')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('gdprAudit.targetEmail', 'Email cible')}
          </label>
          <input
            type="text"
            value={filters.targetEmail}
            onChange={(e) => onFilterChange('targetEmail', e.target.value)}
            placeholder="email@example.com"
            className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('gdprAudit.startDate', 'Date début')}
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange('startDate', e.target.value)}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('gdprAudit.endDate', 'Date fin')}
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange('endDate', e.target.value)}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={onClearFilters}
            className="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {t('gdprAudit.clearFilters', 'Effacer les filtres')}
          </button>
        </div>
      </div>
    </div>
  );
}
