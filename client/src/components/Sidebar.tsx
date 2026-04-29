/**
 * Sidebar Component
 * TypeScript version with organized sections
 */

import { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  Squares2X2Icon,
  ShieldCheckIcon,
  BriefcaseIcon,
  SparklesIcon,
  BookOpenIcon,
  UserGroupIcon,
  SignalIcon,
  BuildingOfficeIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  ServerStackIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

interface NavItem {
  name: string;
  href: string;
  icon: HeroIcon;
  badge?: string | number;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

interface NavSection {
  id: string;
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

  const isSuperAdmin = user?.role === 'admin';
  const isLocalAdmin = user?.role === 'localAdmin';
  const canAccessManagerScreens = isSuperAdmin || isLocalAdmin;
  const firmLabel = user?.firmName || user?.firm || 'AI workspace';

  const getInitials = (name: string | undefined): string => {
    if (!name) return 'RC';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'RC';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const getRoleLabel = (role: string | undefined): string => {
    if (!role) return t('userProfile.roles.user');
    const roleLower = role.toLowerCase();
    if (roleLower === 'admin') return t('userProfile.roles.admin');
    if (roleLower === 'localadmin') return t('userProfile.roles.localAdmin');
    return t('userProfile.roles.user');
  };

  const isItemActive = (href: string): boolean => {
    if (href === '/') {
      return location.pathname === '/';
    }

    if (href === '/clients') {
      return location.pathname.startsWith('/clients') || location.pathname.startsWith('/deals');
    }

    if (href === '/admin') {
      return location.pathname === '/admin';
    }

    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  const homeItem: NavItem = { name: t('navigation.home'), href: '/', icon: HomeIcon };

  const gestionSection: NavSection = {
    id: 'gestion',
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
    id: 'administration',
    title: null,
    items: [
      { name: t('navigation.administration', 'Administration'), href: '/admin', icon: Squares2X2Icon },
      { name: t('navigation.metrics'), href: '/dashboard/metrics', icon: ChartBarIcon, superAdminOnly: true },
    ],
    adminOnly: true,
  };

  const bottomItems: NavItem[] = [
    { name: t('navigation.settings'), href: '/settings', icon: Cog6ToothIcon, adminOnly: true },
    { name: t('navigation.jobs', 'Jobs'), href: '/batch-jobs', icon: QueueListIcon, adminOnly: true },
    { name: t('navigation.backup'), href: '/dashboard/backup', icon: ServerStackIcon, adminOnly: true },
    { name: t('navigation.security'), href: '/dashboard/security-logs', icon: ShieldCheckIcon, adminOnly: true },
    { name: t('navigation.gdprAudit'), href: '/dashboard/gdpr-audit', icon: ClipboardDocumentListIcon, adminOnly: true },
    { name: t('navigation.userGuide'), href: '/guide', icon: BookOpenIcon },
  ];

  const renderNavItem = (item: NavItem) => {
    const isActive = isItemActive(item.href);
    const IconComponent = item.icon;

    return (
      <Link
        key={item.name}
        to={item.href}
        onClick={onClose}
        className={classNames(
          'group relative flex min-h-8 items-center gap-2.5 rounded-[8px] border px-2.5 py-1.5 text-[12.5px] font-semibold transition-[background-color,border-color,color] duration-200',
          isActive
            ? 'border-[#7c5cff]/70 bg-[#33295f] !text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]'
            : 'border-transparent !text-white hover:bg-white/[0.06] hover:!text-white'
        )}
      >
        <IconComponent
          className={classNames(
            'h-[17px] w-[17px] flex-shrink-0 stroke-[1.8]',
            isActive
              ? 'text-[#e4ddff]'
              : 'text-[#c4cad4] group-hover:text-white'
          )}
          aria-hidden={true}
        />
        <span className="min-w-0 flex-1 truncate !text-white">{item.name}</span>
        {item.badge ? (
          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#7c5cff] px-1.5 text-[10px] font-bold leading-none text-white">
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  const renderSection = (section: NavSection) => {
    const visibleItems = section.items.filter((item) => {
      if (item.superAdminOnly) {
        return isSuperAdmin;
      }

      if (item.adminOnly) {
        return isSuperAdmin;
      }

      return true;
    });

    if (visibleItems.length === 0) return null;

    return (
      <div key={section.id} className="mt-0.5">
        {section.title && (
          <div className="mb-1 px-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#687080]">
              {section.title}
            </h3>
          </div>
        )}
        <div className="space-y-px">{visibleItems.map((item) => renderNavItem(item))}</div>
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex min-h-0 flex-1 flex-col border-r border-[#252b34] bg-[#111722] shadow-[1px_0_0_rgba(255,255,255,0.03)]">
      <div className="flex flex-1 flex-col overflow-y-auto pb-2 sidebar-scrollbar">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[#252b34] px-3.5 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#7c5cff] text-[11px] font-bold text-white shadow-none">
                RC
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold leading-4 text-white">
                  ResumeConverter
                </div>
                <div className="truncate text-[11px] leading-4 text-[#8f98a8]">
                  {firmLabel}
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Fermer')}
            className="rounded-[9px] p-1.5 text-[#8f98a8] transition-colors hover:bg-white/8 hover:text-white lg:hidden"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col px-2.5 py-2.5">
          <div className="space-y-px">{renderNavItem(homeItem)}</div>
          {renderSection(gestionSection)}
          {canAccessManagerScreens && renderSection(adminSection)}
          <div className="min-h-0 flex-1" />
          <div className="space-y-px">
            {bottomItems.filter((item) => !item.adminOnly || isSuperAdmin).map((item) => renderNavItem(item))}
          </div>
        </nav>
      </div>

      {user ? (
        <Link
          to="/profile"
          onClick={onClose}
          className="flex items-center gap-2.5 border-t border-[#252b34] px-3.5 py-2.5 transition-colors hover:bg-white/[0.04]"
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#7c5cff] text-[11px] font-bold text-white">
            {getInitials(user.name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold leading-4 text-white">
              {user.name || t('userProfile.anonymous')}
            </div>
            <div className="truncate text-[11px] leading-4 text-[#c4cad4]">
              {getRoleLabel(user.role)}
            </div>
          </div>
        </Link>
      ) : null}
    </div>
  );

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 flex w-[240px] max-w-[88vw] flex-col">{sidebarContent}</div>
        </div>
      )}

      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[240px] lg:flex-col">{sidebarContent}</div>
    </>
  );
};

export default Sidebar;
