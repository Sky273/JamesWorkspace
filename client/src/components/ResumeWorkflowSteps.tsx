import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

type ResumeWorkflowStep = 'analysis' | 'improve' | 'export';
type StepState = 'active' | 'complete' | 'available' | 'disabled';

interface ResumeWorkflowStepsProps {
  resumeId: string;
  currentStep: ResumeWorkflowStep;
  hasImprovedText: boolean;
  onImprove?: () => void;
  t: TFunction;
}

const orderedSteps: ResumeWorkflowStep[] = ['analysis', 'improve', 'export'];

const stepIcons = {
  analysis: MagnifyingGlassIcon,
  improve: SparklesIcon,
  export: ArrowDownTrayIcon,
};

const getStepTarget = (resumeId: string, step: ResumeWorkflowStep): string => {
  const routeStep = step === 'analysis' ? 'analysis' : step;
  return `/resumes/${resumeId}/${routeStep}`;
};

const getStepState = (
  step: ResumeWorkflowStep,
  currentStep: ResumeWorkflowStep,
  hasImprovedText: boolean,
  onImprove?: () => void
): StepState => {
  if (step === currentStep) return 'active';
  if (step === 'analysis' && currentStep !== 'analysis') return 'complete';
  if (step === 'improve' && hasImprovedText && currentStep === 'export') return 'complete';
  if (step === 'improve' && currentStep === 'analysis' && onImprove) return 'available';
  if (step === 'export' && (hasImprovedText || currentStep === 'analysis')) return 'available';
  if (step === 'improve' && currentStep === 'export') return 'available';
  return 'disabled';
};

const getStepClasses = (state: StepState): string => {
  const base = 'relative z-10 mx-auto inline-flex min-h-11 w-full max-w-[11rem] min-w-0 items-center justify-center gap-2 rounded-full border px-3 text-left text-sm font-semibold shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-200';

  switch (state) {
    case 'active':
      return `${base} border-[#6b4eff] bg-[#6b4eff] text-white shadow-[0_14px_30px_rgba(107,78,255,0.24)] dark:border-[#8f7cff] dark:bg-[#7b61ff]`;
    case 'complete':
      return `${base} border-[#6b4eff]/30 bg-[#f1edff] text-[#5f45f4] hover:border-[#6b4eff]/50 hover:bg-[#ebe5ff] dark:border-[#8f7cff]/35 dark:bg-[#211b43] dark:text-[#d8d2ff] dark:hover:bg-[#2a2254]`;
    case 'available':
      return `${base} border-slate-200 bg-white text-slate-600 hover:-translate-y-px hover:border-[#6b4eff]/35 hover:text-[#5f45f4] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:border-[#8f7cff]/40 dark:hover:text-[#c8bdff]`;
    case 'disabled':
      return `${base} cursor-default border-slate-200 bg-white/80 text-slate-400 shadow-none dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-500`;
  }
};

const getIconClasses = (state: StepState): string => {
  const base = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors';

  switch (state) {
    case 'active':
      return `${base} border-white/20 bg-white/14 text-white`;
    case 'complete':
      return `${base} border-[#6b4eff]/20 bg-[#6b4eff] text-white dark:border-[#8f7cff]/20 dark:bg-[#8f7cff]`;
    case 'available':
      return `${base} border-slate-200 bg-slate-50 text-slate-500 group-hover:border-[#6b4eff]/30 group-hover:bg-[#6b4eff]/8 group-hover:text-[#6b4eff] dark:border-white/10 dark:bg-white/8 dark:text-slate-400 dark:group-hover:border-[#8f7cff]/40 dark:group-hover:bg-[#8f7cff]/14 dark:group-hover:text-[#c8bdff]`;
    case 'disabled':
      return `${base} border-slate-200 bg-slate-100 text-slate-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-slate-500`;
  }
};

const getProgressWidth = (currentStep: ResumeWorkflowStep): string => {
  if (currentStep === 'analysis') return '0%';
  if (currentStep === 'improve') return '50%';
  return '100%';
};

export default function ResumeWorkflowSteps({
  resumeId,
  currentStep,
  hasImprovedText,
  onImprove,
  t,
}: ResumeWorkflowStepsProps): JSX.Element {
  const states = orderedSteps.reduce<Record<ResumeWorkflowStep, StepState>>((acc, step) => {
    acc[step] = getStepState(step, currentStep, hasImprovedText, onImprove);
    return acc;
  }, {} as Record<ResumeWorkflowStep, StepState>);

  const renderStep = (step: ResumeWorkflowStep): JSX.Element => {
    const state = states[step];
    const Icon = state === 'complete' ? CheckCircleIcon : stepIcons[step];
    const content = (
      <>
        <motion.span
          className={getIconClasses(state)}
          animate={state === 'active' ? { scale: [1, 1.05, 1] } : undefined}
          transition={state === 'active' ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
        >
          <Icon className="h-3.5 w-3.5" />
        </motion.span>
        <span className="min-w-0 truncate">
          {t(`resume.steps.${step}`)}
        </span>
      </>
    );

    if (step === 'improve' && currentStep === 'analysis' && !hasImprovedText && onImprove) {
      return (
        <button type="button" onClick={onImprove} className={`group ${getStepClasses(state)}`}>
          {content}
        </button>
      );
    }

    if (state === 'disabled') {
      return <div className={getStepClasses(state)}>{content}</div>;
    }

    if (step === currentStep) {
      return <div className={getStepClasses(state)}>{content}</div>;
    }

    return (
      <Link to={getStepTarget(resumeId, step)} className={`group ${getStepClasses(state)}`}>
        {content}
      </Link>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mb-6"
    >
      <div className="cv-panel rounded-[1.5rem] border border-slate-200/75 px-3 py-4 shadow-sm dark:border-white/10 sm:px-5">
        <div className="relative isolate grid grid-cols-3 items-center gap-2">
          <div className="pointer-events-none absolute left-[16.666%] right-[16.666%] top-1/2 z-0 h-[2px] -translate-y-1/2 rounded-full bg-slate-200 dark:bg-white/10">
            <motion.div
              className="h-full rounded-full bg-[#6b4eff] dark:bg-[#8f7cff]"
              initial={false}
              animate={{ width: getProgressWidth(currentStep) }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </div>
          {renderStep('analysis')}
          {renderStep('improve')}
          {renderStep('export')}
        </div>
      </div>
    </motion.div>
  );
}
