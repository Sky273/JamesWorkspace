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
    <footer className="px-4 pb-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="cv-panel rounded-[2rem] px-6 py-6 sm:px-8">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <a href="https://www.aptea.net/" target="_blank" rel="noopener noreferrer" className="opacity-80 transition-opacity hover:opacity-100">
              <ApteaLogo className="h-12 text-slate-900 dark:text-white" />
            </a>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm sm:gap-4">
              <Link
                to="/privacy"
                className="text-slate-600 transition-colors hover:text-slate-900 dark:text-[var(--cv-muted)] dark:hover:text-[var(--cv-text)]"
              >
                {t('footer.privacy')}
              </Link>
              <span className="text-slate-300 dark:text-white/12">|</span>
              <Link
                to="/terms"
                className="text-slate-600 transition-colors hover:text-slate-900 dark:text-[var(--cv-muted)] dark:hover:text-[var(--cv-text)]"
              >
                {t('footer.terms')}
              </Link>
            </div>
            <p className="text-sm text-slate-500 dark:text-[var(--cv-muted)]">(c) {new Date().getFullYear()} Aptea. {t('footer.allRightsReserved')}</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
