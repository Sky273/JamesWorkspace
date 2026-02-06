/**
 * ScrollToTop Component
 * Scrolls to top of page on route changes
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = (): null => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top when pathname changes
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
