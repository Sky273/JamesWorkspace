import { Suspense } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import DeferredWebGLBackground from '../DeferredWebGLBackground';
import ResumeHeroVisual from './ResumeHeroVisual';

interface HomeHeroSectionProps {
  webglEnabled: boolean;
  onStart: () => void;
}

export default function HomeHeroSection({ webglEnabled, onStart }: HomeHeroSectionProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <section id="hero" className="min-h-[80vh] flex items-center py-8 relative overflow-hidden isolate scroll-mt-20">
      {webglEnabled && (
        <Suspense fallback={null}>
          <DeferredWebGLBackground />
        </Suspense>
      )}
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <motion.h1 className="text-5xl font-bold mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="block">{t('home.hero.title1')}</span>
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
            <motion.p className="text-xl text-gray-600 dark:text-gray-300 mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {t('home.hero.description')}
            </motion.p>
            <motion.button
              onClick={onStart}
              className="app-primary-action rounded-lg px-8 py-3 text-lg font-semibold"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {t('home.hero.startButton')}
            </motion.button>

            <motion.div
              className="flex flex-wrap items-center justify-center lg:justify-start gap-6 pt-8 text-gray-500 dark:text-gray-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 0.5 }}
              whileHover={{ opacity: 1 }}
            >
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-400"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
                <span className="text-sm font-medium">{t('home.hero.badges.atsFriendly')}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>
                <span className="text-sm font-medium">{t('home.hero.badges.fastAnalysis')}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>
                <span className="text-sm font-medium">{t('home.hero.badges.secure')}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
                <span className="text-sm font-medium">{t('home.hero.badges.gdprCompliant')}</span>
              </div>
            </motion.div>
          </motion.div>
          <div className="hidden lg:block">
            <ResumeHeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
