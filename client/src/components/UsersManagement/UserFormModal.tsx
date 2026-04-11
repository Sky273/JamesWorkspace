/**
 * User Form Modal Component
 * TypeScript version
 */

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import {
  BriefcaseIcon,
  BuildingOffice2Icon,
  CheckBadgeIcon,
  EnvelopeIcon,
  IdentificationIcon,
  PhoneIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import Modal from './Modal';
import AdminFirmSelector from '../AdminFirmSelector';

interface User {
  id?: string;
  name?: string;
  email?: string;
  jobTitle?: string;
  phone?: string;
  firm?: string;
  firmId?: string;
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
  jobTitle: string;
  phone: string;
  firmId: string;
  role: string;
  status: string;
}

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  user: User | null;
  firms: Firm[];
  canAssignSuperAdmin?: boolean;
  canChangeFirm?: boolean;
  t: (key: string) => string;
}

const inputClassName = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const sectionClassName = 'rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40';

const UserFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  user,
  firms,
  canAssignSuperAdmin = false,
  canChangeFirm = true,
  t,
}: UserFormModalProps): JSX.Element => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    jobTitle: '',
    phone: '',
    firmId: '',
    role: 'user',
    status: 'Active',
  });

  useEffect(() => {
    if (user) {
      const capitalizedStatus = user.status
        ? user.status.charAt(0).toUpperCase() + user.status.slice(1).toLowerCase()
        : 'Active';
      setFormData({
        name: user.name || '',
        email: user.email || '',
        jobTitle: user.jobTitle || '',
        phone: user.phone || '',
        firmId: user.firmId || '',
        role: user.role || 'user',
        status: capitalizedStatus,
      });
    } else {
      setFormData({ name: '', email: '', jobTitle: '', phone: '', firmId: '', role: 'user', status: 'Active' });
    }
  }, [user, isOpen]);

  useEffect(() => {
    if (!isOpen || user || canChangeFirm || firms.length === 0) {
      return;
    }

    setFormData((prev) => (
      prev.firmId
        ? prev
        : { ...prev, firmId: firms[0].id }
    ));
  }, [canChangeFirm, firms, isOpen, user]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (field: keyof FormData) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const isEdit = !!user;
  const roleSummaryKey = formData.role === 'admin'
    ? 'users.management.modal.roleSummaryAdmin'
    : formData.role === 'localAdmin'
      ? 'users.management.modal.roleSummaryLocalAdmin'
      : 'users.management.modal.roleSummaryUser';
  const statusSummaryKey = formData.status === 'Inactive'
    ? 'users.management.modal.statusSummaryInactive'
    : formData.status === 'Pending'
      ? 'users.management.modal.statusSummaryPending'
      : 'users.management.modal.statusSummaryActive';

  const renderFieldLabel = (
    Icon: typeof UserCircleIcon,
    label: string,
    required = false,
  ) => (
    <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
      <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
      <span>{label}{required ? ' *' : ''}</span>
    </label>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? t('users.management.modal.editUser') : t('users.management.modal.addUser')}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-4 dark:border-blue-900/50 dark:from-blue-950/40 dark:to-slate-900">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/80 p-2 text-blue-600 shadow-sm dark:bg-blue-900/30 dark:text-blue-300">
              <UserCircleIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isEdit ? t('users.management.modal.editUser') : t('users.management.modal.addUser')}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {isEdit ? t('users.management.modal.editUserDescription') : t('users.management.modal.addUserDescription')}
              </p>
            </div>
          </div>
        </div>

        <section className={sectionClassName}>
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('users.management.modal.identitySectionTitle')}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('users.management.modal.identitySectionDescription')}</p>
          </div>

          <div>
            {renderFieldLabel(IdentificationIcon, t('users.management.modal.name'), true)}
            <input
              type="text"
              value={formData.name}
              onChange={handleInputChange('name')}
              className={inputClassName}
              required
              placeholder={t('users.management.modal.namePlaceholder')}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('users.management.modal.nameHint')}</p>
          </div>

          <div className="mt-4">
            {renderFieldLabel(EnvelopeIcon, t('users.management.modal.email'), true)}
            <input
              type="email"
              value={formData.email}
              onChange={handleInputChange('email')}
              className={inputClassName}
              required
              placeholder={t('users.management.modal.emailPlaceholder')}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('users.management.modal.emailHint')}</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              {renderFieldLabel(BriefcaseIcon, t('users.management.modal.jobTitle'))}
              <input
                type="text"
                value={formData.jobTitle}
                onChange={handleInputChange('jobTitle')}
                placeholder={t('users.management.modal.jobTitlePlaceholder')}
                className={inputClassName}
              />
            </div>
            <div>
              {renderFieldLabel(PhoneIcon, t('users.management.modal.phone'))}
              <input
                type="tel"
                value={formData.phone}
                onChange={handleInputChange('phone')}
                placeholder={t('users.management.modal.phonePlaceholder')}
                className={inputClassName}
              />
            </div>
          </div>
        </section>

        {!isEdit ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            {t('users.management.messages.userInvitationNotice')}
          </div>
        ) : null}

        <section className={sectionClassName}>
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('users.management.modal.accessSectionTitle')}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('users.management.modal.accessSectionDescription')}</p>
          </div>

          <div>
            {renderFieldLabel(BuildingOffice2Icon, t('users.management.modal.firm'), true)}
            <AdminFirmSelector
              selectedFirmId={formData.firmId}
              onFirmChange={(firmId) => setFormData((prev) => ({ ...prev, firmId }))}
              label=""
              disabled={!canChangeFirm}
              firms={firms}
              showForLocalAdmin={true}
              className="space-y-0"
              t={t}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {canChangeFirm ? t('users.management.modal.firmHintAdmin') : t('users.management.modal.firmHintLocked')}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              {renderFieldLabel(ShieldCheckIcon, t('users.management.modal.role'))}
              <select
                value={formData.role}
                onChange={handleInputChange('role')}
                className={inputClassName}
              >
                <option value="user">{t('users.management.roles.user')}</option>
                <option value="localAdmin">{t('users.management.roles.localAdmin')}</option>
                {canAssignSuperAdmin ? <option value="admin">{t('users.management.roles.admin')}</option> : null}
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(roleSummaryKey)}</p>
            </div>
            <div>
              {renderFieldLabel(CheckBadgeIcon, t('users.management.modal.status'))}
              <select
                value={formData.status}
                onChange={handleInputChange('status')}
                className={inputClassName}
              >
                <option value="Active">{t('users.management.status.active')}</option>
                <option value="Inactive">{t('users.management.status.inactive')}</option>
                <option value="Pending">{t('users.management.status.pending')}</option>
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(statusSummaryKey)}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={`rounded-xl border px-3 py-3 text-sm ${formData.role === 'user' ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200' : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
              <p className="font-semibold">{t('users.management.roles.user')}</p>
              <p className="mt-1 text-xs">{t('users.management.modal.roleCardUser')}</p>
            </div>
            <div className={`rounded-xl border px-3 py-3 text-sm ${formData.role === 'localAdmin' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
              <p className="font-semibold">{t('users.management.roles.localAdmin')}</p>
              <p className="mt-1 text-xs">{t('users.management.modal.roleCardLocalAdmin')}</p>
            </div>
            {canAssignSuperAdmin ? (
              <div className={`rounded-xl border px-3 py-3 text-sm ${formData.role === 'admin' ? 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-200' : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                <p className="font-semibold">{t('users.management.roles.admin')}</p>
                <p className="mt-1 text-xs">{t('users.management.modal.roleCardAdmin')}</p>
              </div>
            ) : null}
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 dark:border-slate-700 md:flex-row md:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary px-4 py-2.5"
          >
            {t('users.management.modal.cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-primary px-4 py-2.5"
          >
            {isEdit ? t('users.management.modal.saveChanges') : t('users.management.modal.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default UserFormModal;
