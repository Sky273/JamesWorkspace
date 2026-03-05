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
    <footer className="footer bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center space-y-4">
          <a href="https://www.aptea.net/" target="_blank" rel="noopener noreferrer">
            <ApteaLogo className="h-12" />
          </a>
          <div className="flex items-center gap-4 text-sm">
            <Link 
              to="/privacy" 
              className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
            >
              {t('footer.privacy')}
            </Link>
            <span className="text-gray-400 dark:text-gray-600">|</span>
            <Link 
              to="/terms" 
              className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
            >
              {t('footer.terms')}
            </Link>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">© {new Date().getFullYear()} Aptea. {t('footer.allRightsReserved')}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
