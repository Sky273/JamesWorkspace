/**
 * Force Password Reset Modal Component
 */

import Modal from './Modal';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  userName: string;
  t: (key: string) => string;
}

const PasswordModal = ({ isOpen, onClose, onSubmit, userName, t }: PasswordModalProps): JSX.Element => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('users.management.modal.forcePasswordReset')}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('users.management.messages.forcePasswordResetDescription', { name: userName })}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('users.management.messages.forcePasswordResetEmailNotice')}
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary px-4 py-2"
          >
            {t('users.management.modal.cancel')}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="btn btn-primary px-4 py-2"
          >
            {t('users.management.modal.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PasswordModal;
