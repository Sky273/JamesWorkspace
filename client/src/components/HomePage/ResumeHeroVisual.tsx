import { motion } from 'framer-motion';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

export default function ResumeHeroVisual(): JSX.Element {
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
              {t('home.hero.analysisComplete', 'Analyse terminee')}
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

          <div className="absolute bottom-4 right-4">
            <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-lg shadow-primary-600/30 pointer-events-none">
              <SparklesIcon className="w-5 h-5" />
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
