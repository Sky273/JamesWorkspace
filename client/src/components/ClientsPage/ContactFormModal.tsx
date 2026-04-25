/**
 * Contact Form Modal Component
 */

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import Modal from './Modal';
import { ClientContact } from '../../types/entities';
import Switch from '../ui/Switch';

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ClientContact>) => void;
  contact: ClientContact | null;
  t: (key: string) => string;
}

const ContactFormModal = ({ isOpen, onClose, onSubmit, contact, t }: ContactFormModalProps): JSX.Element => {
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);

  useEffect(() => {
    if (contact) {
      setName(contact.name || '');
      setRole(contact.role || '');
      setEmail(contact.email || '');
      setPhone(contact.phone || '');
      setIsPrimary(contact.is_primary || false);
    } else {
      setName('');
      setRole('');
      setEmail('');
      setPhone('');
      setIsPrimary(false);
    }
  }, [contact, isOpen]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    onSubmit({
      name,
      role: role || undefined,
      email: email || undefined,
      phone: phone || undefined,
      is_primary: isPrimary
    });
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={contact ? t('clients.modal.editContact') : t('clients.modal.addContact')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('clients.modal.contactName')} *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('clients.modal.role')}
          </label>
          <input
            type="text"
            value={role}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setRole(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            placeholder={t('clients.modal.rolePlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('clients.modal.email')}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            placeholder="email@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('clients.modal.phone')}
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            placeholder="+33 1 23 45 67 89"
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={isPrimary}
            onChange={setIsPrimary}
            label={t('clients.modal.primaryContact')}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t('clients.modal.primaryContact')}
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ContactFormModal;
