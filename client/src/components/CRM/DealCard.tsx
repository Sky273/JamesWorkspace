import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  BriefcaseIcon,
  CurrencyEuroIcon,
  EyeIcon,
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
  onView: (deal: Deal) => void;
  onEdit: (deal: Deal) => void;
  onDelete: (deal: Deal) => void;
}

export default function DealCard({ deal, index, onView, onEdit, onDelete }: DealCardProps) {
  const { t } = useTranslation();
  const hasBudget = deal.budget_min != null || deal.budget_max != null;

  return (
    <motion.div
      key={deal.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="cv-card rounded-[13px] transition-all"
    >
      <div className="p-3.5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="truncate text-sm font-semibold text-gray-950 dark:text-gray-100">{deal.title}</h3>
            <div className="mt-1.5 flex items-center gap-2">
              <span className={`crm-deal-status-badge crm-deal-status-badge--${deal.status} rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CONFIG[deal.status].color}`}>
                {STATUS_CONFIG[deal.status].label}
              </span>
              <span className={`text-xs ${PRIORITY_CONFIG[deal.priority].color}`} title={PRIORITY_CONFIG[deal.priority].label}>
                {PRIORITY_CONFIG[deal.priority].icon}
              </span>
            </div>
          </div>
        </div>

        {deal.client_name && (
          <div className="mb-1.5 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <BuildingOfficeIcon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{deal.client_name}</span>
            {deal.client_type && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                deal.client_type === 'client'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
              }`}>
                {deal.client_type === 'client' ? t('clients.types.client') : t('clients.types.prospect')}
              </span>
            )}
          </div>
        )}

        {deal.contact_name && (
          <div className="mb-1.5 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <UserIcon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {deal.contact_name}
              {deal.contact_role && <span className="text-gray-400"> • {deal.contact_role}</span>}
            </span>
          </div>
        )}

        <div className="mb-2.5 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <DocumentTextIcon className="h-4 w-4 flex-shrink-0" />
            <span>{deal.resumes_count} CV(s)</span>
          </div>
          <div className="flex items-center gap-1">
            <BriefcaseIcon className="h-4 w-4 flex-shrink-0" />
            <span>{deal.missions_count || 0} {t('crm.deals.missions')}</span>
          </div>
        </div>

        {hasBudget && (
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <CurrencyEuroIcon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {deal.budget_min != null && deal.budget_max != null
                ? `${deal.budget_min.toLocaleString()} - ${deal.budget_max.toLocaleString()} €`
                : `${(deal.budget_min ?? deal.budget_max ?? 0).toLocaleString()} €`}
            </span>
          </div>
        )}

        {deal.notes && (
          <p className="mb-2.5 line-clamp-2 rounded-[9px] bg-[#f8f8f7] px-3 py-2 text-sm text-gray-600 dark:bg-white/[0.04] dark:text-gray-400">
            {deal.notes}
          </p>
        )}

        <div className="flex items-center justify-end gap-1.5 border-t border-[#e4e4e7] pt-2.5 dark:border-white/10">
          <button
            onClick={() => onView(deal)}
            className="rounded-[9px] p-2 text-gray-500 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:text-gray-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
            title={t('common.view')}
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => onEdit(deal)}
            className="rounded-[9px] p-2 text-gray-500 transition-colors hover:bg-[#ede9ff] hover:text-[#6246ea] dark:text-gray-400 dark:hover:bg-[#263052] dark:hover:text-[#c9ccff]"
            title={t('common.edit')}
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(deal)}
            className="rounded-[9px] p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
            title={t('common.delete')}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
