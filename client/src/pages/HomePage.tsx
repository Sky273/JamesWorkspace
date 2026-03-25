/**
 * HomePage Component
 * TypeScript version
 */

import { ForwardRefExoticComponent, RefAttributes, SVGProps, useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import DeferredWebGLBackground from '../components/DeferredWebGLBackground';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { useTranslation } from 'react-i18next';
import {
  DocumentTextIcon,
  CogIcon,
  SparklesIcon,
  ArrowUpIcon,
  ChartBarIcon,
  DocumentDuplicateIcon,
  BriefcaseIcon,
  DocumentMagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import HomeDashboard from '../components/HomeDashboard';
import { useAuthFetch } from '../hooks/useAuthFetch';


type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

interface FeatureCardProps {
  icon: HeroIcon;
  title: string;
  description: string;
  delay: number;
}

interface Feature {
  icon: HeroIcon;
  title: string;
  description: string;
}

interface HowItWorksItem {
  step: number;
  title: string;
  description: string;
  icon: HeroIcon;
}

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

function FeatureCard({ icon: Icon, title, description, delay }: FeatureCardProps): JSX.Element {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1
  });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
    >
      <div className="flex items-center space-x-4">
        <motion.div
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.5 }}
          className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg"
        >
          <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </motion.div>
        <h3 className="text-xl font-semibold">{title}</h3>
      </div>
      <p className="mt-4 text-gray-600 dark:text-gray-300">{description}</p>
    </motion.div>
  );
}

interface NavSection {
  id: string;
  label: string;
}

function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { authGet } = useAuthFetch();
  const [activeSection, setActiveSection] = useState<string>('hero');
  const [, setIsScrolled] = useState<boolean>(false);
  const [webglEnabled, setWebglEnabled] = useState<boolean>(true);
  const [featuresRef] = useInView({
    triggerOnce: true,
    threshold: 0.1
  });

  // Fetch WebGL setting — default is ON, only disable if explicitly 'off'
  useEffect(() => {
    let cancelled = false;
    authGet('/api/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled && data?.webglEnabled === 'off') {
          setWebglEnabled(false);
        }
      })
      .catch(() => { /* keep default: enabled */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const navSections: NavSection[] = useMemo(() => [
    { id: 'hero', label: t('home.nav.hero', 'Accueil') },
    { id: 'dashboard', label: t('home.nav.dashboard', 'Tableau de bord') },
    { id: 'how-it-works', label: t('home.nav.howItWorks', 'Comment ça marche') },
    { id: 'features', label: t('home.nav.features', 'Fonctionnalités clés') }
   
  ], [t]);

  const handleScrollSpy = useCallback(() => {
    const scrollPosition = window.scrollY + 150;
    
    // Check if page is scrolled past hero
    setIsScrolled(window.scrollY > 300);

    // Find the active section
    for (let i = navSections.length - 1; i >= 0; i--) {
      const section = document.getElementById(navSections[i].id);
      if (section && section.offsetTop <= scrollPosition) {
        setActiveSection(navSections[i].id);
        break;
      }
    }
  }, [navSections]);

  useEffect(() => {
    window.addEventListener('scroll', handleScrollSpy);
    handleScrollSpy(); // Initial check
    return () => window.removeEventListener('scroll', handleScrollSpy);
  }, [handleScrollSpy]);

  const scrollToSection = (sectionId: string) => {
    // For hero section, scroll to top of page
    if (sectionId === 'hero') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      return;
    }
    
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      });
    }
  };

  const features: Feature[] = [
    {
      icon: SparklesIcon,
      title: t('home.features.ai.title'),
      description: t('home.features.ai.description')
    },
    {
      icon: ArrowUpIcon,
      title: t('home.features.improvement.title'),
      description: t('home.features.improvement.description')
    },
    {
      icon: ChartBarIcon,
      title: t('home.features.scoring.title'),
      description: t('home.features.scoring.description')
    },
    {
      icon: DocumentMagnifyingGlassIcon,
      title: t('home.features.ocr.title'),
      description: t('home.features.ocr.description')
    },
    {
      icon: BriefcaseIcon,
      title: t('home.features.adaptation.title'),
      description: t('home.features.adaptation.description')
    },
    {
      icon: DocumentDuplicateIcon,
      title: t('home.features.templates.title'),
      description: t('home.features.templates.description')
    }
  ];

  const howItWorksItems: HowItWorksItem[] = [
    {
      step: 1,
      title: t('home.howItWorks.step1.title'),
      description: t('home.howItWorks.step1.description'),
      icon: DocumentTextIcon
    },
    {
      step: 2,
      title: t('home.howItWorks.step2.title'),
      description: t('home.howItWorks.step2.description'),
      icon: SparklesIcon
    },
    {
      step: 3,
      title: t('home.howItWorks.step3.title'),
      description: t('home.howItWorks.step3.description'),
      icon: BriefcaseIcon
    }
  ];

  return (
    <AnimatePresence>
      <motion.div initial="initial" animate="animate" exit="exit">
        {/* Sticky Navigation Bar with Scrollspy */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ 
            opacity: 1, 
            y: 0
          }}
          transition={{ duration: 0.3 }}
          className="sticky top-16 z-30 backdrop-blur-sm border-b border-transparent"
        >
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-center gap-2 py-3 overflow-x-auto scrollbar-hide">
              {navSections.map((section) => (
                <motion.button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`
                    relative px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
                    transition-all duration-300 ease-out
                    ${activeSection === section.id
                      ? 'bg-primary-500 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }
                  `}
                  animate={{
                    y: activeSection === section.id ? -4 : 0,
                    scale: activeSection === section.id ? 1.05 : 1,
                  }}
                  whileHover={{ scale: activeSection === section.id ? 1.05 : 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  {section.label}
                  {activeSection === section.id && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute inset-0 bg-primary-500 rounded-full -z-10"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.nav>

        <section className="min-h-[80vh] flex items-center py-8 relative overflow-hidden isolate">
          {/* WebGL Background Animation - hidden only when explicitly disabled in settings */}
          {webglEnabled && (
            <Suspense fallback={null}>
              <DeferredWebGLBackground />
            </Suspense>
          )}
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div variants={fadeInUp}>
                <div id="hero" className="scroll-mt-20" />
                <motion.h1 
                  className="text-5xl font-bold mb-6"
                  variants={stagger}
                >
                  <span className="block">{t('home.hero.title1')}</span>
                  <span className="block text-primary-600 dark:text-primary-500">
                    {t('home.hero.title2')}
                  </span>
                </motion.h1>
                <motion.p 
                  className="text-xl text-gray-600 dark:text-gray-300 mb-8"
                  variants={fadeInUp}
                >
                  {t('home.hero.description')}
                </motion.p>
                <motion.button
                  onClick={() => navigate('/upload?new')}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {t('home.hero.startButton')}
                </motion.button>

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
              <div className="hidden lg:block">
                <HeroVisual />
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Section - Only visible when authenticated */}
        <div id="dashboard" className="scroll-mt-32">
          <HomeDashboard />
        </div>

        <motion.section 
          id="how-it-works"
          className="py-24 mt-64 bg-white dark:bg-gray-800 scroll-mt-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div className="container mx-auto px-4">
            <motion.h2 
              className="text-4xl font-bold text-center mb-16"
              variants={fadeInUp}
            >
              {t('home.howItWorks.title')}
            </motion.h2>
            <div className="max-w-4xl mx-auto">
              {howItWorksItems.map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ 
                      duration: 0.5, 
                      delay: index * 0.2,
                      type: "spring",
                      stiffness: 100 
                    }}
                    className="flex items-center mb-12 last:mb-0"
                  >
                    <motion.div 
                      className="flex-shrink-0 w-16 h-16 rounded-full bg-primary-500 text-white flex items-center justify-center text-xl font-bold"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {item.step}
                    </motion.div>
                    <div className="ml-6">
                      <div className="flex items-center mb-2">
                        <motion.div 
                          className="mr-3 text-primary-500"
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.5 }}
                        >
                          <IconComponent className="w-8 h-8" />
                        </motion.div>
                        <motion.h3 
                          className="text-xl font-semibold"
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.2 }}
                        >
                          {item.title}
                        </motion.h3>
                      </div>
                      <motion.p 
                        className="text-gray-600 dark:text-gray-300"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 }}
                      >
                        {item.description}
                      </motion.p>
                      
                      {index === 0 && (
                        <motion.div 
                          className="mt-4 flex gap-2"
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.4 }}
                        >
                        </motion.div>
                      )}
                      
                      {index === 1 && (
                        <motion.div 
                          className="mt-4 flex items-center gap-2"
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.4 }}
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                          >
                            <CogIcon className="w-6 h-6 text-primary-500" />
                          </motion.div>
                          <div className="h-1 flex-grow bg-gray-200 dark:bg-gray-700 rounded">
                            <motion.div
                              className="h-full bg-primary-500 rounded"
                              initial={{ width: "0%" }}
                              whileInView={{ width: "100%" }}
                              viewport={{ once: true }}
                              transition={{ duration: 1.5, delay: 0.5 }}
                            />
                          </div>
                        </motion.div>
                      )}
                      
                      {index === 2 && (
                        <motion.div 
                          className="mt-4 grid grid-cols-3 gap-2"
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.4 }}
                        >
                          {[...Array(3)].map((_, i) => (
                            <motion.div
                              key={i}
                              className="h-2 bg-primary-200 dark:bg-primary-800 rounded"
                              initial={{ width: 0 }}
                              whileInView={{ width: "100%" }}
                              viewport={{ once: true }}
                              transition={{ delay: i * 0.2 }}
                            />
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        <motion.section
          ref={featuresRef}
          id="features"
          className="py-24 mt-32 scroll-mt-20"
          variants={stagger}
        >
          <div className="container mx-auto px-4">
            <motion.h2 
              className="text-4xl font-bold text-center mb-16"
              variants={fadeInUp}
            >
              {t('home.features.title')}
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <FeatureCard
                  key={index}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  delay={index * 0.1}
                />
              ))}
            </div>
          </div>
        </motion.section>

        <motion.button
          className="fixed bottom-8 right-8 p-4 bg-primary-500 text-white rounded-full shadow-lg hover:bg-primary-600 transition-colors z-40"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <ArrowUpIcon className="w-6 h-6" />
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}

export default HomePage;
