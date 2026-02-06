/**
 * ResetFiltersButton Component
 * Harmonized button for resetting filters across all pages
 */

import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface ResetFiltersButtonProps {
  onReset: () => void;
  disabled?: boolean;
  className?: string;
}

const ResetFiltersButton = ({
  onReset,
  disabled = false,
  className = ''
}: ResetFiltersButtonProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <button
      onClick={onReset}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg 
        bg-gray-100 dark:bg-gray-700 
        text-gray-700 dark:text-gray-300 
        hover:bg-gray-200 dark:hover:bg-gray-600 
        disabled:opacity-50 disabled:cursor-not-allowed 
        transition-colors ${className}`}
      title={t('common.resetFilters')}
    >
      <XMarkIcon className="w-4 h-4" />
      <span className="hidden sm:inline">{t('common.resetFilters')}</span>
    </button>
  );
};

export default ResetFiltersButton;
