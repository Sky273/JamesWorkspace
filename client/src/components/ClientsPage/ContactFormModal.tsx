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

const fieldClassName = 'w-full rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#6246ea] focus:outline-none focus:ring-2 focus:ring-[#6246ea]/20 dark:border-white/10 dark:bg-[#111827] dark:text-gray-100';
const labelClassName = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300';

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
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className={labelClassName}>
            {t('clients.modal.contactName')} *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            className={fieldClassName}
            required
          />
        </div>

        <div>
          <label className={labelClassName}>
            {t('clients.modal.role')}
          </label>
          <input
            type="text"
            value={role}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setRole(e.target.value)}
            className={fieldClassName}
            placeholder={t('clients.modal.rolePlaceholder')}
          />
        </div>

        <div>
          <label className={labelClassName}>
            {t('clients.modal.email')}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            className={fieldClassName}
            placeholder="email@example.com"
          />
        </div>

        <div>
          <label className={labelClassName}>
            {t('clients.modal.phone')}
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
            className={fieldClassName}
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
            className="app-button-secondary rounded-[9px] px-4 py-2 text-sm"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="app-primary-action rounded-[9px] px-4 py-2 text-sm"
          >
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ContactFormModal;
