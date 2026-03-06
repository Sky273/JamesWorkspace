/**
 * Admin Firm Selector Component
 * Allows administrators to select a firm when creating/editing items
 * Only visible to admin users
 */

import { useState, useEffect } from 'react';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import userService from '../utils/userService';

interface Firm {
  id: string;
  name: string;
}

interface AdminFirmSelectorProps {
  selectedFirmId: string;
  onFirmChange: (firmId: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}

// Special value to indicate "my firm" selection
const MY_FIRM_VALUE = '__MY_FIRM__';

const AdminFirmSelector = ({
  selectedFirmId,
  onFirmChange,
  label,
  className = '',
  disabled = false,
  t
}: AdminFirmSelectorProps): JSX.Element | null => {
  const { user } = useAuth();
  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userFirmId, setUserFirmId] = useState<string>('');

  // Only show for admin users
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  useEffect(() => {
    const loadFirms = async () => {
      if (!isAdmin) {
        setLoading(false);
        return;
      }

      try {
        const response = await userService.getCustomersPaginated({ page: 1, pageSize: 100 });
        const firmsList = response.customers || response || [];
        setFirms(firmsList);
        
        // Find user's firm_id from the firms list using user.firm name
        const userFirmName = user?.firm;
        if (userFirmName) {
          const userFirm = firmsList.find((f: Firm) => f.name === userFirmName);
          if (userFirm) {
            setUserFirmId(userFirm.id);
            // If no firm is selected yet, default to user's firm
            if (!selectedFirmId) {
              onFirmChange(userFirm.id);
            }
          }
        }
      } catch (error) {
        console.error('[AdminFirmSelector] Failed to load firms:', error);
        setFirms([]);
      } finally {
        setLoading(false);
      }
    };

    loadFirms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, user?.firm]);

  // Don't render anything for non-admin users
  if (!isAdmin) {
    return null;
  }

  // Handle selection change - convert MY_FIRM_VALUE to actual user firm_id
  const handleChange = (value: string) => {
    if (value === MY_FIRM_VALUE) {
      onFirmChange(userFirmId);
    } else {
      onFirmChange(value);
    }
  };

  // Determine the display value for the select
  // If selectedFirmId matches userFirmId, show MY_FIRM_VALUE
  const displayValue = selectedFirmId === userFirmId ? MY_FIRM_VALUE : selectedFirmId;

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        <span className="flex items-center gap-2">
          <BuildingOfficeIcon className="w-4 h-4 text-purple-500" />
          {label || t('common.selectFirm', 'Cabinet')}
          <span className="text-xs text-purple-500 font-normal">(Admin)</span>
        </span>
      </label>
      <select
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled || loading}
        className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
      >
        <option value={MY_FIRM_VALUE}>
          {loading 
            ? t('common.loading', 'Chargement...') 
            : t('common.myFirm', 'Mon cabinet (par défaut)')}
        </option>
        {firms.filter(firm => firm.id !== userFirmId).map((firm) => (
          <option key={firm.id} value={firm.id}>
            {firm.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
        {t('common.adminFirmHint', 'En tant qu\'admin, vous pouvez créer cet élément pour un autre cabinet')}
      </p>
    </div>
  );
};

export default AdminFirmSelector;
