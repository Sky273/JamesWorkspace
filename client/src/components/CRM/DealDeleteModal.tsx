/**
 * DealDeleteModal - Delete confirmation modal for deals
 * Extracted from DealsTab.tsx
 */

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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
              {t('crm.deals.confirmDelete', 'Confirmer la suppression')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('crm.deals.deleteWarning', 'Êtes-vous sûr de vouloir supprimer l\'affaire')} <strong>{deal.title}</strong> ?
            </p>
            {deal.resumes_count > 0 && (
              <p className="text-amber-600 dark:text-amber-400 text-sm mb-4">
                ⚠️ {deal.resumes_count} CV(s) sont associés à cette affaire.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {t('common.cancel', 'Annuler')}
              </button>
              <button
                onClick={onDelete}
                disabled={saving}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {saving ? t('common.deleting', 'Suppression...') : t('common.delete', 'Supprimer')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
