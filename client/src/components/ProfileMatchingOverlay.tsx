/**
 * ProfileMatchingOverlay Component
 * Polished fullscreen overlay shown during profile matching search or detailed analysis.
 * Features multi-ring spinner, floating particles, cycling messages, shimmer progress bar.
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  UserGroupIcon,
  SparklesIcon,
  CpuChipIcon,
  DocumentMagnifyingGlassIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

// ─── Types ──────────────────────────────────────────────────

interface ProfileMatchingOverlayProps {
  mode: 'searching' | 'analyzing';
}

interface StepDef {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
}

// ─── Floating particles ─────────────────────────────────────

const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 4 + 2,
  dur: 3 + Math.random() * 4,
  delay: Math.random() * 2,
}));

const FloatingParticles = ({ className }: { className: string }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {PARTICLES.map(p => (
      <motion.div
        key={p.id}
        className={`absolute rounded-full ${className}`}
        style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
        animate={{
          y: [0, -20, 0],
          x: [0, (p.id % 2 === 0 ? 8 : -8), 0],
          opacity: [0, 0.5, 0],
          scale: [0.5, 1.2, 0.5],
        }}
        transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
      />
    ))}
  </div>
);

// ─── Multi-ring spinner ─────────────────────────────────────

const COLORS = {
  searching: {
    primary: '#6366F1',
    secondary: '#8B5CF6',
    tertiary: '#3B82F6',
    gradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    particle: 'bg-indigo-400/30',
    bg: 'from-indigo-50/60 via-transparent to-violet-50/40',
    darkBg: 'dark:from-indigo-950/20 dark:via-transparent dark:to-violet-950/15',
    shimmerFrom: 'from-indigo-500',
    shimmerVia: 'via-violet-500',
    shimmerTo: 'to-indigo-500',
    trackBg: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  analyzing: {
    primary: '#10B981',
    secondary: '#14B8A6',
    tertiary: '#06B6D4',
    gradient: 'linear-gradient(135deg, #10B981, #14B8A6)',
    particle: 'bg-emerald-400/30',
    bg: 'from-emerald-50/60 via-transparent to-teal-50/40',
    darkBg: 'dark:from-emerald-950/20 dark:via-transparent dark:to-teal-950/15',
    shimmerFrom: 'from-emerald-500',
    shimmerVia: 'via-teal-500',
    shimmerTo: 'to-emerald-500',
    trackBg: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
};

const MultiRingSpinner = ({ mode }: { mode: 'searching' | 'analyzing' }) => {
  const c = COLORS[mode];
  const Icon = mode === 'searching' ? MagnifyingGlassIcon : DocumentMagnifyingGlassIcon;

  return (
    <div className="relative w-28 h-28">
      {/* Outer glow */}
      <motion.div
        className="absolute -inset-4 rounded-full"
        style={{ background: `radial-gradient(circle, ${c.primary}18, transparent 70%)` }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Outer ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-[3px]"
        style={{
          borderColor: `${c.primary}25`,
          borderTopColor: c.primary,
          borderRightColor: c.primary,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
      />
      {/* Middle ring — opposite direction */}
      <motion.div
        className="absolute inset-3 rounded-full border-[3px]"
        style={{
          borderColor: `${c.secondary}15`,
          borderBottomColor: c.secondary,
          borderLeftColor: c.secondary,
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
      />
      {/* Inner ring — fast */}
      <motion.div
        className="absolute inset-6 rounded-full border-[2px]"
        style={{
          borderColor: `${c.tertiary}12`,
          borderTopColor: c.tertiary,
          borderRightColor: c.tertiary,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
      />
      {/* Central icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
          style={{ background: c.gradient, boxShadow: `0 4px 20px ${c.primary}40` }}
          animate={{ scale: [1, 1.08, 1], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon className="w-6 h-6 text-white" />
          {/* Shimmer */}
          <motion.div
            className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/25 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
          />
        </motion.div>
      </div>

      {/* Pulse rings */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: `2px solid ${c.primary}` }}
        animate={{ scale: [1, 1.6], opacity: [0.35, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: `2px solid ${c.primary}` }}
        animate={{ scale: [1, 1.6], opacity: [0.35, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.7 }}
      />
    </div>
  );
};

// ─── Cycling message ────────────────────────────────────────

const CyclingMessage = ({ texts }: { texts: string[] }) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
    const timer = setInterval(() => setIdx(prev => (prev + 1) % texts.length), 3200);
    return () => clearInterval(timer);
  }, [texts]);

  return (
    <div className="h-6">
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="block text-sm text-gray-500 dark:text-gray-400 text-center"
        >
          {texts[idx]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

// ─── Step indicator dots ────────────────────────────────────

const SearchSteps = ({ mode }: { mode: 'searching' | 'analyzing' }) => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const c = COLORS[mode];

  const steps: StepDef[] = mode === 'searching'
    ? [
        { icon: SparklesIcon, label: t('profileMatching.overlay.stepKeywords', 'Mots-clés') },
        { icon: UserGroupIcon, label: t('profileMatching.overlay.stepScan', 'Scan CVs') },
        { icon: CpuChipIcon, label: t('profileMatching.overlay.stepScoring', 'Scoring IA') },
        { icon: ChartBarIcon, label: t('profileMatching.overlay.stepRanking', 'Classement') },
      ]
    : [
        { icon: DocumentMagnifyingGlassIcon, label: t('profileMatching.overlay.stepReading', 'Lecture CV') },
        { icon: CpuChipIcon, label: t('profileMatching.overlay.stepEvaluation', 'Évaluation') },
        { icon: ChartBarIcon, label: t('profileMatching.overlay.stepSynthesis', 'Synthèse') },
      ];

  useEffect(() => {
    setActiveStep(0);
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % steps.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const isActive = i === activeStep;
        const isPast = i < activeStep;
        const StepIcon = step.icon;

        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <motion.div
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500"
                style={{
                  background: isPast ? c.gradient : isActive ? c.gradient : undefined,
                  boxShadow: (isPast || isActive) ? `0 2px 8px ${c.primary}30` : undefined,
                }}
                animate={isActive ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
              >
                {!isPast && !isActive && (
                  <div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <StepIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  </div>
                )}
                {(isPast || isActive) && (
                  <StepIcon className="w-4 h-4 text-white" />
                )}
              </motion.div>
              <span className={`mt-1.5 text-[10px] font-medium transition-colors duration-300 ${
                (isPast || isActive) ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
              }`}>
                {step.label}
              </span>
            </div>
            {/* Connector */}
            {i < steps.length - 1 && (
              <div className="w-10 sm:w-14 h-[2px] mx-1.5 sm:mx-2 -mt-5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: c.gradient }}
                  initial={false}
                  animate={{ width: isPast ? '100%' : isActive ? '40%' : '0%' }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Main component ─────────────────────────────────────────

const ProfileMatchingOverlay = ({ mode }: ProfileMatchingOverlayProps): JSX.Element => {
  const { t } = useTranslation();
  const c = COLORS[mode];

  const title = mode === 'searching'
    ? t('profileMatching.searchingProfiles')
    : t('profileMatching.analyzingProfile');

  const description = mode === 'searching'
    ? t('profileMatching.searchingProfilesDescription')
    : t('profileMatching.analyzingProfileDescription');

  const cyclingTexts = mode === 'searching'
    ? (t('profileMatching.searchingLoadingSteps', { returnObjects: true }) as string[])
    : (t('profileMatching.analyzingLoadingSteps', { returnObjects: true }) as string[]);

  const estimatedTime = mode === 'searching'
    ? t('profileMatching.searchingEstimatedTime')
    : t('profileMatching.analyzingProfileDescription');

  const overlay = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden relative"
      >
        {/* Gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${c.bg} ${c.darkBg} transition-all duration-700`} />

        {/* Floating particles */}
        <FloatingParticles className={c.particle} />

        <div className="relative flex flex-col items-center py-12 px-6">
          {/* Spinner */}
          <div className="mb-8">
            <MultiRingSpinner mode={mode} />
          </div>

          {/* Title */}
          <AnimatePresence mode="wait">
            <motion.h3
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2 text-center"
            >
              {title}
            </motion.h3>
          </AnimatePresence>

          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4 max-w-sm">
            {description}
          </p>

          {/* Cycling sub-message */}
          <div className="mb-6">
            <CyclingMessage texts={cyclingTexts} />
          </div>

          {/* Step indicators */}
          <div className="mb-8">
            <SearchSteps mode={mode} />
          </div>

          {/* Shimmer progress bar */}
          <div className={`w-72 h-1.5 rounded-full overflow-hidden ${c.trackBg}`}>
            <motion.div
              className={`h-full w-1/2 rounded-full bg-gradient-to-r ${c.shimmerFrom} ${c.shimmerVia} ${c.shimmerTo}`}
              animate={{ left: ['-50%', '100%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ position: 'relative' }}
            />
          </div>

          {/* Estimated time */}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            {estimatedTime}
          </p>

          {/* Bouncing dots */}
          <div className="flex items-center gap-1.5 mt-3">
            {[0, 1, 2, 3].map(i => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: c.primary }}
                animate={{ y: [0, -6, 0], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  if (typeof document === 'undefined') {
    return overlay;
  }

  return createPortal(overlay, document.body);
};

export default ProfileMatchingOverlay;
