import { motion } from 'framer-motion';
import { BuildingOfficeIcon, CreditCardIcon, DocumentDuplicateIcon, EnvelopeIcon, TagIcon, UsersIcon } from '@heroicons/react/24/outline';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import PageHeader from '../components/page/PageHeader';
import ViewModeToggle from '../components/page/ViewModeToggle';
import { useAuth } from '../context/AuthContext';
import EmailTemplatesPage from './admin/EmailTemplatesPage';
import FirmCreditsPage from './FirmCreditsPage';
import TagsManagement from './TagsManagement';
import TemplatesPage from './TemplatesPage';
import UsersManagement from './UsersManagement';

type AdminWorkspaceTab = 'firms' | 'users' | 'templates' | 'emailTemplates' | 'tags' | 'firmCredits';

export default function AdminWorkspacePage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSuperAdmin = user?.role === 'admin';

  const availableTabs = useMemo(() => {
    const tabs: Array<{ value: AdminWorkspaceTab; label: string; icon: typeof UsersIcon }> = [
      { value: 'users', label: t('adminWorkspace.tabs.users'), icon: UsersIcon },
      { value: 'templates', label: t('adminWorkspace.tabs.templates'), icon: DocumentDuplicateIcon },
      { value: 'emailTemplates', label: t('adminWorkspace.tabs.emailTemplates'), icon: EnvelopeIcon },
      { value: 'tags', label: t('adminWorkspace.tabs.tags'), icon: TagIcon },
      { value: 'firmCredits', label: t('adminWorkspace.tabs.firmCredits'), icon: CreditCardIcon },
    ];

    if (isSuperAdmin) {
      tabs.unshift({ value: 'firms', label: t('adminWorkspace.tabs.firms'), icon: BuildingOfficeIcon });
    }

    return tabs;
  }, [isSuperAdmin, t]);

  const requestedTab = (searchParams.get('tab') || '') as AdminWorkspaceTab;
  const activeTab = availableTabs.some((tab) => tab.value === requestedTab)
    ? requestedTab
    : availableTabs[0]?.value || 'users';

  const setActiveTab = (nextTab: AdminWorkspaceTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams, { replace: true });
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'firms':
        return <UsersManagement embedded forcedTab="firms" hideTabSelector />;
      case 'users':
        return <UsersManagement embedded forcedTab="users" hideTabSelector />;
      case 'templates':
        return <TemplatesPage embedded />;
      case 'emailTemplates':
        return <EmailTemplatesPage embedded />;
      case 'tags':
        return <TagsManagement embedded />;
      case 'firmCredits':
        return <FirmCreditsPage embedded />;
      default:
        return <UsersManagement embedded forcedTab="users" hideTabSelector />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="cv-surface app-page-shell mx-auto mb-8 max-w-7xl rounded-[2.5rem] p-6 sm:p-8"
    >
      <PageHeader title={t('adminWorkspace.title')} subtitle={t('adminWorkspace.subtitle')} />

      <ViewModeToggle
        label={t('adminWorkspace.tabLabel')}
        value={activeTab}
        onChange={setActiveTab}
        options={availableTabs}
      />

      <div className="space-y-6 w-full">
        {renderTab()}
      </div>
    </motion.div>
  );
}
