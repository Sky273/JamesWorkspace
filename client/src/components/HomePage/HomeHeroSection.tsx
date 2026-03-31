import { Suspense } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import DeferredWebGLBackground from '../DeferredWebGLBackground';

export function HeroVisual(): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="relative w-full max-w-xs">
      <div className="absolute -top-12 -right-12 w-56 h-56 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-[60px] pointer-events-none" />
      <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-[40px] pointer-events-none" />

      <div className="relative z-10" style={{ perspective: '1000px' }}>
        <div className="absolute top-4 right-4 w-full h-full bg-gray-200/60 dark:bg-gray-700/40 rounded-xl border border-gray-300/50 dark:border-white/5 transform rotate-6 scale-95 blur-[1px]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl p-4 shadow-2xl shadow-gray-400/30 dark:shadow-black/50 overflow-hidden pointer-events-none select-none"
          style={{ aspectRatio: '4/5' }}
        >
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
              {t('home.hero.analysisComplete')}
            </div>
          </div>

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

            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="bg-primary-100 dark:bg-primary-500/10 border border-primary-300 dark:border-primary-500/20 rounded-lg p-3 mt-2"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1 bg-primary-200 dark:bg-primary-500/20 rounded-md">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-primary-600 dark:text-primary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6 7 18.2l1.9-5.8L4 8.8h6.1L12 3Z" /></svg>
                </div>
                <span className="text-xs font-medium text-primary-700 dark:text-primary-200">{t('home.hero.aiSuggestion')}</span>
              </div>
              <p className="text-[10px] text-primary-700/80 dark:text-primary-200/70 leading-relaxed">
                {t('home.hero.suggestionText', { defaultValue: "Augmentez l'impact de cette section en utilisant des verbes d'action plus forts." })}
              </p>
            </motion.div>

            <div className="space-y-2 pt-2 opacity-50">
              <div className="h-2 bg-gray-200 dark:bg-gray-700/30 rounded w-full" />
              <div className="h-2 bg-gray-200 dark:bg-gray-700/30 rounded w-11/12" />
            </div>
          </div>

          <div className="absolute bottom-4 right-4">
            <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-lg shadow-primary-600/30 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6 7 18.2l1.9-5.8L4 8.8h6.1L12 3Z" /></svg>
            </div>
          </div>

          <motion.div
            className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent opacity-50"
            animate={{ y: [0, 400, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </div>
    </div>
  );
}

interface HomeHeroSectionProps {
  webglEnabled: boolean;
  onStart: () => void;
}

export default function HomeHeroSection({ webglEnabled, onStart }: HomeHeroSectionProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <section className="min-h-[80vh] flex items-center py-8 relative overflow-hidden isolate">
      {webglEnabled && (
        <Suspense fallback={null}>
          <DeferredWebGLBackground />
        </Suspense>
      )}
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div id="hero" className="scroll-mt-20" />
            <motion.h1 className="text-5xl font-bold mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="block">{t('home.hero.title1')}</span>
              <span className="block text-primary-600 dark:text-primary-500">{t('home.hero.title2')}</span>
            </motion.h1>
            <motion.p className="text-xl text-gray-600 dark:text-gray-300 mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {t('home.hero.description')}
            </motion.p>
            <motion.button
              onClick={onStart}
              className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors"
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
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
