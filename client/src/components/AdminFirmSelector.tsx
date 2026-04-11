/**
 * Admin Firm Selector Component
 * Allows administrators to select a firm when creating/editing items
 * Only visible to admin users
 */

import { useState, useEffect } from 'react';
import { TFunction } from 'i18next';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import userService from '../utils/userService';
import logger from '../utils/logger.frontend';

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
  firms?: Firm[];
  showForLocalAdmin?: boolean;
  t: TFunction;
}

const MY_FIRM_VALUE = '__MY_FIRM__';

const AdminFirmSelector = ({
  selectedFirmId,
  onFirmChange,
  label,
  className = '',
  disabled = false,
  firms: providedFirms,
  showForLocalAdmin = false,
  t,
}: AdminFirmSelectorProps): JSX.Element | null => {
  const { user } = useAuth();
  const [firms, setFirms] = useState<Firm[]>(providedFirms || []);
  const [loading, setLoading] = useState<boolean>(true);
  const [userFirmId, setUserFirmId] = useState<string>('');

  const isSuperAdmin = user?.role === 'admin';
  const isLocalAdmin = user?.role === 'localAdmin';
  const canUseSelector = isSuperAdmin || (showForLocalAdmin && isLocalAdmin);

  useEffect(() => {
    setFirms(providedFirms || []);
  }, [providedFirms]);

  useEffect(() => {
    const currentUserFirmId = user?.firmId || user?.firm_id || '';
    setUserFirmId(currentUserFirmId);
  }, [user?.firmId, user?.firm_id]);

  useEffect(() => {
    const loadFirms = async () => {
      if (!canUseSelector) {
        setLoading(false);
        return;
      }

      if (providedFirms) {
        setLoading(false);
        return;
      }

      if (!isSuperAdmin) {
        setFirms([]);
        setLoading(false);
        return;
      }

      try {
        const response = await userService.getCustomersPaginated({ page: 1, pageSize: 100 });
        const firmsList = response.customers || response || [];
        setFirms(firmsList);
      } catch (error) {
        logger.error('[AdminFirmSelector] Failed to load firms:', error);
        setFirms([]);
      } finally {
        setLoading(false);
      }
    };

    void loadFirms();
  }, [canUseSelector, isSuperAdmin, providedFirms]);

  if (!canUseSelector) {
    return null;
  }

  const handleChange = (value: string) => {
    if (value === MY_FIRM_VALUE) {
      onFirmChange(userFirmId);
      return;
    }

    onFirmChange(value);
  };

  const displayValue = isSuperAdmin
    ? (!selectedFirmId || selectedFirmId === userFirmId ? MY_FIRM_VALUE : selectedFirmId)
    : (selectedFirmId || userFirmId);

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        <span className="flex items-center gap-2">
          <BuildingOfficeIcon className="w-4 h-4 text-purple-500" />
          {label || t('common.selectFirm', 'Cabinet')}
          {isSuperAdmin ? (
            <span className="text-xs text-purple-500 font-normal">
              ({t('users.management.roles.admin', 'Super administrateur')})
            </span>
          ) : null}
        </span>
      </label>
      <select
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled || loading}
        className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
      >
        {isSuperAdmin ? (
          <option value={MY_FIRM_VALUE}>
            {loading
              ? t('common.loading', 'Chargement...')
              : t('common.myFirm', 'Mon cabinet (par defaut)')}
          </option>
        ) : null}
        {(isSuperAdmin ? firms.filter((firm) => firm.id !== userFirmId) : firms).map((firm) => (
          <option key={firm.id} value={firm.id}>
            {firm.name}
          </option>
        ))}
      </select>
      {isSuperAdmin ? (
        <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
          {t('common.adminFirmHint', 'En tant que super administrateur, vous pouvez creer cet element pour un autre cabinet')}
        </p>
      ) : null}
    </div>
  );
};

export default AdminFirmSelector;
