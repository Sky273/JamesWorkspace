/**
 * PublicHomePage Component
 * Public landing page for unauthenticated users
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SparklesIcon } from '@heroicons/react/24/outline';
import Footer from '../components/Footer';
import PublicWorkflowCarousel from '../components/public/PublicWorkflowCarousel';
import ResumeHeroVisual from '../components/HomePage/ResumeHeroVisual';


const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

function PublicHeader(): JSX.Element {
  const { t } = useTranslation();
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <SparklesIcon className="w-8 h-8 text-primary-500" />
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">ResumeConverter</span>
          </Link>
          
          {/* Auth Links */}
          <div className="flex items-center gap-5">
            <div className="hidden items-center gap-4 text-sm text-gray-500 dark:text-gray-400 md:flex">
              <Link to="/privacy" className="transition hover:text-gray-900 dark:hover:text-gray-100">Confidentialité</Link>
              <Link to="/terms" className="transition hover:text-gray-900 dark:hover:text-gray-100">Conditions</Link>
            </div>
            <Link 
              to="/signin" 
              className="public-cta-secondary px-4 py-2"
            >
              {t('common.signIn', 'Se connecter')}
            </Link>
            <Link 
              to="/register" 
              className="public-cta-primary px-4 py-2"
            >
              {t('common.register', "S'inscrire")}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function PublicHomePage(): JSX.Element {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      <motion.div 
        initial="initial" 
        animate="animate" 
        exit="exit"
      className="flex min-h-screen flex-col bg-[#f3f2ef] dark:bg-[#111827]"
      >
        {/* Public Header */}
        <PublicHeader />

        {/* Hero Section */}
        <section className="flex-1 flex items-center pt-24 pb-12 relative overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div variants={fadeInUp}>
                <motion.h1 
                  className="text-5xl font-bold mb-6"
                  variants={stagger}
                >
                  <span className="block text-gray-900 dark:text-gray-100">{t('home.hero.title1')}</span>
                  <span className="block">
                    <span
                      className="inline-block text-transparent"
                      style={{
                        backgroundImage: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 52%, #d946ef 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      {t('home.hero.title2')}
                    </span>
                  </span>
                </motion.h1>
                <motion.p 
                  className="text-xl text-gray-600 dark:text-gray-300 mb-8"
                  variants={fadeInUp}
                >
                  {t('home.hero.description')}
                </motion.p>
                <motion.div className="flex flex-wrap gap-4">
                  <Link
                    to="/register"
                    className="public-cta-primary px-8 py-3 text-lg inline-block"
                  >
                    {t('public.home.getStarted', 'Commencer gratuitement')}
                  </Link>
                  <Link
                    to="/signin"
                    className="public-cta-secondary px-8 py-3 text-lg inline-block"
                  >
                    {t('common.signIn', 'Se connecter')}
                  </Link>
                </motion.div>
                <div className="mt-5 flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <Link to="/privacy" className="transition hover:text-gray-900 dark:hover:text-gray-100">Politique de confidentialité</Link>
                  <Link to="/terms" className="transition hover:text-gray-900 dark:hover:text-gray-100">Conditions d'utilisation</Link>
                </div>

                {/* Trust Badges */}
                <motion.div 
                  className="flex flex-wrap items-center justify-center lg:justify-start gap-6 pt-8 text-gray-500 dark:text-gray-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ opacity: 1 }}
                >
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-400">
                      <circle cx="12" cy="12" r="10" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <span className="text-sm font-medium">{t('home.hero.badges.atsFriendly', 'ATS Friendly')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
                    </svg>
                    <span className="text-sm font-medium">{t('home.hero.badges.fastAnalysis', 'Analyse rapide')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                    </svg>
                    <span className="text-sm font-medium">{t('home.hero.badges.secure', '100% Sécurisé')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <span className="text-sm font-medium">{t('home.hero.badges.gdprCompliant', 'Compatible RGPD')}</span>
                  </div>
                </motion.div>
              </motion.div>
              <div className="hidden lg:flex justify-center">
                <ResumeHeroVisual />
              </div>
            </div>
          </div>
        </section>

        <PublicWorkflowCarousel />

        {/* Footer */}
        <Footer />
      </motion.div>
    </AnimatePresence>
  );
}

export default PublicHomePage;
