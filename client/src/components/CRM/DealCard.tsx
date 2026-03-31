import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  BriefcaseIcon,
  PencilSquareIcon,
  TrashIcon,
  UserIcon,
  BuildingOfficeIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { Deal, STATUS_CONFIG, PRIORITY_CONFIG } from './dealsTab.types';

interface DealCardProps {
  deal: Deal;
  index: number;
  onEdit: (deal: Deal) => void;
  onDelete: (deal: Deal) => void;
}

export default function DealCard({ deal, index, onEdit, onDelete }: DealCardProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      key={deal.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{deal.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_CONFIG[deal.status].color}`}>
                {STATUS_CONFIG[deal.status].label}
              </span>
              <span className={`text-xs ${PRIORITY_CONFIG[deal.priority].color}`} title={PRIORITY_CONFIG[deal.priority].label}>
                {PRIORITY_CONFIG[deal.priority].icon}
              </span>
            </div>
          </div>
        </div>

        {deal.client_name && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <BuildingOfficeIcon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{deal.client_name}</span>
            {deal.client_type && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                deal.client_type === 'client'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {deal.client_type === 'client' ? t('clients.types.client') : t('clients.types.prospect')}
              </span>
            )}
          </div>
        )}

        {deal.contact_name && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <UserIcon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {deal.contact_name}
              {deal.contact_role && <span className="text-gray-400"> • {deal.contact_role}</span>}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
          <div className="flex items-center gap-1">
            <DocumentTextIcon className="w-4 h-4 flex-shrink-0" />
            <span>{deal.resumes_count} CV(s)</span>
          </div>
          <div className="flex items-center gap-1">
            <BriefcaseIcon className="w-4 h-4 flex-shrink-0" />
            <span>{deal.missions_count || 0} {t('crm.deals.missions')}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => onEdit(deal)}
            className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
            title={t('common.edit')}
          >
            <PencilSquareIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => onDelete(deal)}
            className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
            title={t('common.delete')}
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
