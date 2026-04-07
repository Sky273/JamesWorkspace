/**
 * Sidebar Component
 * TypeScript version with organized sections
 */

import { useState, useEffect, ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  TagIcon,
  UsersIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  SparklesIcon,
  BookOpenIcon,
  UserGroupIcon,
  SignalIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  ServerStackIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import resumeConverterLogoDark from '../assets/resume-converter-logo.png';
import resumeConverterLogoLight from '../assets/resume-converter-logo-clair.png';

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

interface NavItem {
  name: string;
  href: string;
  icon: HeroIcon;
  adminOnly?: boolean;
}

interface NavSection {
  title: string | null;
  items: NavItem[];
  adminOnly?: boolean;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar = ({ isOpen = false, onClose }: SidebarProps): JSX.Element => {
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const checkDarkMode = (): void => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  const homeItem: NavItem = { name: t('navigation.home'), href: '/', icon: HomeIcon };

  const gestionSection: NavSection = {
    title: null,
    items: [
      { name: t('navigation.resumes'), href: '/resumes', icon: DocumentTextIcon },
      { name: t('navigation.missions'), href: '/missions', icon: BriefcaseIcon },
      { name: t('navigation.profileMatching'), href: '/profile-matching', icon: UserGroupIcon },
      { name: t('navigation.adaptations'), href: '/adaptations', icon: SparklesIcon },
      { name: t('navigation.crm', 'CRM'), href: '/clients', icon: BuildingOfficeIcon },
      { name: t('navigation.marketRadar'), href: '/facts', icon: SignalIcon },
    ],
  };

  const adminSection: NavSection = {
    title: null,
    items: [
      { name: t('navigation.templates'), href: '/templates', icon: DocumentDuplicateIcon },
      { name: t('navigation.emailTemplates'), href: '/email-templates', icon: EnvelopeIcon },
      { name: t('navigation.tags'), href: '/dashboard/tags', icon: TagIcon },
      { name: t('navigation.users'), href: '/dashboard/users', icon: UsersIcon },
      { name: t('navigation.security'), href: '/dashboard/security-logs', icon: ShieldCheckIcon },
      { name: t('navigation.gdprAudit'), href: '/dashboard/gdpr-audit', icon: ClipboardDocumentListIcon },
      { name: t('navigation.metrics'), href: '/dashboard/metrics', icon: ChartBarIcon },
    ],
    adminOnly: true,
  };

  const bottomItems: NavItem[] = [
    { name: t('navigation.settings'), href: '/settings', icon: Cog6ToothIcon, adminOnly: true },
    { name: t('navigation.jobs', 'Jobs'), href: '/batch-jobs', icon: QueueListIcon, adminOnly: true },
    { name: t('navigation.backup'), href: '/dashboard/backup', icon: ServerStackIcon, adminOnly: true },
    { name: t('navigation.userGuide'), href: '/guide', icon: BookOpenIcon },
  ];

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.href;
    const IconComponent = item.icon;

    return (
      <Link
        key={item.name}
        to={item.href}
        className={classNames(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
          isActive
            ? 'bg-slate-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] dark:bg-white/12 dark:text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100'
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-sky-500 dark:bg-sky-400" />
        )}
        <IconComponent
          className={classNames(
            'h-[18px] w-[18px] flex-shrink-0 transition-colors duration-200',
            isActive
              ? 'text-sky-300 dark:text-sky-300'
              : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
          )}
          aria-hidden={true}
        />
        <span className="truncate">{item.name}</span>
      </Link>
    );
  };

  const renderSection = (section: NavSection) => {
    const visibleItems = section.items.filter((item) => !item.adminOnly || isAdmin);

    if (visibleItems.length === 0) return null;

    return (
      <div key={section.title} className="mt-5">
        {section.title && (
          <div className="mb-2 flex items-center gap-2 px-3">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-sky-400" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {section.title}
            </h3>
            <span className="h-px flex-1 bg-gradient-to-r from-slate-200 via-slate-100 to-transparent dark:from-white/10 dark:via-white/6 dark:to-transparent" />
          </div>
        )}
        <div className="space-y-1">{visibleItems.map((item) => renderNavItem(item))}</div>
      </div>
    );
  };

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  const sidebarContent = (
    <div className="flex min-h-0 flex-1 flex-col border-r border-slate-200/80 bg-white/96 shadow-[1px_0_0_rgba(15,23,42,0.04)] dark:border-white/6 dark:bg-[#09111f] dark:shadow-[1px_0_0_rgba(255,255,255,0.03)]">
      <div className="flex flex-1 flex-col overflow-y-auto px-3 pb-4 pt-4 sidebar-scrollbar">
        <div className="flex flex-shrink-0 items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3 py-3 dark:border-white/6 dark:bg-white/[0.03]">
          <img src={isDarkMode ? resumeConverterLogoDark : resumeConverterLogoLight} alt="Resume Converter" className="h-auto max-w-[176px] object-contain" />
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/8 dark:hover:text-slate-200 md:hidden"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-5 flex flex-1 flex-col" onClick={handleNavClick}>
          <div className="space-y-1">{renderNavItem(homeItem)}</div>
          {renderSection(gestionSection)}
          {isAdmin && renderSection(adminSection)}
          <div className="min-h-4 flex-1" />
          <div className="relative mt-4 space-y-1 pt-4">
            <span className="absolute left-3 right-3 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10" />
            {bottomItems.filter((item) => !item.adminOnly || isAdmin).map((item) => renderNavItem(item))}
          </div>
        </nav>
      </div>
    </div>
  );

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
          <div className="fixed inset-y-0 left-0 flex w-72 max-w-[88vw] flex-col">{sidebarContent}</div>
        </div>
      )}

      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">{sidebarContent}</div>
    </>
  );
};

export default Sidebar;
