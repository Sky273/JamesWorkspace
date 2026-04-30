/**
 * LanguageSelector Component
 * TypeScript version
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  headerActionButtonClassName,
  headerActionIconClassName,
} from './headerActionStyles';

interface Language {
  code: string;
  label: string;
}

interface LanguageSelectorProps {
  variant?: 'default' | 'header';
}

interface MenuPosition {
  top: number;
  left: number;
}

const FlagFR = () => (
  <svg className="h-4 w-5 rounded-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
    <rect width="213.3" height="480" fill="#002654" />
    <rect x="213.3" width="213.4" height="480" fill="#fff" />
    <rect x="426.7" width="213.3" height="480" fill="#ce1126" />
  </svg>
);

const FlagGB = () => (
  <svg className="h-4 w-5 rounded-sm" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
    <path fill="#012169" d="M0 0h640v480H0z" />
    <path fill="#FFF" d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z" />
    <path fill="#C8102E" d="m424 281 216 159v40L369 281h55zm-184 20 6 35L54 480H0l240-179zM640 0v3L391 191l2-44L590 0h50zM0 0l239 176h-60L0 42V0z" />
    <path fill="#FFF" d="M241 0v480h160V0H241zM0 160v160h640V160H0z" />
    <path fill="#C8102E" d="M0 193v96h640v-96H0zM273 0v480h96V0h-96z" />
  </svg>
);

const flags: Record<string, () => JSX.Element> = {
  fr: FlagFR,
  en: FlagGB,
};

const languages: Language[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];

const HeaderLanguageIcon = (): JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={headerActionIconClassName}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.9 9.5h16.2" />
    <path d="M3.9 14.5h16.2" />
    <path d="M12 3.5c2.3 2.4 3.6 5.4 3.6 8.5S14.3 18.1 12 20.5" />
    <path d="M12 3.5c-2.3 2.4-3.6 5.4-3.6 8.5s1.3 6.1 3.6 8.5" />
  </svg>
);

const LanguageSelector = ({ variant = 'default' }: LanguageSelectorProps): JSX.Element => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const normalizedLanguage = i18n.resolvedLanguage?.toLowerCase().startsWith('en') ? 'en' : 'fr';
  const currentLanguage = languages.find((lang) => lang.code === normalizedLanguage) || languages[0];
  const isHeader = variant === 'header';

  useEffect(() => {
    if (!isOpen) return;

    const updateMenuPosition = () => {
      const button = buttonRef.current;
      if (!button) return;

      const { bottom, right } = button.getBoundingClientRect();
      setMenuPosition({
        top: bottom + 10,
        left: right - 160,
      });
    };

    const rafId = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const buttonClassName = isHeader
    ? headerActionButtonClassName
    : 'p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300';


  const menu = isOpen && buttonRef.current
    ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[70] w-40 origin-top-right rounded-[13px] border border-[#E4E4E7] bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_14px_rgba(0,0,0,0.07)] focus:outline-none dark:border-[#343a46] dark:bg-[#22262e]"
          style={menuPosition}
        >
          {languages.map((language) => {
            const isActive = currentLanguage.code === language.code;
            return (
              <button
                key={language.code}
                onClick={() => {
                  void i18n.changeLanguage(language.code);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-[#F5F3FF] text-[#18181B] dark:bg-[#7c5cff]/16 dark:text-[#f4f5f7]'
                    : 'text-[#52525B] hover:bg-[#F3F2EF] hover:text-[#18181B] dark:text-[#c4cad4] dark:hover:bg-[#2a2f38] dark:hover:text-[#f4f5f7]'
                }`}
              >
                <span className="mr-2 flex-shrink-0">{flags[language.code]()}</span>
                {t(`header.language.${language.code}`)}
                {isActive && <span className="ml-auto text-[#6B4EFF]">✓</span>}
              </button>
            );
          })}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="sr-only">{t('header.changeLanguage')}</span>
        <HeaderLanguageIcon />
      </button>
      {menu}
    </>
  );
};

export default LanguageSelector;
