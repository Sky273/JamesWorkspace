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
  QueueListIcon
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

  const isAdmin = ((user?.role || user?.Role || '') as string).toLowerCase() === 'admin';

  useEffect(() => {
    const checkDarkMode = (): void => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  // Home item (no section header)
  const homeItem: NavItem = { name: t('navigation.home'), href: '/', icon: HomeIcon };

  // GESTION section - visible to all users
  const gestionSection: NavSection = {
    title: t('navigation.sectionGestion'),
    items: [
      { name: t('navigation.resumes'), href: '/resumes', icon: DocumentTextIcon },
      { name: t('navigation.missions'), href: '/missions', icon: BriefcaseIcon },
      { name: t('navigation.profileMatching'), href: '/profile-matching', icon: UserGroupIcon },
      { name: t('navigation.adaptations'), href: '/adaptations', icon: SparklesIcon },
      { name: t('navigation.crm', 'CRM'), href: '/clients', icon: BuildingOfficeIcon },
      { name: t('navigation.marketRadar'), href: '/facts', icon: SignalIcon },
    ]
  };

  // ADMIN section - only visible to admins
  const adminSection: NavSection = {
    title: t('navigation.sectionAdmin'),
    items: [
      { name: t('navigation.templates'), href: '/templates', icon: DocumentDuplicateIcon },
      { name: t('navigation.emailTemplates'), href: '/dashboard/email-templates', icon: EnvelopeIcon },
      { name: t('navigation.tags'), href: '/dashboard/tags', icon: TagIcon },
      { name: t('navigation.users'), href: '/dashboard/users', icon: UsersIcon },
      { name: t('navigation.security'), href: '/dashboard/security-logs', icon: ShieldCheckIcon },
      { name: t('navigation.gdprAudit'), href: '/dashboard/gdpr-audit', icon: ClipboardDocumentListIcon },
      { name: t('navigation.metrics'), href: '/dashboard/metrics', icon: ChartBarIcon },
    ],
    adminOnly: true
  };

  // Bottom items (Settings, Jobs, Backup, and User Guide)
  const bottomItems: NavItem[] = [
    { name: t('navigation.settings'), href: '/settings', icon: Cog6ToothIcon, adminOnly: true },
    { name: t('navigation.jobs', 'Jobs'), href: '/batch-jobs', icon: QueueListIcon, adminOnly: true },
    { name: t('navigation.backup'), href: '/dashboard/backup', icon: ServerStackIcon, adminOnly: true },
    { name: t('navigation.userGuide'), href: '/guide', icon: BookOpenIcon },
  ];

  const renderNavItem = (item: NavItem, isBottomItem = false) => {
    const isActive = location.pathname === item.href;
    const IconComponent = item.icon;
    return (
      <Link
        key={item.name}
        to={item.href}
        className={classNames(
          'group relative flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200',
          isActive
            ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 shadow-sm'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200'
        )}
      >
        {/* Active indicator bar */}
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-500 dark:bg-primary-400 rounded-r-full" />
        )}
        <IconComponent
          className={classNames(
            'flex-shrink-0 h-[18px] w-[18px] transition-colors duration-200',
            isActive
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300'
          )}
          aria-hidden={true}
        />
        {item.name}
      </Link>
    );
  };

  const renderSection = (section: NavSection) => {
    // Filter items based on admin status
    const visibleItems = section.items.filter(item => !item.adminOnly || isAdmin);
    
    if (visibleItems.length === 0) return null;

    return (
      <div key={section.title} className="mt-5">
        {section.title && (
          <div className="flex items-center gap-2 px-3 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 dark:bg-primary-500" />
            <h3 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              {section.title}
            </h3>
            <span className="flex-1 h-px bg-gradient-to-r from-gray-200 dark:from-gray-700 to-transparent" />
          </div>
        )}
        <div className="space-y-0.5">
          {visibleItems.map(item => renderNavItem(item))}
        </div>
      </div>
    );
  };

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  const sidebarContent = (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-900 border-r border-gray-200/80 dark:border-gray-800">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto sidebar-scrollbar">
        <div className="flex items-center justify-between flex-shrink-0 px-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <img src={isDarkMode ? resumeConverterLogoDark : resumeConverterLogoLight} alt="Resume Converter" className="max-w-[180px] h-auto object-contain" />
          {/* Close button - only visible on mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        <nav className="mt-4 flex-1 px-3 flex flex-col" onClick={handleNavClick}>
          {/* Home - no section header */}
          <div className="space-y-0.5">
            {renderNavItem(homeItem)}
          </div>

          {/* GESTION section */}
          {renderSection(gestionSection)}

          {/* ADMIN section - only for admins */}
          {isAdmin && renderSection(adminSection)}

          {/* Spacer to push bottom items down */}
          <div className="flex-1 min-h-4" />

          {/* Bottom items: Settings and User Guide */}
          <div className="relative pt-4 mt-3 space-y-0.5">
            <span className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />
            {bottomItems
              .filter(item => !item.adminOnly || isAdmin)
              .map(item => renderNavItem(item, true))}
          </div>
        </nav>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-gray-600/75 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
          {/* Sidebar panel - solid background for readability */}
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white dark:bg-gray-900 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        {sidebarContent}
      </div>
    </>
  );
};

export default Sidebar;
