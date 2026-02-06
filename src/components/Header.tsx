/**
 * Header Component
 * TypeScript version
 */

import { useState, useEffect, MouseEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import ApteaLogo from './ApteaLogo';
import ResumeConverterLogo from './icons/ResumeConverterLogo';
import { useAuth } from '../context/AuthContext';

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

const Header = (): JSX.Element => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const themeCookie = getCookie('theme');
    if (themeCookie === 'dark' || (!themeCookie && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = (): void => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      setCookie('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      setCookie('theme', 'dark');
      setIsDark(true);
    }
  };

  const scrollToFeatures = (e: MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    const featuresSection = document.querySelector('#key-features');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="header-bar-transparent">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-2 text-2xl font-bold text-primary-600 dark:text-primary-400">
              <ResumeConverterLogo className="w-8 h-8" />
            </Link>
            <nav className="hidden md:flex items-center space-x-6">
              {isHomePage && (
                <>
                  <a 
                    href="#how-it-works" 
                    className="text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                  >
                    How It Works
                  </a>
                  <a 
                    href="#key-features" 
                    onClick={scrollToFeatures}
                    className="text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                  >
                    Features
                  </a>
                </>
              )}
              <Link
                to="/resumes"
                className="text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
              >
                Resumes
              </Link>
              <Link
                to="/templates"
                className="text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
              >
                Templates
              </Link>
              <Link 
                to="/dashboard" 
                className="text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
              >
                Dashboard
              </Link>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Toggle dark mode"
            >
              {isDark ? (
                <SunIcon className="w-5 h-5" />
              ) : (
                <MoonIcon className="w-5 h-5" />
              )}
            </button>
            {user && (
              <div className="flex items-center space-x-3 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
                {/* Avatar with initials */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm">
                  {getInitials(user.Name)}
                </div>
                {/* User info */}
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                    {user.Name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
                    {user.CustomerName || 'No Company'} • {user.Role || 'User'}
                  </span>
                </div>
                {/* Sign out button */}
                {signOut && (
                  <button 
                    onClick={signOut} 
                    className="ml-2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Sign Out"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
