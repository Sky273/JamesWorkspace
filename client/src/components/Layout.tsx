/**
 * Layout Component
 * TypeScript version
 */

import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import ScrollToTop from './ScrollToTop';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import AboutModal from './AboutModal';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';
import Footer from './Footer';
import ChatBot from './ChatBot';
import HealthIndicator from './HealthIndicator';

// Helper to get cookie value
const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
};

// Helper to set cookie value
const setCookie = (name: string, value: string, days: number = 365): void => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
};

// Helper to get initials from name (first letter of first name + first letter of last name)
const getInitials = (name: string | undefined): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const Layout = (): JSX.Element => {
  const { user, signOut } = useAuth();
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return getCookie('theme') || 'light';
    }
    return 'light';
  });
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const { t } = useTranslation();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    setCookie('theme', theme);
  }, [theme]);

  const toggleTheme = (): void => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const handleSignOut = (): void => {
    signOut();
  };

  // Get translated role name (only 'user' and 'admin' are valid roles)
  const getRoleLabel = (role: string | undefined): string => {
    if (!role) return t('userProfile.roles.user');
    const roleLower = role.toLowerCase();
    if (roleLower === 'admin') return t('userProfile.roles.admin');
    return t('userProfile.roles.user');
  };

  return (
    <div className="min-h-screen bg-app">
      <ScrollToTop />
      <Sidebar />
      
      {/* Fixed user profile card - top right, vertically centered with header icons */}
      {user && (
        <div className="fixed top-0 right-4 z-50 h-16 flex items-center">
          <div className="flex items-center space-x-3">
          {/* Avatar with initials */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-md">
            {getInitials(user?.name || user?.Name)}
          </div>
          {/* User info */}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
              {user?.name || user?.Name || t('userProfile.anonymous')}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
              {user?.CustomerName || user?.customer || user?.Customer || t('userProfile.noCompany')} • {getRoleLabel(user?.role || user?.Role)}
            </span>
          </div>
          {/* Sign out button */}
          <button 
            onClick={handleSignOut} 
            className="ml-2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
            title={t('common.signOut')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          </div>
        </div>
      )}

      <div className="md:pl-64 flex flex-col flex-1 min-h-screen">
        <div className="header-bar shrink-0 sticky top-0 z-40 bg-gray-100/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 h-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <button
                  className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  onClick={toggleTheme}
                >
                  <span className="sr-only">
                    {theme === 'dark' ? t('header.theme.light') : t('header.theme.dark')}
                  </span>
                  {theme === 'dark' ? (
                    <SunIcon className="h-6 w-6" aria-hidden="true" />
                  ) : (
                    <MoonIcon className="h-6 w-6" aria-hidden="true" />
                  )}
                </button>

                <LanguageSelector />

                <button
                  className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  onClick={() => setIsAboutOpen(true)}
                >
                  <span className="sr-only">{t('common.about')}</span>
                  <InformationCircleIcon className="h-6 w-6" aria-hidden="true" />
                </button>

                <HealthIndicator />
              </div>
            </div>
          </div>
        </div>

        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>

        <Footer />
      </div>

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <ChatBot />
    </div>
  );
};

export default Layout;
