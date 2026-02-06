/**
 * Footer Component
 * TypeScript version
 */

import ApteaLogo from './ApteaLogo';

const Footer = (): JSX.Element => {
  return (
    <footer className="footer">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center space-y-4">
          <a href="https://www.aptea.net/" target="_blank" rel="noopener noreferrer">
            <ApteaLogo className="h-12" />
          </a>
          <p className="text-sm text-gray-600 dark:text-gray-400">© {new Date().getFullYear()} Aptea. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
