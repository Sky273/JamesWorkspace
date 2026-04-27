/**
 * Footer Component
 * TypeScript version
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ApteaLogo from './ApteaLogo';

const Footer = (): JSX.Element => {
  const { t } = useTranslation();

  return (
    <footer className="pointer-events-none border-t border-[#E4E4E7] bg-white shadow-none">
      <div className="pointer-events-auto min-h-[9.5rem] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <a
            href="https://www.aptea.net/"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-80 hover:opacity-100"
          >
            <ApteaLogo className="h-12 w-[5.6875rem] text-[#18181B]" />
          </a>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm sm:gap-4">
            <Link
              to="/privacy"
              className="text-[#52525B] hover:text-[#18181B]"
            >
              {t('footer.privacy')}
            </Link>
            <span className="text-[#D4D4D8]">|</span>
            <Link
              to="/terms"
              className="text-[#52525B] hover:text-[#18181B]"
            >
              {t('footer.terms')}
            </Link>
          </div>
          <p className="text-sm text-[#52525B]">(c) {new Date().getFullYear()} Aptea. {t('footer.allRightsReserved')}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
