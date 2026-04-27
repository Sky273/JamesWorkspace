import { motion } from 'framer-motion';
import { BriefcaseIcon, CheckCircleIcon, DocumentTextIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

type Step = 'loading' | 'select-mission' | 'analyzing' | 'show-analysis' | 'adapting' | 'show-result' | 'error';

interface AdaptProgressStepsProps {
  step: Step;
  t: TFunction;
}

export default function AdaptProgressSteps({ step, t }: AdaptProgressStepsProps): JSX.Element {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-center">
        {[
          {
            key: 'select',
            label: t('adaptation.steps.selectMission'),
            icon: BriefcaseIcon,
            completed: ['analyzing', 'show-analysis', 'adapting', 'show-result'].includes(step),
            active: step === 'select-mission',
          },
          {
            key: 'analyze',
            label: t('adaptation.steps.analyze'),
            icon: DocumentTextIcon,
            completed: ['adapting', 'show-result'].includes(step),
            active: ['analyzing', 'show-analysis'].includes(step),
          },
          {
            key: 'adapt',
            label: t('adaptation.steps.adapt'),
            icon: SparklesIcon,
            completed: step === 'show-result',
            active: step === 'adapting',
          },
        ].map((s, i, arr) => (
          <div key={s.key} className="flex items-start">
            <div className="flex flex-col items-center">
              <div className="relative">
                {s.active && (
                  <motion.div
                    className="absolute -inset-2 rounded-full"
                    style={{ background: 'rgba(107,78,255,0.12)' }}
                    animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                <motion.div
                  className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-shadow duration-500 ${
                    s.completed
                      ? 'bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg shadow-green-500/25'
                      : s.active
                        ? 'bg-[#6b4eff] shadow-none'
                        : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                  animate={s.active ? { scale: [1, 1.07, 1] } : { scale: 1 }}
                  transition={s.active ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
                >
                  {s.completed ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                    >
                      <CheckCircleIcon className="w-6 h-6 text-white" />
                    </motion.div>
                  ) : (
                    <s.icon className={`w-5 h-5 ${s.active ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
                  )}
                </motion.div>
              </div>
              <motion.span
                className={`mt-2.5 text-xs font-semibold tracking-wide ${
                  s.completed ? 'text-emerald-600 dark:text-emerald-400' :
                  s.active ? 'text-[#6b4eff] dark:text-[#c9ccff]' :
                  'text-gray-400 dark:text-gray-500'
                }`}
                animate={s.active ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
                transition={s.active ? { duration: 2, repeat: Infinity } : {}}
              >
                {s.label}
              </motion.span>
            </div>
            {i < arr.length - 1 && (
              <div className="w-20 sm:w-32 h-[3px] mx-3 sm:mx-5 mt-[20px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
                  initial={false}
                  animate={{ width: s.completed ? '100%' : s.active ? '40%' : '0%' }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
