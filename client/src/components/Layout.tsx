import { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import ScrollToTop from './ScrollToTop';
import {
  Bars3Icon,
} from '@heroicons/react/24/outline';
import {
  ArrowRightOnRectangleIcon as ArrowRightOnRectangleSolidIcon,
} from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import Footer from './Footer';
import Breadcrumbs from './Breadcrumbs';
import DeferredRender from './DeferredRender';
import HeaderActions from './HeaderActions';

const AboutModal = lazy(() => import('./AboutModal'));
const ChatBot = lazy(() => import('./ChatBot'));
const HealthIndicator = lazy(() => import('./HealthIndicator'));

const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
};

const setCookie = (name: string, value: string, days: number = 365): void => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
};

const getInitials = (name: string | undefined): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const headerIconButtonClassName =
  'group flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#E4E4E7] bg-white shadow-none transition-[transform,background-color,border-color] duration-200 hover:-translate-y-px hover:border-[#6B4EFF]/30 hover:bg-[#F3F2EF] dark:border-[#343a46] dark:bg-[#22262e] dark:hover:border-[#7c5cff]/45 dark:hover:bg-[#2a2f38]';

const headerIconClassName =
  'h-[18px] w-[18px] flex-shrink-0 stroke-2 text-[#52525B] group-hover:text-[#18181B] dark:text-[#c4cad4] dark:group-hover:text-[#f4f5f7]';

const headerSignOutIconClassName =
  'h-5 w-5 flex-shrink-0 fill-current text-[#52525B] group-hover:text-[#18181B] dark:text-[#c4cad4] dark:group-hover:text-[#f4f5f7]';

const Layout = (): JSX.Element => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return getCookie('theme') || 'light';
    }
    return 'light';
  });
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const { t } = useTranslation();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    setCookie('theme', theme);
  }, [theme]);

  const toggleTheme = (): void => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const getRoleLabel = (role: string | undefined): string => {
    if (!role) return t('userProfile.roles.user');
    const roleLower = role.toLowerCase();
    if (roleLower === 'admin') return t('userProfile.roles.admin');
    if (roleLower === 'localadmin') return t('userProfile.roles.localAdmin');
    return t('userProfile.roles.user');
  };

  const isResumesRoute = location.pathname === '/resumes';
  const isAdminWorkspaceRoute = location.pathname === '/admin';
  const isMissionsRoute = location.pathname === '/missions';
  const isEditorialMigratedRoute = true;
  const editorialRouteClassName = isResumesRoute || isAdminWorkspaceRoute
    ? ' resumes-editorial-shell'
    : isMissionsRoute
      ? ' missions-editorial-shell'
      : isEditorialMigratedRoute
        ? ' app-editorial-shell'
        : '';

  return (
    <div className="min-h-screen bg-[#F3F2EF] dark:bg-[#181b20]">
      <a href="#main-content" className="skip-link">
        {t('common.skipToContent', 'Aller au contenu principal')}
      </a>
      <ScrollToTop />
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <div className="min-h-screen lg:pl-[240px]">
        <div className={`flex min-h-screen flex-1 flex-col${isEditorialMigratedRoute ? ` editorial-migrated-shell${editorialRouteClassName}` : ''}`}>
        <header className="pointer-events-none sticky top-0 z-40 border-b border-[#E4E4E7] bg-white shadow-none dark:border-[#343a46] dark:bg-[#22262e]">
          <div className="pointer-events-auto relative flex min-h-16 items-center justify-between gap-3 px-4 py-2 sm:h-16 sm:gap-4 sm:py-0 sm:px-6 lg:px-8">
            <button
              type="button"
              className={`absolute left-4 top-1/2 z-10 -translate-y-1/2 shrink-0 lg:hidden ${headerIconButtonClassName}`}
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label={t('common.openMenu')}
            >
              <span className="sr-only">{t('common.openMenu')}</span>
              <Bars3Icon className={headerIconClassName} aria-hidden="true" />
            </button>

            <div className="hidden min-w-0 flex-1 items-center gap-2 sm:gap-3.5 md:flex">
              <div className="hidden h-6 w-px bg-[#E4E4E7] dark:bg-[#343a46] lg:block" />
              <div className="min-w-0 rounded-[9px] border border-[#E4E4E7] bg-white px-3 py-2 dark:border-[#343a46] dark:bg-[#2a2f38]">
                <Breadcrumbs tone="header" />
              </div>
            </div>

            <div className="ml-auto flex w-full items-center justify-end gap-2 pl-14 text-[#52525B] dark:text-[#c4cad4] sm:gap-2.5 md:w-auto md:pl-0">
              <HeaderActions
                theme={theme}
                onToggleTheme={toggleTheme}
                onOpenAbout={() => setIsAboutOpen(true)}
              />

              <div className="hidden sm:block">
                <DeferredRender delayMs={7000}>
                  <Suspense fallback={null}>
                    <HealthIndicator variant="header" />
                  </Suspense>
                </DeferredRender>
              </div>

              {user && (
                <>
                  <div className="hidden h-7 w-px bg-[#E4E4E7] dark:bg-[#343a46] lg:block" />
                  <Link
                    to="/profile"
                    className="flex min-w-0 items-center gap-2 rounded-[13px] border border-[#E4E4E7] bg-white px-1.5 py-1.5 shadow-none transition-[transform,background-color,border-color] duration-200 hover:-translate-y-px hover:border-[#6B4EFF]/30 hover:bg-[#F3F2EF] dark:border-[#343a46] dark:bg-[#22262e] dark:hover:border-[#7c5cff]/45 dark:hover:bg-[#2a2f38] sm:gap-3 sm:px-2.5"
                    title={t('userProfile.viewProfile') || 'Mon compte'}
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-[#6B4EFF] text-[11px] font-semibold text-white shadow-none dark:bg-[#7c5cff]">
                      {getInitials(user.name)}
                    </div>
                    <div className="hidden min-w-0 lg:flex lg:flex-col">
                      <span className="truncate text-[12px] font-semibold tracking-[0.01em] text-[#18181B] dark:text-[#f4f5f7]">
                        {user.name || t('userProfile.anonymous')}
                      </span>
                      <span className="truncate text-[11px] text-[#52525B] dark:text-[#c4cad4]">
                        {user.firmName || user.firm || t('userProfile.noCompany')} · {getRoleLabel(user.role)}
                      </span>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={signOut}
                    className={headerIconButtonClassName}
                    title={t('common.signOut')}
                    aria-label={t('common.signOut')}
                  >
                    <span className="sr-only">{t('common.signOut')}</span>
                    <ArrowRightOnRectangleSolidIcon className={headerSignOutIconClassName} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="relative flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>

          <Footer />
        </div>
      </div>

      {isAboutOpen ? (
        <Suspense fallback={null}>
          <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
        </Suspense>
      ) : null}
      <DeferredRender delayMs={10000}>
        <Suspense fallback={null}>
          <ChatBot />
        </Suspense>
      </DeferredRender>
    </div>
  );
};

export default Layout;
