/**
 * User Form Modal Component
 * TypeScript version
 */

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import Modal from './Modal';

interface User {
  id?: string;
  name?: string;
  email?: string;
  jobTitle?: string;
  phone?: string;
  firm?: string;
  role?: string;
  status?: string;
}

interface Firm {
  id: string;
  name: string;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  jobTitle: string;
  phone: string;
  firm: string;
  role: string;
  status: string;
}

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  user: User | null;
  firms: Firm[];
  t: (key: string) => string;
}

const UserFormModal = ({ isOpen, onClose, onSubmit, user, firms, t }: UserFormModalProps): JSX.Element => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    jobTitle: '',
    phone: '',
    firm: '',
    role: 'user',
    status: 'Active'
  });

  useEffect(() => {
    if (user) {
      // Capitalize first letter of status for form display (DB stores lowercase)
      const capitalizedStatus = user.status 
        ? user.status.charAt(0).toUpperCase() + user.status.slice(1).toLowerCase()
        : 'Active';
      setFormData({
        name: user.name || '',
        email: user.email || '',
        password: '',
        jobTitle: user.jobTitle || '',
        phone: user.phone || '',
        firm: user.firm || '',
        role: user.role?.toLowerCase() || 'user',
        status: capitalizedStatus
      });
    } else {
      setFormData({ name: '', email: '', password: '', jobTitle: '', phone: '', firm: '', role: 'user', status: 'Active' });
    }
  }, [user, isOpen]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (field: keyof FormData) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const isEdit = !!user;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? t('users.management.modal.editUser') : t('users.management.modal.addUser')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('users.management.modal.name')} *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={handleInputChange('name')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('users.management.modal.email')} *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={handleInputChange('email')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('users.management.modal.jobTitle')}
            </label>
            <input
              type="text"
              value={formData.jobTitle}
              onChange={handleInputChange('jobTitle')}
              placeholder={t('users.management.modal.jobTitlePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('users.management.modal.phone')}
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={handleInputChange('phone')}
              placeholder={t('users.management.modal.phonePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('users.management.modal.password')} *
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={handleInputChange('password')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              required={!isEdit}
              minLength={8}
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('users.management.modal.firm')}
          </label>
          <select
            value={formData.firm}
            onChange={handleInputChange('firm')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('users.management.modal.selectFirm')}</option>
            {firms.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('users.management.modal.role')}
            </label>
            <select
              value={formData.role}
              onChange={handleInputChange('role')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="user">{t('users.management.roles.user')}</option>
              <option value="admin">{t('users.management.roles.admin')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('users.management.modal.status')}
            </label>
            <select
              value={formData.status}
              onChange={handleInputChange('status')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="Active">{t('users.management.status.active')}</option>
              <option value="Inactive">{t('users.management.status.inactive')}</option>
              <option value="Pending">{t('users.management.status.pending')}</option>
            </select>
          </div>
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

export default UserFormModal;
