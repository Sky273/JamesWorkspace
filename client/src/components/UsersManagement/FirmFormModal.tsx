/**
 * Firm Form Modal Component
 * TypeScript version
 */

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import Modal from './Modal';

interface Firm {
  id?: string;
  name?: string;
}

interface FirmFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string }) => void;
  firm: Firm | null;
  t: (key: string) => string;
}

const FirmFormModal = ({ isOpen, onClose, onSubmit, firm, t }: FirmFormModalProps): JSX.Element => {
  const [name, setName] = useState<string>('');

  useEffect(() => {
    setName(firm?.name || '');
  }, [firm, isOpen]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    onSubmit({ name });
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setName(e.target.value);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={firm ? t('users.management.modal.editFirm') : t('users.management.modal.addFirm')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('users.management.modal.name')} *
          </label>
          <input
            type="text"
            value={name}
            onChange={handleNameChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {t('users.management.modal.cancel')}
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {t('users.management.modal.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default FirmFormModal;
