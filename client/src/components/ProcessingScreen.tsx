/**
 * ProcessingScreen Component
 * TypeScript version
 */

import { useState, useEffect, ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DocumentArrowUpIcon,
  DocumentTextIcon,
  CpuChipIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

interface StepInfo {
  icon: HeroIcon;
  title: string;
  description: string;
  loadingText: string[];
  color: string;
}

interface Steps {
  [key: string]: StepInfo;
}

interface ProcessingScreenProps {
  currentStep: string;
  error?: string | null;
}

interface LoadingTextProps {
  texts: string[];
  color: string;
}

interface ProcessingStepProps {
  step: string;
  stepInfo: StepInfo;
  currentStep: string;
  error?: string | null;
  allSteps: Steps;
}

const LoadingText = ({ texts, color }: LoadingTextProps): JSX.Element => {
  const [index, setIndex] = useState<number>(0);

  useEffect(() => {
    // Stop at the last item instead of looping
    if (index >= texts.length - 1) return;
    
    const timer = setInterval(() => {
      setIndex(i => {
        if (i >= texts.length - 1) return i; // Stay on last item
        return i + 1;
      });
    }, 2500);
    return () => clearInterval(timer);
  }, [texts.length, index]);

  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5 }}
      className="min-h-[1.5rem]"
    >
      <span className="text-sm text-gray-600 dark:text-gray-300" style={{ color }}>
        {texts[index]}...
      </span>
    </motion.div>
  );
};

const ProcessingStep = ({ step, stepInfo, currentStep, error, allSteps }: ProcessingStepProps): JSX.Element => {
  const isActive = currentStep === step;
  const isPast = Object.keys(allSteps).indexOf(currentStep) > Object.keys(allSteps).indexOf(step);
  const IconComponent = stepInfo.icon;

  const bounceVariants = {
    active: {
      y: [0, -8, 0],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut" as const
      }
    },
    inactive: {
      y: 0
    }
  };

  const spinnerVariants = {
    animate: {
      rotate: 360,
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "linear" as const
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className={`relative flex items-center p-6 rounded-xl ${
        isActive ? 'bg-gradient-to-r from-gray-50/5 to-gray-50/10 dark:from-gray-800/50 dark:to-gray-800/30' : ''
      }`}
    >
      {Object.keys(allSteps).indexOf(step) < Object.keys(allSteps).length - 1 && (
        <div className="absolute left-11 top-20 w-0.5 h-16">
          <motion.div
            className="h-full rounded-full"
            style={{ 
              background: `linear-gradient(to bottom, ${stepInfo.color}, ${
                allSteps[Object.keys(allSteps)[Object.keys(allSteps).indexOf(step) + 1]].color
              })`
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: isPast ? 1 : 0 }}
            transition={{ duration: 1 }}
          />
        </div>
      )}

      <motion.div 
        className="relative"
        variants={bounceVariants}
        animate={isActive ? "active" : "inactive"}
      >
        <motion.div
          className={`w-16 h-16 rounded-full flex items-center justify-center bg-white dark:bg-gray-800
            ${isActive ? 'shadow-lg dark:shadow-gray-900/50' : 'shadow-sm dark:shadow-gray-900/30'}`}
          style={{
            border: `2px solid ${isActive ? stepInfo.color : isPast ? stepInfo.color : 'rgb(209 213 219)'}`
          }}
          animate={{
            scale: isActive ? [1, 1.05, 1] : 1,
            transition: {
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }
          }}
        >
          <AnimatePresence mode="wait">
            {isActive ? (
              <motion.div className="relative" key="active">
                <motion.div
                  variants={spinnerVariants}
                  animate="animate"
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <ArrowPathIcon 
                    className="w-8 h-8 opacity-20" 
                    style={{ color: stepInfo.color }}
                  />
                </motion.div>
                <IconComponent 
                  className="w-8 h-8 relative z-10" 
                  style={{ color: stepInfo.color }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="icon"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <IconComponent 
                  className="w-8 h-8" 
                  style={{ color: isPast ? stepInfo.color : 'rgb(156 163 175)' }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {isActive && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: `2px solid ${stepInfo.color}` }}
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ 
                scale: [1, 1.4],
                opacity: [0.5, 0]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "linear"
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: `2px solid ${stepInfo.color}` }}
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ 
                scale: [1, 1.4],
                opacity: [0.5, 0]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "linear",
                delay: 0.5
              }}
            />
          </>
        )}
      </motion.div>

      <div className="ml-6 flex-1">
        <h3 
          className="text-lg font-semibold text-gray-900 dark:text-white"
          style={{ color: isActive || isPast ? stepInfo.color : undefined }}
        >
          {stepInfo.title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {stepInfo.description}
        </p>
        {isActive && (
          <div className="mt-2">
            <LoadingText texts={stepInfo.loadingText} color={stepInfo.color} />
          </div>
        )}
      </div>
    </motion.div>
  );
};

interface ProcessingScreenFullscreenProps {
  currentStep: string;
  error?: string | null;
  fullscreen?: boolean;
}

const ProcessingScreen = ({ currentStep, error, fullscreen = false }: ProcessingScreenFullscreenProps): JSX.Element => {
  const { t } = useTranslation();

  const steps: Steps = {
    upload: {
      icon: DocumentArrowUpIcon,
      title: t('processing.steps.upload.title'),
      description: t('processing.steps.upload.description'),
      loadingText: t('processing.steps.upload.steps', { returnObjects: true }) as string[],
      color: '#3B82F6'
    },
    extract: {
      icon: DocumentTextIcon,
      title: t('processing.steps.extract.title'),
      description: t('processing.steps.extract.description'),
      loadingText: t('processing.steps.extract.steps', { returnObjects: true }) as string[],
      color: '#8B5CF6'
    },
    analyze: {
      icon: CpuChipIcon,
      title: t('processing.steps.analyze.title'),
      description: t('processing.steps.analyze.description'),
      loadingText: t('processing.steps.analyze.steps', { returnObjects: true }) as string[],
      color: '#EC4899'
    }
  };

  const content = (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="space-y-4">
        {Object.entries(steps).map(([step, stepInfo]) => (
          <ProcessingStep
            key={step}
            step={step}
            stepInfo={stepInfo}
            currentStep={currentStep}
            error={error}
            allSteps={steps}
          />
        ))}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[60]"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl max-w-2xl w-full mx-4"
        >
          {content}
        </motion.div>
      </motion.div>
    );
  }

  return content;
};

export default ProcessingScreen;
