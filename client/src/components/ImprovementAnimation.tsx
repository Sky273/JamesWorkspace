/**
 * ImprovementAnimation Component
 * Polished animation shown during CV improvement (improving + analyzing steps).
 * Can render inline or as a fullscreen overlay.
 */

import { useState, useEffect, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SparklesIcon, ChartBarIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface ImprovementAnimationProps {
  currentStep?: string;
  fullscreen?: boolean;
}

const IMPROVING_MESSAGES = [
  'Restructuration du résumé professionnel...',
  'Optimisation des compétences techniques...',
  'Amélioration de la lisibilité ATS...',
  'Renforcement des expériences clés...',
  'Harmonisation du style rédactionnel...',
  'Ajustement des mots-clés sectoriels...',
  'Factualisation des réalisations...',
  'Polissage de la mise en forme...',
];

const ANALYZING_MESSAGES = [
  'Calcul des scores de qualité...',
  'Évaluation de la compatibilité ATS...',
  'Analyse des compétences identifiées...',
  'Comparaison avant / après...',
  "Extraction des axes d'amélioration...",
  'Vérification de la cohérence globale...',
];

const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 4 + 2,
  duration: 3 + Math.random() * 4,
  delay: Math.random() * 2,
}));

const FloatingParticles = ({ color }: { color: string }) => (
  <>
    {PARTICLES.map((p) => (
      <motion.div
        key={p.id}
        className={`absolute rounded-full ${color}`}
        style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
        animate={{
          y: [0, -20, 0],
          x: [0, (p.id % 2 === 0 ? 8 : -8), 0],
          opacity: [0, 0.6, 0],
          scale: [0.5, 1.2, 0.5],
        }}
        transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
      />
    ))}
  </>
);

const MultiRingSpinner = ({ variant }: { variant: 'improving' | 'analyzing' }) => {
  const isImproving = variant === 'improving';
  const Icon = isImproving ? SparklesIcon : ChartBarIcon;

  return (
    <div className="relative w-32 h-32" aria-hidden="true">
      <motion.div
        className={`absolute -inset-4 rounded-full ${isImproving
          ? 'bg-[#6b4eff]/10'
          : 'bg-gradient-to-br from-emerald-400/10 to-teal-500/10'
        }`}
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className={`absolute inset-0 rounded-full border-[3px] ${isImproving
          ? 'border-[#6b4eff]/25 dark:border-[#a3a6ff]/25'
          : 'border-emerald-200/50 dark:border-emerald-800/30'
        }`}
        style={{
          borderTopColor: isImproving ? '#6b4eff' : 'rgb(16,185,129)',
          borderRightColor: isImproving ? '#6b4eff' : 'rgb(16,185,129)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className={`absolute inset-3 rounded-full border-[3px] ${isImproving
          ? 'border-[#6b4eff]/20 dark:border-[#a3a6ff]/20'
          : 'border-teal-200/30 dark:border-teal-800/20'
        }`}
        style={{
          borderBottomColor: isImproving ? '#5b3eee' : 'rgb(13,148,136)',
          borderLeftColor: isImproving ? '#5b3eee' : 'rgb(13,148,136)',
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className={`absolute inset-6 rounded-full border-[2px] ${isImproving
          ? 'border-purple-200/20 dark:border-purple-800/15'
          : 'border-cyan-200/20 dark:border-cyan-800/15'
        }`}
        style={{
          borderTopColor: isImproving ? 'rgb(147,51,234)' : 'rgb(6,182,212)',
          borderRightColor: isImproving ? 'rgb(147,51,234)' : 'rgb(6,182,212)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${isImproving
            ? 'bg-[#6b4eff] shadow-none'
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
          }`}
          animate={{ scale: [1, 1.08, 1], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon className="w-7 h-7 text-white" />
          <motion.div
            className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/25 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
          />
        </motion.div>
      </div>
    </div>
  );
};

const ImprovementAnimation = ({ currentStep = 'improving', fullscreen = false }: ImprovementAnimationProps): JSX.Element => {
  const { t } = useTranslation();
  const headingId = useId();
  const descriptionId = useId();
  const [messageIndex, setMessageIndex] = useState(0);

  const isImproving = currentStep === 'improving';
  const messages = useMemo(() => (isImproving ? IMPROVING_MESSAGES : ANALYZING_MESSAGES), [isImproving]);
  const currentMessage = messages[messageIndex];
  const currentStepLabel = isImproving
    ? t('improvementAnimation.steps.improving.label', 'Amélioration du CV en cours...')
    : t('improvementAnimation.steps.analyzing.label', 'Analyse de qualité en cours...');
  const estimatedTimeLabel = isImproving
    ? t('improvementAnimation.estimatedTime', 'Cela peut prendre 30-90 secondes')
    : t('improvementAnimation.analyzingTime', 'Quelques secondes...');

  useEffect(() => {
    setMessageIndex(0);
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [messages]);

  const steps = [
    {
      id: 'improving',
      label: t('improvementAnimation.steps.improving.label', 'Amélioration du CV'),
      icon: SparklesIcon,
    },
    {
      id: 'analyzing',
      label: t('improvementAnimation.steps.analyzing.label', 'Analyse de qualité'),
      icon: ChartBarIcon,
    },
  ];

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
    >
      <div className={`absolute inset-0 ${isImproving
        ? 'bg-[#f8f8f7] dark:bg-[#111827]'
        : 'bg-gradient-to-br from-emerald-50/60 via-transparent to-teal-50/40 dark:from-emerald-950/20 dark:via-transparent dark:to-teal-950/15'
      }`} />

      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <FloatingParticles color={isImproving ? 'bg-[#6b4eff]/30' : 'bg-emerald-400/40'} />
      </div>

      <div className="sr-only" id={descriptionId}>
        {`${currentStepLabel}. ${currentMessage}. ${estimatedTimeLabel}`}
      </div>

      <div className="relative flex flex-col items-center py-16 px-6">
        <div className="mb-8">
          <MultiRingSpinner variant={isImproving ? 'improving' : 'analyzing'} />
        </div>

        <AnimatePresence mode="wait">
          <motion.h3
            id={headingId}
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-2 text-center text-xl font-semibold text-gray-900 dark:text-gray-100"
          >
            {currentStepLabel}
          </motion.h3>
        </AnimatePresence>

        <div className="h-6 mb-6">
          <AnimatePresence mode="wait">
            <motion.p
              key={messageIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="text-center text-sm text-gray-500 dark:text-gray-400"
            >
              {currentMessage}
            </motion.p>
          </AnimatePresence>
        </div>

        <div
          className={`mb-8 h-1.5 w-72 overflow-hidden rounded-full ${isImproving
            ? 'bg-[#f4f2ff] dark:bg-white/10'
            : 'bg-emerald-100 dark:bg-emerald-900/30'
          }`}
          aria-hidden="true"
        >
          <motion.div
            className={`relative h-full w-1/2 rounded-full ${isImproving
              ? 'bg-[#6b4eff]'
              : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500'
            }`}
            animate={{ left: ['-50%', '100%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="mb-6 flex items-center gap-0" aria-hidden="true">
          {steps.map((step, i) => {
            const isActive = step.id === currentStep;
            const isPast = currentStepIndex > i;
            const StepIcon = step.icon;

            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <motion.div
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-500 ${
                      isPast
                        ? 'bg-gradient-to-br from-emerald-400 to-green-600 shadow-md shadow-green-500/20'
                        : isActive
                          ? isImproving
                            ? 'bg-[#6b4eff] shadow-none'
                            : 'bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md shadow-emerald-500/25'
                          : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                    animate={isActive ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                    transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
                  >
                    {isPast ? (
                      <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                      >
                        <CheckCircleIcon className="w-5 h-5 text-white" />
                      </motion.div>
                    ) : (
                      <StepIcon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
                    )}
                  </motion.div>
                  <span className={`mt-1.5 text-xs font-medium ${
                    isPast ? 'text-emerald-600 dark:text-emerald-400'
                      : isActive ? (isImproving ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400')
                        : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className="mx-2 -mt-5 h-[3px] w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 sm:mx-3 sm:w-24">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
                      initial={false}
                      animate={{ width: isPast ? '100%' : isActive ? '35%' : '0%' }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          {estimatedTimeLabel}
        </p>

        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${isImproving ? 'bg-indigo-400' : 'bg-emerald-400'}`}
              animate={{ y: [0, -6, 0], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );

  if (fullscreen) {
    const overlay = (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm"
        data-testid="improvement-animation-fullscreen-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="mx-4 w-full max-w-3xl"
        >
          {content}
        </motion.div>
      </motion.div>
    );

    return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
  }

  return content;
};

export default ImprovementAnimation;
