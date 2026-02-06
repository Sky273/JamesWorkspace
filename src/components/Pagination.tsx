/**
 * Reusable Pagination Component
 * Provides consistent pagination UI across all pages
 */

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  itemName?: string; // e.g., 'resumes', 'missions', etc.
}

export interface PaginationInfo {
  showing: {
    from: number;
    to: number;
  };
  total: number;
}

const Pagination = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  loading = false,
  itemName
}: PaginationProps): JSX.Element | null => {
  const { t } = useTranslation();

  // Don't render if loading or no data
  if (loading || totalCount === 0) {
    return null;
  }

  const from = ((currentPage - 1) * pageSize) + 1;
  const to = Math.min(currentPage * pageSize, totalCount);
  const showNavigation = totalPages > 1;

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  // Generate page numbers to display (max 5)
  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else if (currentPage <= 3) {
      for (let i = 1; i <= maxVisible; i++) {
        pages.push(i);
      }
    } else if (currentPage >= totalPages - 2) {
      for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      for (let i = currentPage - 2; i <= currentPage + 2; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-2">
      {/* Info text */}
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('common.showing')} <span className="font-medium">{from}-{to}</span> {t('common.of')}{' '}
        <span className="font-medium">{totalCount}</span>
        {itemName && ` ${itemName}`}
      </p>

      {/* Navigation buttons - only show if more than one page */}
      {showNavigation && (
      <div className="flex items-center gap-1 sm:gap-2">
        {/* First */}
        <button
          onClick={() => goToPage(1)}
          disabled={currentPage === 1}
          className="px-2 sm:px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600 text-xs sm:text-sm transition-colors"
          title={t('common.first')}
        >
          {t('common.first')}
        </button>

        {/* Previous */}
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title={t('common.previous')}
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>

        {/* Page numbers */}
        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers().map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => goToPage(pageNum)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                currentPage === pageNum
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {pageNum}
            </button>
          ))}
        </div>

        {/* Mobile: current page indicator */}
        <span className="sm:hidden px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
          {currentPage} / {totalPages}
        </span>

        {/* Next */}
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title={t('common.next')}
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>

        {/* Last */}
        <button
          onClick={() => goToPage(totalPages)}
          disabled={currentPage === totalPages}
          className="px-2 sm:px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600 text-xs sm:text-sm transition-colors"
          title={t('common.last')}
        >
          {t('common.last')}
        </button>
      </div>
      )}
    </div>
  );
};

export default Pagination;
