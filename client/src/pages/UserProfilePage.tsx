/**
 * UserProfilePage Component
 * User profile and security settings (accessible to all users)
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  UserCircleIcon,
  ShieldCheckIcon,
  KeyIcon,
  EnvelopeIcon,
  PhoneIcon,
  BriefcaseIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useAuthFetch } from '../hooks/useAuthFetch';
import logger from '../utils/logger.frontend';
import authService from '../services/authService';
import TwoFactorSettings from '../components/TwoFactorSettings';
import InputWithLeadingIcon from '../components/form/InputWithLeadingIcon';
import PageHeader from '../components/page/PageHeader';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  jobTitle?: string;
  phone?: string;
  firm?: string;
}

const profileFieldClassName = 'mb-0 w-full rounded-[13px] border border-[#e4e4e7] bg-white py-2.5 pl-14 pr-4 text-gray-900 focus:ring-2 focus:ring-[#6b4eff]/25 dark:border-white/10 dark:bg-[#111827] dark:text-gray-100';
const profileFieldPlaceholderClassName = `${profileFieldClassName} placeholder:text-gray-400 dark:placeholder:text-gray-400`;

const UserProfilePage = (): JSX.Element => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { authGet, authPut } = useAuthFetch();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    jobTitle: '',
    phone: ''
  });

  const fetchProfile = useCallback(async () => {
    try {
      const response = await authGet('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
        setFormData({
          name: data.user.name || '',
          jobTitle: data.user.jobTitle || data.user.job_title || '',
          phone: data.user.phone || ''
        });
      }
    } catch (error) {
      logger.error('[UserProfile] Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  }, [authGet]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await authPut(`/api/users/${user?.id}`, {
        name: formData.name,
        jobTitle: formData.jobTitle,
        phone: formData.phone
      });

      if (response.ok) {
        toast.success(t('userProfile.updateSuccess'));
        void fetchProfile();
      } else {
        toast.error(t('userProfile.updateError'));
      }
    } catch {
      toast.error(t('userProfile.updateError'));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordResetRequest = async () => {
    if (!profile?.email) {
      toast.error(t('userProfile.passwordRequestError'));
      return;
    }

    setSendingPasswordReset(true);
    try {
      const result = await authService.forgotPassword(profile.email);
      toast.success(result.message || t('userProfile.passwordRequestSuccess'));
    } catch (error) {
      logger.error('[UserProfile] Failed to request password reset:', error);
      toast.error(t('userProfile.passwordRequestError'));
    } finally {
      setSendingPasswordReset(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, name: t('userProfile.tabs.profile'), icon: UserCircleIcon },
    { id: 'security' as const, name: t('userProfile.tabs.security'), icon: ShieldCheckIcon }
  ];

  if (loading) {
    return (
      <div className="cv-surface app-page-shell-4xl flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
          <ArrowPathIcon className="h-5 w-5 animate-spin" />
          <span>{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="cv-surface app-page-shell-4xl"
    >
      <PageHeader title={t('userProfile.title')} subtitle={t('userProfile.subtitle')} />

      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-[#6b4eff] text-[#6b4eff] dark:text-[#c9ccff]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <IconComponent className="w-5 h-5 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="section-shell rounded-[2rem] p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <UserCircleIcon className="h-6 w-6 text-[#6b4eff] dark:text-[#c9ccff]" />
              {t('userProfile.personalInfo')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('userProfile.fullName')}
                </label>
                <InputWithLeadingIcon
                  icon={UserCircleIcon}
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  inputClassName={profileFieldClassName}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('userProfile.email')}
                </label>
                <InputWithLeadingIcon
                  icon={EnvelopeIcon}
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  inputClassName="mb-0 w-full cursor-not-allowed rounded-[13px] border border-[#e4e4e7] bg-[#f8f8f7] py-2.5 pl-14 pr-4 text-gray-500 dark:border-white/10 dark:bg-[#182235] dark:text-gray-400"
                />
                <p className="text-xs text-gray-500 mt-1">{t('userProfile.emailReadonly')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('userProfile.jobTitle')}
                </label>
                <InputWithLeadingIcon
                  icon={BriefcaseIcon}
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  placeholder={t('userProfile.jobTitlePlaceholder')}
                  inputClassName={profileFieldPlaceholderClassName}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('userProfile.phone')}
                </label>
                <InputWithLeadingIcon
                  icon={PhoneIcon}
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={t('userProfile.phonePlaceholder')}
                  inputClassName={profileFieldPlaceholderClassName}
                />
              </div>
            </div>

            {profile?.firm && (
              <div className="mt-6 rounded-[13px] bg-[#f8f8f7] p-4 dark:bg-[#182235]">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{t('userProfile.firm')} :</span> {profile.firm}
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-[13px] bg-[#6b4eff] px-6 py-2 text-white transition-colors hover:bg-[#5b3eee] disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    {t('common.saving')}
                  </>
                ) : (
                  t('common.save')
                )}
              </button>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="section-shell rounded-[2rem] p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <KeyIcon className="h-6 w-6 text-[#6b4eff] dark:text-[#c9ccff]" />
              {t('userProfile.passwordTitle')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-3">
              {t('userProfile.passwordHelp')}
            </p>
            <div className="rounded-[13px] border border-[#e4e4e7] bg-[#f8f8f7] px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-[#182235] dark:text-slate-200">
              {t('userProfile.passwordEmailNotice')}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handlePasswordResetRequest}
                disabled={sendingPasswordReset}
                className="app-primary-action px-4 py-2 disabled:opacity-50"
              >
                {sendingPasswordReset ? t('common.loading') : t('userProfile.requestPasswordReset')}
              </button>
            </div>
          </div>
          <TwoFactorSettings />
        </div>
      )}
    </motion.div>
  );
};

export default UserProfilePage;
