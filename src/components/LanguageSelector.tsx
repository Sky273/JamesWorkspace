/**
 * LanguageSelector Component
 * TypeScript version
 */

import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { GlobeAltIcon } from '@heroicons/react/24/outline';

// ============================================
// TYPES
// ============================================

interface Language {
  code: string;
  label: string;
  flag: string;
}

// ============================================
// CONSTANTS
// ============================================

const languages: Language[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

// ============================================
// COMPONENT
// ============================================

const LanguageSelector = (): JSX.Element => {
  const { i18n, t } = useTranslation();

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
        <span className="sr-only">Change language</span>
        <div className="flex items-center">
          <GlobeAltIcon className="h-6 w-6" aria-hidden="true" />
        </div>
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-2 w-40 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div className="py-1">
            {languages.map((language) => (
              <Menu.Item key={language.code}>
                {({ active }: { active: boolean }) => (
                  <button
                    onClick={() => i18n.changeLanguage(language.code)}
                    className={`${
                      active
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                        : 'text-gray-700 dark:text-gray-300'
                    } flex w-full items-center px-4 py-2 text-sm`}
                  >
                    <span className="mr-2">{language.flag}</span>
                    {t(`header.language.${language.code}`)}
                    {currentLanguage.code === language.code && (
                      <span className="ml-auto text-indigo-600 dark:text-indigo-400">✓</span>
                    )}
                  </button>
                )}
              </Menu.Item>
            ))}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

export default LanguageSelector;
