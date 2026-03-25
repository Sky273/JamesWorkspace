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
    <footer className="border-t border-slate-200/80 bg-white/70 py-6 backdrop-blur-sm dark:border-white/6 dark:bg-[#0c1222]/72">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center space-y-4">
          <a href="https://www.aptea.net/" target="_blank" rel="noopener noreferrer" className="opacity-80 transition-opacity hover:opacity-100">
            <ApteaLogo className="h-12" />
          </a>
          <div className="flex items-center gap-4 text-sm">
            <Link
              to="/privacy"
              className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              {t('footer.privacy')}
            </Link>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <Link
              to="/terms"
              className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              {t('footer.terms')}
            </Link>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">© {new Date().getFullYear()} Aptea. {t('footer.allRightsReserved')}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
