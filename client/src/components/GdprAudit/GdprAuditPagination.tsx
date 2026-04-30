import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { Pagination } from './types';

interface GdprAuditPaginationProps {
  pagination: Pagination | null;
  onPageChange: (page: number) => void;
  t: TFunction;
}

export default function GdprAuditPagination({
  pagination,
  onPageChange,
  t,
}: GdprAuditPaginationProps): JSX.Element | null {
  if (!pagination || pagination.totalPages <= 1) {
    return null;
  }

  return (
    <div className="gdpr-audit-pagination flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {t('gdprAudit.showing', { defaultValue: 'Affichage' })}{' '}
        {(pagination.page - 1) * pagination.limit + 1} -{' '}
        {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
        {t('gdprAudit.of', { defaultValue: 'sur' })} {pagination.total}
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
          disabled={!pagination.hasPrev}
          className="rounded-md border border-gray-300 p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {pagination.page} / {pagination.totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
          disabled={!pagination.hasNext}
          className="rounded-md border border-gray-300 p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
