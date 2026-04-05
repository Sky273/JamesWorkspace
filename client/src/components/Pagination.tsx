import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  itemName?: string;
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

  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 3) {
      for (let i = 1; i <= maxVisible; i++) pages.push(i);
    } else if (currentPage >= totalPages - 2) {
      for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) pages.push(i);
    } else {
      for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
    }

    return pages;
  };

  return (
    <div className="section-shell mt-6 rounded-[22px] px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('common.showing')} <span className="font-semibold text-slate-900 dark:text-slate-50">{from}-{to}</span> {t('common.of')}{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-50">{totalCount}</span>
            {itemName && ` ${itemName}`}
          </p>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            {t('common.page', 'Page')} {currentPage} / {totalPages}
          </p>
        </div>

        {showNavigation && (
          <nav aria-label={itemName ? `${itemName} pagination` : 'Pagination'} className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="app-button-secondary rounded-2xl px-3 py-2 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              title={t('common.first')}
            >
              {t('common.first')}
            </button>

            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="app-button-secondary rounded-2xl p-2.5 transition-all disabled:cursor-not-allowed disabled:opacity-50"
              title={t('common.previous')}
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>

            <div className="hidden sm:flex items-center gap-2">
              {getPageNumbers().map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => goToPage(pageNum)}
                  aria-current={currentPage === pageNum ? 'page' : undefined}
                  className={`rounded-2xl px-3.5 py-2 text-sm font-medium transition-all ${
                    currentPage === pageNum
                      ? 'app-button-primary'
                      : 'app-button-secondary'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <span className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 sm:hidden">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="app-button-secondary rounded-2xl p-2.5 transition-all disabled:cursor-not-allowed disabled:opacity-50"
              title={t('common.next')}
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="app-button-secondary rounded-2xl px-3 py-2 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              title={t('common.last')}
            >
              {t('common.last')}
            </button>
          </nav>
        )}
      </div>
    </div>
  );
};

export default Pagination;
