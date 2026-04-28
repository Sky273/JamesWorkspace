/**
 * Confirm Delete Modal Component
 */

import Modal from './Modal';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
  t: (key: string) => string;
}

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, message, t }: ConfirmDeleteModalProps): JSX.Element => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('common.confirmDelete')} size="sm">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <p className="text-gray-700 dark:text-gray-300 mb-6">{message}</p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="app-button-secondary rounded-[9px] px-4 py-2 text-sm"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[9px] bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700"
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDeleteModal;
