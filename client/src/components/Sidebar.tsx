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
  SignalIcon
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

const Sidebar = (): JSX.Element => {
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
      { name: t('navigation.marketRadar'), href: '/facts', icon: SignalIcon },
    ]
  };

  // ADMIN section - only visible to admins
  const adminSection: NavSection = {
    title: t('navigation.sectionAdmin'),
    items: [
      { name: t('navigation.templates'), href: '/templates', icon: DocumentDuplicateIcon },
      { name: t('navigation.tags'), href: '/dashboard/tags', icon: TagIcon },
      { name: t('navigation.users'), href: '/dashboard/users', icon: UsersIcon },
      { name: t('navigation.security'), href: '/dashboard/security-logs', icon: ShieldCheckIcon },
      { name: t('navigation.metrics'), href: '/dashboard/metrics', icon: ChartBarIcon },
    ],
    adminOnly: true
  };

  // Bottom items (Settings and User Guide)
  const bottomItems: NavItem[] = [
    { name: t('navigation.settings'), href: '/settings', icon: Cog6ToothIcon, adminOnly: true },
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
          isActive
            ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
          'group flex items-center px-2 py-1.5 text-xs font-medium rounded-md'
        )}
      >
        <IconComponent
          className={classNames(
            isActive
              ? 'text-gray-500 dark:text-gray-300'
              : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-400 dark:group-hover:text-gray-300',
            'mr-2 flex-shrink-0 h-4 w-4'
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
      <div key={section.title} className="mt-3">
        {section.title && (
          <h3 className="px-2 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
            {section.title}
          </h3>
        )}
        <div className="space-y-1">
          {visibleItems.map(renderNavItem)}
        </div>
      </div>
    );
  };

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
      <div className="flex-1 flex flex-col min-h-0 bg-app border-r border-gray-200 dark:border-gray-700">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-2 py-2">
            <img src={isDarkMode ? resumeConverterLogoDark : resumeConverterLogoLight} alt="Resume Converter" className="max-w-[200px] h-auto object-contain" />
          </div>
          
          <nav className="mt-5 flex-1 px-2 flex flex-col">
            {/* Home - no section header */}
            <div className="space-y-1">
              {renderNavItem(homeItem)}
            </div>

            {/* GESTION section */}
            {renderSection(gestionSection)}

            {/* ADMIN section - only for admins */}
            {isAdmin && renderSection(adminSection)}

            {/* Spacer to push bottom items down */}
            <div className="flex-1" />

            {/* Bottom items: Settings and User Guide */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3 space-y-0.5">
              {bottomItems
                .filter(item => !item.adminOnly || isAdmin)
                .map(renderNavItem)}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
