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

function HeroVisual(): JSX.Element {
  const { t } = useTranslation();
  
  return (
    <div className="relative w-full max-w-xs">
      {/* Abstract Decorative Elements */}
      <div className="absolute -top-12 -right-12 w-56 h-56 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-[60px] pointer-events-none" />
      <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-[40px] pointer-events-none" />

      {/* Card Stack */}
      <div className="relative z-10" style={{ perspective: '1000px' }}>
        {/* Background Card */}
        <div className="absolute top-4 right-4 w-full h-full bg-gray-200/60 dark:bg-gray-700/40 rounded-xl border border-gray-300/50 dark:border-white/5 transform rotate-6 scale-95 blur-[1px]" />

        {/* Main Card (Resume UI) - Visual only, not interactive */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl p-4 shadow-2xl shadow-gray-400/30 dark:shadow-black/50 overflow-hidden pointer-events-none select-none"
          style={{ aspectRatio: '4/5' }}
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-amber-500/50" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
            </div>
            <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {t('home.hero.analysisComplete', 'Analyse terminée')}
            </div>
          </div>

          {/* Content Skeleton */}
          <div className="space-y-4 flex-1">
            <div className="flex gap-4 items-center border-b border-gray-200 dark:border-white/5 pb-4">
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700/50" />
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-gray-300 dark:bg-gray-600/50 rounded w-1/2" />
                <div className="h-2 bg-gray-200 dark:bg-gray-700/50 rounded w-1/3" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="h-2 bg-gray-200 dark:bg-gray-700/30 rounded w-full" />
              <div className="h-2 bg-gray-200 dark:bg-gray-700/30 rounded w-5/6" />
              <div className="h-2 bg-gray-200 dark:bg-gray-700/30 rounded w-4/6" />
            </div>

            {/* Analysis Overlay Block */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="bg-primary-100 dark:bg-primary-500/10 border border-primary-300 dark:border-primary-500/20 rounded-lg p-3 mt-2"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1 bg-primary-200 dark:bg-primary-500/20 rounded-md">
                  <SparklesIcon className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                </div>
                <span className="text-xs font-medium text-primary-700 dark:text-primary-200">{t('home.hero.aiSuggestion', 'Suggestion IA')}</span>
              </div>
              <p className="text-[10px] text-primary-700/80 dark:text-primary-200/70 leading-relaxed">
                {t('home.hero.suggestionText', "Augmentez l'impact de cette section en utilisant des verbes d'action plus forts.")}
              </p>
            </motion.div>

            <div className="space-y-2 pt-2 opacity-50">
              <div className="h-2 bg-gray-200 dark:bg-gray-700/30 rounded w-full" />
              <div className="h-2 bg-gray-200 dark:bg-gray-700/30 rounded w-11/12" />
            </div>
          </div>

          {/* AI Agent Icon - Visual only, not interactive */}
          <div className="absolute bottom-4 right-4">
            <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-lg shadow-primary-600/30 pointer-events-none">
              <SparklesIcon className="w-5 h-5" />
            </div>
          </div>

          {/* Scanning Line Effect */}
          <motion.div
            className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent opacity-50"
            animate={{ y: [0, 400, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </div>
  );
}

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
        className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900"
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
                  <span
                    className="block text-transparent"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 45%, #d946ef 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textShadow: '0 10px 24px rgba(124, 58, 237, 0.18)',
                    }}
                  >
                    {t('home.hero.title2')}
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
                <HeroVisual />
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
