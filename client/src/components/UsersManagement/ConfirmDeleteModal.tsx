/**
 * Confirm Delete Modal Component
 * TypeScript version
 */

import Modal from './Modal';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
  t: (key: string) => string;
}

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, message, t }: ConfirmDeleteModalProps): JSX.Element => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('common.delete')}>
      <p className="text-gray-700 dark:text-gray-300 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {t('users.management.modal.cancel')}
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          {t('users.management.modal.confirm')}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmDeleteModal;
