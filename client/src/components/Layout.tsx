import { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import ScrollToTop from './ScrollToTop';
import {
  Bars3Icon,
  InformationCircleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import {
  SunIcon,
  MoonIcon,
  ArrowRightOnRectangleIcon as ArrowRightOnRectangleSolidIcon,
} from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';
import Footer from './Footer';
import Breadcrumbs from './Breadcrumbs';
import DeferredRender from './DeferredRender';

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
  'group flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#E4E4E7] bg-white shadow-none transition-[transform,background-color,border-color] duration-200 hover:-translate-y-px hover:border-[#6B4EFF]/30 hover:bg-[#F3F2EF]';

const headerIconClassName =
  'h-[18px] w-[18px] flex-shrink-0 stroke-2 text-[#52525B] group-hover:text-[#18181B]';

const headerSolidIconClassName =
  'h-5 w-5 flex-shrink-0 fill-current text-[#52525B] group-hover:text-[#18181B]';

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
  const isSuperAdmin = user?.role === 'admin';

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
    <div className="min-h-screen bg-[#F3F2EF]">
      <a href="#main-content" className="skip-link">
        {t('common.skipToContent', 'Aller au contenu principal')}
      </a>
      <ScrollToTop />
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <div className="min-h-screen lg:pl-64">
        <div className={`flex min-h-screen flex-1 flex-col${isEditorialMigratedRoute ? ` editorial-migrated-shell${editorialRouteClassName}` : ''}`}>
        <header className="pointer-events-none sticky top-0 z-40 border-b border-[#E4E4E7] bg-white shadow-none">
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
              <div className="hidden h-6 w-px bg-[#E4E4E7] lg:block" />
              <div className="min-w-0 rounded-[9px] border border-[#E4E4E7] bg-white px-3 py-2">
                <Breadcrumbs tone="header" />
              </div>
            </div>

            <div className="ml-auto flex w-full items-center justify-end gap-2 pl-14 text-[#52525B] sm:gap-2.5 md:w-auto md:pl-0">
              <div className="flex items-center gap-1.5 rounded-[13px] border border-[#E4E4E7] bg-[#F3F2EF] px-1 py-1 shadow-none sm:gap-2 sm:px-1.5">
                <button
                  type="button"
                  className={headerIconButtonClassName}
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? t('header.theme.light') : t('header.theme.dark')}
                >
                  <span className="sr-only">
                    {theme === 'dark' ? t('header.theme.light') : t('header.theme.dark')}
                  </span>
                  {theme === 'dark' ? (
                    <SunIcon className={headerSolidIconClassName} aria-hidden="true" />
                  ) : (
                    <MoonIcon className={headerSolidIconClassName} aria-hidden="true" />
                  )}
                </button>

                <LanguageSelector variant="header" />

                {isSuperAdmin ? (
                  <Link
                    to="/settings"
                    className={headerIconButtonClassName}
                    title={t('navigation.settings')}
                    aria-label={t('navigation.settings')}
                  >
                    <span className="sr-only">{t('navigation.settings')}</span>
                    <Cog6ToothIcon className={headerIconClassName} aria-hidden="true" />
                  </Link>
                ) : null}

                <button
                  type="button"
                  className={headerIconButtonClassName}
                  onClick={() => setIsAboutOpen(true)}
                  aria-label={t('common.about')}
                >
                  <span className="sr-only">{t('common.about')}</span>
                  <InformationCircleIcon className={headerIconClassName} aria-hidden="true" />
                </button>
              </div>

              <div className="hidden sm:block">
                <DeferredRender delayMs={7000}>
                  <Suspense fallback={null}>
                    <HealthIndicator variant="header" />
                  </Suspense>
                </DeferredRender>
              </div>

              {user && (
                <>
                  <div className="hidden h-7 w-px bg-[#E4E4E7] lg:block" />
                  <Link
                    to="/profile"
                    className="flex min-w-0 items-center gap-2 rounded-[13px] border border-[#E4E4E7] bg-white px-1.5 py-1.5 shadow-none transition-[transform,background-color,border-color] duration-200 hover:-translate-y-px hover:border-[#6B4EFF]/30 hover:bg-[#F3F2EF] sm:gap-3 sm:px-2.5"
                    title={t('userProfile.viewProfile') || 'Mon compte'}
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-[#6B4EFF] text-[11px] font-semibold text-white shadow-none">
                      {getInitials(user.name)}
                    </div>
                    <div className="hidden min-w-0 lg:flex lg:flex-col">
                      <span className="truncate text-[12px] font-semibold tracking-[0.01em] text-[#18181B]">
                        {user.name || t('userProfile.anonymous')}
                      </span>
                      <span className="truncate text-[11px] text-[#52525B]">
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
                    <ArrowRightOnRectangleSolidIcon className={headerSolidIconClassName} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="relative z-0 flex-1">
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
