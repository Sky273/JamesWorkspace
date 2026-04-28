import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Deal } from './dealsTab.types';

interface DealDeleteModalProps {
  open: boolean;
  deal: Deal | null;
  saving: boolean;
  onDelete: () => void;
  onClose: () => void;
}

export default function DealDeleteModal({ open, deal, saving, onDelete, onClose }: DealDeleteModalProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {open && deal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] isolate flex items-center justify-center bg-slate-500/45 p-4 backdrop-blur-[1px] dark:bg-slate-700/55"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-[13px] border border-[#dedbe8] bg-white p-5 shadow-xl dark:border-white/10 dark:bg-[#182235]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">
              {t('crm.deals.confirmDelete')}
            </h3>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              {t('crm.deals.deleteWarning')} <strong>{deal.title}</strong> ?
            </p>
            {deal.resumes_count > 0 && (
              <p className="mb-4 rounded-[9px] bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                {t('common.warning')} {t('crm.deals.resumesAssociatedWarning', { count: deal.resumes_count })}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="app-button-secondary rounded-[9px] px-4 py-2 text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={onDelete}
                disabled={saving}
                className="rounded-[9px] bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
