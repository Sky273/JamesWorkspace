import { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
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
import HealthIndicator from './HealthIndicator';
import Breadcrumbs from './Breadcrumbs';

const AboutModal = lazy(() => import('./AboutModal'));
const ChatBot = lazy(() => import('./ChatBot'));

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
  'group flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/90 bg-white shadow-sm shadow-slate-200/50 transition-all hover:-translate-y-px hover:border-slate-300 dark:border-white/8 dark:bg-white/[0.045] dark:shadow-none dark:hover:border-white/12 dark:hover:bg-white/[0.08]';

const headerIconClassName =
  'h-[18px] w-[18px] flex-shrink-0 stroke-2 text-slate-400 transition-colors duration-200 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300';

const headerSolidIconClassName =
  'h-5 w-5 flex-shrink-0 fill-current text-slate-400 transition-colors duration-200 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300';

const Layout = (): JSX.Element => {
  const { user, signOut } = useAuth();
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
    return t('userProfile.roles.user');
  };

  return (
    <div className="min-h-screen bg-app">
      <ScrollToTop />
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <div className="flex min-h-screen flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-white/6 dark:bg-[#0c1222]/95 dark:shadow-[0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3.5">
              <button
                className={`md:hidden ${headerIconButtonClassName}`}
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <span className="sr-only">{t('common.openMenu')}</span>
                <Bars3Icon className={headerIconClassName} aria-hidden="true" />
              </button>
              <div className="hidden h-6 w-px bg-slate-200/80 md:block dark:bg-white/8" />
              <div className="min-w-0 rounded-full border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-white/8 dark:bg-white/[0.03]">
                <Breadcrumbs tone="header" />
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-1.5 py-1 shadow-sm shadow-slate-200/40 dark:border-white/8 dark:bg-white/[0.03] dark:shadow-none">
                <button className={headerIconButtonClassName} onClick={toggleTheme}>
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

                <Link
                  to="/settings"
                  className={headerIconButtonClassName}
                  title={t('navigation.settings')}
                >
                  <span className="sr-only">{t('navigation.settings')}</span>
                  <Cog6ToothIcon className={headerIconClassName} aria-hidden="true" />
                </Link>

                <button className={headerIconButtonClassName} onClick={() => setIsAboutOpen(true)}>
                  <span className="sr-only">{t('common.about')}</span>
                  <InformationCircleIcon className={headerIconClassName} aria-hidden="true" />
                </button>
              </div>

              <div className="hidden sm:block">
                <HealthIndicator variant="header" />
              </div>

              {user && (
                <>
                  <div className="hidden h-7 w-px bg-slate-200/80 lg:block dark:bg-white/8" />
                  <Link
                    to="/profile"
                    className="flex min-w-0 items-center gap-3 rounded-full border border-slate-200/90 bg-white px-2.5 py-1.5 shadow-sm shadow-slate-200/50 transition-all hover:-translate-y-px hover:border-slate-300 dark:border-white/8 dark:bg-white/[0.045] dark:shadow-none dark:hover:border-white/12 dark:hover:bg-white/[0.08]"
                    title={t('userProfile.viewProfile') || 'Mon compte'}
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500 text-[11px] font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
                      {getInitials(user.name)}
                    </div>
                    <div className="hidden min-w-0 lg:flex lg:flex-col">
                      <span className="truncate text-[12px] font-semibold tracking-[0.01em] text-slate-900 dark:text-white">
                        {user.name || t('userProfile.anonymous')}
                      </span>
                      <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {user.firmName || user.firm || t('userProfile.noCompany')} · {getRoleLabel(user.role)}
                      </span>
                    </div>
                  </Link>

                  <button
                    onClick={signOut}
                    className={headerIconButtonClassName}
                    title={t('common.signOut')}
                  >
                    <ArrowRightOnRectangleSolidIcon className={headerSolidIconClassName} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>

        <Footer />
      </div>

      <Suspense fallback={null}>
        <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
        <ChatBot />
      </Suspense>
    </div>
  );
};

export default Layout;
