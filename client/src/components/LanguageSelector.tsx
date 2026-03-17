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
}

// ============================================
// FLAG COMPONENTS (SVG for cross-platform support)
// ============================================

const FlagFR = () => (
  <svg className="w-5 h-4 rounded-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
    <rect width="213.3" height="480" fill="#002654"/>
    <rect x="213.3" width="213.4" height="480" fill="#fff"/>
    <rect x="426.7" width="213.3" height="480" fill="#ce1126"/>
  </svg>
);

const FlagGB = () => (
  <svg className="w-5 h-4 rounded-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
    <path fill="#012169" d="M0 0h640v480H0z"/>
    <path fill="#FFF" d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z"/>
    <path fill="#C8102E" d="m424 281 216 159v40L369 281h55zm-184 20 6 35L54 480H0l240-179zM640 0v3L391 191l2-44L590 0h50zM0 0l239 176h-60L0 42V0z"/>
    <path fill="#FFF" d="M241 0v480h160V0H241zM0 160v160h640V160H0z"/>
    <path fill="#C8102E" d="M0 193v96h640v-96H0zM273 0v480h96V0h-96z"/>
  </svg>
);

const flags: Record<string, () => JSX.Element> = {
  fr: FlagFR,
  en: FlagGB,
};

// ============================================
// CONSTANTS
// ============================================

const languages: Language[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
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
        <span className="sr-only">{t('header.changeLanguage')}</span>
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
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                        : 'text-gray-700 dark:text-gray-300'
                    } flex w-full items-center px-4 py-2 text-sm`}
                  >
                    <span className="mr-2 flex-shrink-0">{flags[language.code]()}</span>
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
