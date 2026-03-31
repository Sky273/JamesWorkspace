import { ForwardRefExoticComponent, RefAttributes, SVGProps, lazy, useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { useTranslation } from 'react-i18next';
import {
  DocumentTextIcon,
  SparklesIcon,
  ArrowUpIcon,
  ChartBarIcon,
  DocumentDuplicateIcon,
  BriefcaseIcon,
  DocumentMagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { useAuthFetch } from '../hooks/useAuthFetch';
import HomeStickyNav from '../components/HomePage/HomeStickyNav';
import HomeHeroSection from '../components/HomePage/HomeHeroSection';
import HomeHowItWorksSection from '../components/HomePage/HomeHowItWorksSection';
import HomeFeaturesSection from '../components/HomePage/HomeFeaturesSection';
import HomeScrollTopButton from '../components/HomePage/HomeScrollTopButton';

const HomeDashboard = lazy(() => import('../components/HomeDashboard'));

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

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
  const [dashboardRef, dashboardInView] = useInView({
    triggerOnce: true,
    rootMargin: '320px 0px'
  });

  const fetchWebglSetting = useCallback(() => {
    let cancelled = false;
    authGet('/api/settings')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data?.webglEnabled === 'off') {
          setWebglEnabled(false);
        }
      })
      .catch(() => {
        // keep default: enabled
      });
    return () => {
      cancelled = true;
    };
  }, [authGet]);

  useEffect(() => fetchWebglSetting(), [fetchWebglSetting]);

  const navSections: NavSection[] = useMemo(() => [
    { id: 'hero', label: t('home.nav.hero') },
    { id: 'dashboard', label: t('home.nav.dashboard') },
    { id: 'how-it-works', label: t('home.nav.howItWorks') },
    { id: 'features', label: t('home.nav.features') }
  ], [t]);

  const handleScrollSpy = useCallback(() => {
    const scrollPosition = window.scrollY + 150;
    setIsScrolled(window.scrollY > 300);

    for (let i = navSections.length - 1; i >= 0; i -= 1) {
      const section = document.getElementById(navSections[i].id);
      if (section && section.offsetTop <= scrollPosition) {
        setActiveSection(navSections[i].id);
        break;
      }
    }
  }, [navSections]);

  useEffect(() => {
    window.addEventListener('scroll', handleScrollSpy);
    handleScrollSpy();
    return () => window.removeEventListener('scroll', handleScrollSpy);
  }, [handleScrollSpy]);

  const scrollToSection = useCallback((sectionId: string) => {
    if (sectionId === 'hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
    }
  }, []);

  const features: Feature[] = useMemo(() => [
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
  ], [t]);

  const howItWorksItems: HowItWorksItem[] = useMemo(() => [
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
  ], [t]);

  return (
    <AnimatePresence>
      <motion.div initial="initial" animate="animate" exit="exit">
        <HomeStickyNav navSections={navSections} activeSection={activeSection} onNavigate={scrollToSection} />

        <HomeHeroSection webglEnabled={webglEnabled} onStart={() => navigate('/upload?new')} />

        <div id="dashboard" ref={dashboardRef} className="scroll-mt-32">
          {dashboardInView ? (
            <Suspense fallback={<div className="py-12" />}>
              <HomeDashboard />
            </Suspense>
          ) : (
            <div className="py-12" />
          )}
        </div>

        <HomeHowItWorksSection items={howItWorksItems} />
        <HomeFeaturesSection features={features} />
        <HomeScrollTopButton onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
      </motion.div>
    </AnimatePresence>
  );
}

export default HomePage;
