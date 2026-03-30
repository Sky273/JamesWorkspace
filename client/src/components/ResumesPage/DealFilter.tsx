/**
 * Deal Filter Component for Resumes Page
 * Allows filtering resumes by deal (affaire)
 */

import { useState, useEffect, useCallback } from 'react';
import { FolderIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';
import logger from '../../utils/logger.frontend';

interface Deal {
  id: string;
  title: string;
  client_name?: string;
  status: string;
  resumes_count: number;
}

interface DealFilterProps {
  selectedDealId: string;
  onDealChange: (dealId: string) => void;
  t: (key: string) => string;
}

const DealFilter = ({ selectedDealId, onDealChange, t }: DealFilterProps): JSX.Element => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true);
      const options = await createAuthOptionsWithCsrf({ method: 'GET' });
      const response = await fetchWithAuth('/api/deals?limit=100&status=open', options);
      if (response.ok) {
        const data = await response.json();
        setDeals(data.data || []);
      }
    } catch (error) {
      logger.error('Error fetching deals for filter:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const _selectedDeal = deals.find(d => d.id === selectedDealId);

  return (
    <div className="flex items-center gap-2">
      <FolderIcon className="w-5 h-5 text-gray-400" />
      <select
        value={selectedDealId}
        onChange={(e) => onDealChange(e.target.value)}
        disabled={loading}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm min-w-[200px]"
      >
        <option value="">{t('resumes.allDeals')}</option>
        {deals.map(deal => (
          <option key={deal.id} value={deal.id}>
            {deal.title} {deal.client_name ? `(${deal.client_name})` : ''} - {deal.resumes_count} CV
          </option>
        ))}
      </select>
      {selectedDealId && (
        <button
          onClick={() => onDealChange('')}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title={t('common.clear')}
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default DealFilter;
