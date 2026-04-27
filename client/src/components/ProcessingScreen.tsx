/**
 * ProcessingScreen Component
 * Polished fullscreen overlay shown during single CV upload pipeline (upload → extract → analyze).
 * Features multi-ring spinners, floating particles, cycling messages, and gradient backgrounds.
 */

import { useState, useEffect, useMemo, ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DocumentArrowUpIcon,
  DocumentTextIcon,
  SparklesIcon,
  CpuChipIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

interface StepDef {
  key: string;
  icon: HeroIcon;
  title: string;
  description: string;
  loadingTexts: string[];
  colors: { primary: string; gradient: string; bg: string; darkBg: string; ring: string; particle: string };
}

// ─── Floating particles ────────────────────────────────────

const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
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
        animate={{ y: [0, -18, 0], x: [0, (p.id % 2 === 0 ? 7 : -7), 0], opacity: [0, 0.5, 0], scale: [0.5, 1.2, 0.5] }}
        transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
      />
    ))}
  </div>
);

// ─── Multi-ring spinner ────────────────────────────────────

const StepSpinner = ({ colors, Icon }: { colors: StepDef['colors']; Icon: HeroIcon }) => (
  <div className="relative w-20 h-20">
    {/* Outer glow */}
    <motion.div
      className="absolute -inset-3 rounded-full"
      style={{ background: `radial-gradient(circle, ${colors.primary}15, transparent 70%)` }}
      animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    />
    {/* Outer ring */}
    <motion.div
      className="absolute inset-0 rounded-full border-[3px]"
      style={{ borderColor: `${colors.primary}30`, borderTopColor: colors.primary, borderRightColor: colors.primary }}
      animate={{ rotate: 360 }}
      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
    />
    {/* Inner ring — opposite */}
    <motion.div
      className="absolute inset-2.5 rounded-full border-[2px]"
      style={{ borderColor: `${colors.primary}15`, borderBottomColor: colors.ring, borderLeftColor: colors.ring }}
      animate={{ rotate: -360 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
    />
    {/* Central icon */}
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
        style={{ background: colors.gradient, boxShadow: `0 4px 14px ${colors.primary}40` }}
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Icon className="w-5.5 h-5.5 text-white" />
        {/* Shimmer */}
        <motion.div
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.2 }}
        />
      </motion.div>
    </div>
  </div>
);

// ─── Cycling message ───────────────────────────────────────

const CyclingMessage = ({ texts }: { texts: string[] }) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
    const timer = setInterval(() => setIdx(prev => (prev + 1) % texts.length), 3200);
    return () => clearInterval(timer);
  }, [texts]);

  return (
    <div className="h-5 mt-1.5">
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="block text-xs text-gray-500 dark:text-gray-400"
        >
          {texts[idx]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

// ─── Single step row ───────────────────────────────────────

const StepRow = ({ step, index, currentIdx, totalSteps }: { step: StepDef; index: number; currentIdx: number; totalSteps: number }) => {
  const isActive = index === currentIdx;
  const isPast = index < currentIdx;
  const isFuture = index > currentIdx;
  const Icon = step.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="relative"
    >
      {/* Connector line */}
      {index < totalSteps - 1 && (
        <div className="absolute left-10 top-[76px] w-[3px] h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden z-0">
          <motion.div
            className="w-full rounded-full"
            style={{ background: step.colors.gradient }}
            initial={false}
            animate={{ height: isPast ? '100%' : isActive ? '40%' : '0%' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      )}

      <div className={`relative flex items-center gap-5 p-4 rounded-xl transition-all duration-300 ${
        isActive
          ? 'bg-white/80 dark:bg-gray-800/80 shadow-lg border border-gray-200/60 dark:border-gray-700/60 backdrop-blur-sm'
          : isPast
            ? 'bg-white/40 dark:bg-gray-800/30'
            : ''
      }`}>
        {/* Icon circle */}
        <div className="relative flex-shrink-0">
          {isActive ? (
            <StepSpinner colors={step.colors} Icon={Icon} />
          ) : (
            <motion.div
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${
                isPast ? 'shadow-md' : 'shadow-sm'
              }`}
              style={{
                background: isPast ? step.colors.gradient : undefined,
                border: isFuture ? '2px solid rgb(209 213 219)' : undefined,
              }}
              animate={isPast ? { scale: [1, 1.03, 1] } : {}}
              transition={isPast ? { duration: 0.5, delay: 0.2 } : {}}
            >
              {isPast ? (
                <motion.div
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                >
                  <CheckIcon className="w-8 h-8 text-white" strokeWidth={2.5} />
                </motion.div>
              ) : (
                <Icon className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              )}
            </motion.div>
          )}

          {/* Pulse rings for active */}
          {isActive && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: `2px solid ${step.colors.primary}` }}
                animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: `2px solid ${step.colors.primary}` }}
                animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
              />
            </>
          )}
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <h3
            className={`text-base font-semibold transition-colors duration-300 ${
              isActive ? 'text-gray-900 dark:text-gray-100' : isPast ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
            }`}
            style={isActive ? { color: step.colors.primary } : isPast ? { color: step.colors.primary } : undefined}
          >
            {step.title}
          </h3>
          <p className={`text-sm mt-0.5 ${isActive ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
            {step.description}
          </p>
          {isActive && <CyclingMessage texts={step.loadingTexts} />}
          {isPast && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="inline-block text-xs font-medium mt-1"
              style={{ color: step.colors.primary }}
            >
              ✓ Terminé
            </motion.span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main component ────────────────────────────────────────

interface ProcessingScreenProps {
  currentStep: string;
  error?: string | null;
  fullscreen?: boolean;
  preAnalysisEnabled?: boolean;
}

const ProcessingScreen = ({
  currentStep,
  error,
  fullscreen = false,
  preAnalysisEnabled = true,
}: ProcessingScreenProps): JSX.Element => {
  const { t } = useTranslation();

  const steps: StepDef[] = useMemo(() => {
    const nextSteps: StepDef[] = [
      {
        key: 'upload',
        icon: DocumentArrowUpIcon,
        title: t('processing.steps.upload.title'),
        description: t('processing.steps.upload.description'),
        loadingTexts: t('processing.steps.upload.steps', { returnObjects: true }) as string[],
        colors: {
          primary: '#6B4EFF',
          gradient: '#6B4EFF',
          bg: 'from-[#f8f8f7] via-[#f8f8f7] to-[#f8f8f7]',
          darkBg: 'dark:from-[#111827] dark:via-[#111827] dark:to-[#111827]',
          ring: '#6B4EFF',
          particle: 'bg-[#6b4eff]/25',
        },
      },
      {
        key: 'extract',
        icon: DocumentTextIcon,
        title: t('processing.steps.extract.title'),
        description: t('processing.steps.extract.description'),
        loadingTexts: t('processing.steps.extract.steps', { returnObjects: true }) as string[],
        colors: {
          primary: '#8B5CF6',
          gradient: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
          bg: 'from-violet-50/60 via-transparent to-purple-50/40',
          darkBg: 'dark:from-violet-950/20 dark:via-transparent dark:to-purple-950/15',
          ring: '#A855F7',
          particle: 'bg-violet-400/30',
        },
      },
    ];

    if (preAnalysisEnabled) {
      nextSteps.push({
        key: 'preanalyze',
        icon: SparklesIcon,
        title: t('processing.steps.preanalyze.title'),
        description: t('processing.steps.preanalyze.description'),
        loadingTexts: t('processing.steps.preanalyze.steps', { returnObjects: true }) as string[],
        colors: {
          primary: '#14B8A6',
          gradient: 'linear-gradient(135deg, #14B8A6, #0EA5E9)',
          bg: 'from-teal-50/60 via-transparent to-cyan-50/40',
          darkBg: 'dark:from-teal-950/20 dark:via-transparent dark:to-cyan-950/15',
          ring: '#0EA5E9',
          particle: 'bg-teal-400/30',
        },
      });
    }

    nextSteps.push({
      key: 'analyze',
      icon: CpuChipIcon,
      title: t('processing.steps.analyze.title'),
      description: t('processing.steps.analyze.description'),
      loadingTexts: t('processing.steps.analyze.steps', { returnObjects: true }) as string[],
      colors: {
        primary: '#EC4899',
        gradient: 'linear-gradient(135deg, #EC4899, #F43F5E)',
        bg: 'from-pink-50/60 via-transparent to-rose-50/40',
        darkBg: 'dark:from-pink-950/20 dark:via-transparent dark:to-rose-950/15',
        ring: '#F43F5E',
        particle: 'bg-pink-400/30',
      },
    });

    return nextSteps;
  }, [preAnalysisEnabled, t]);

  const normalizedCurrentStep = !preAnalysisEnabled && currentStep === 'preanalyze'
    ? 'analyze'
    : currentStep;
  const currentIdx = steps.findIndex(s => s.key === normalizedCurrentStep);
  const activeStep = steps[Math.max(currentIdx, 0)];

  const content = (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Gradient background — follows current step color */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${activeStep.colors.bg} ${activeStep.colors.darkBg} transition-all duration-700`} />

      {/* Floating particles */}
      <FloatingParticles className={activeStep.colors.particle} />

      <div className="relative px-6 py-10 sm:px-10">
        {/* Title */}
        <div className="text-center mb-8">
          <motion.h2
            key={currentStep}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            {t('processing.title', 'Traitement du CV en cours…')}
          </motion.h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('processing.subtitle', 'Veuillez patienter pendant l\'analyse')}
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, i) => (
            <StepRow key={step.key} step={step} index={i} currentIdx={currentIdx} totalSteps={steps.length} />
          ))}
        </div>

        {/* Shimmer progress bar */}
        <div className="mt-8 w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full w-1/2 rounded-full"
            style={{ background: activeStep.colors.gradient }}
            animate={{ left: ['-50%', '100%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            initial={false}
          />
        </div>

        {/* Bottom info */}
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {t('processing.estimatedTime', 'Cela peut prendre 15–30 secondes')}
          </p>
          {/* Bouncing dots */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3].map(i => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: activeStep.colors.primary }}
                animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
              />
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          </motion.div>
        )}
      </div>
    </div>
  );

  if (fullscreen) {
    const overlay = (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm"
        data-testid="processing-screen-fullscreen-overlay"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden"
        >
          {content}
        </motion.div>
      </motion.div>
    );

    return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
  }

  return <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">{content}</div>;
};

export default ProcessingScreen;
