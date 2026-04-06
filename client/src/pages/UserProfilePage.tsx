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
  BriefcaseIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useAuthFetch } from '../hooks/useAuthFetch';
import logger from '../utils/logger.frontend';
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

const UserProfilePage = (): JSX.Element => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { authGet, authPut } = useAuthFetch();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    fetchProfile();
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
        fetchProfile();
      } else {
        toast.error(t('userProfile.updateError'));
      }
    } catch {
      toast.error(t('userProfile.updateError'));
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, name: t('userProfile.tabs.profile'), icon: UserCircleIcon },
    { id: 'security' as const, name: t('userProfile.tabs.security'), icon: ShieldCheckIcon }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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

      {/* Tabs */}
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
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
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

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <UserCircleIcon className="h-6 w-6 text-blue-600" />
              {t('userProfile.personalInfo')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('userProfile.fullName')}
                </label>
                <InputWithLeadingIcon
                  icon={UserCircleIcon}
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  inputClassName="mb-0 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2.5 pl-14 pr-4 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('userProfile.email')}
                </label>
                <InputWithLeadingIcon
                  icon={EnvelopeIcon}
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  inputClassName="mb-0 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 py-2.5 pl-14 pr-4 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">{t('userProfile.emailReadonly')}</p>
              </div>

              {/* Job Title */}
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
                  inputClassName="mb-0 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2.5 pl-14 pr-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Phone */}
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
                  inputClassName="mb-0 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2.5 pl-14 pr-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Firm info (read-only) */}
            {profile?.firm && (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{t('userProfile.firm')} :</span> {profile.firm}
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    {t('common.saving')}
                  </>
                ) : (
                  t('common.save')
                )}
              </button>
            </div>
          </div>

          {/* Password change section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <KeyIcon className="h-6 w-6 text-blue-600" />
              {t('userProfile.passwordTitle')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('userProfile.passwordHelp')}
            </p>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <TwoFactorSettings />
        </div>
      )}
    </motion.div>
  );
};

export default UserProfilePage;
