/**
 * ImprovementAnimation Component
 * TypeScript version
 */

import { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SparklesIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

interface Particle {
  id: number;
  delay: number;
  size: number;
}

interface Circle {
  id: number;
  size: number;
  delay: number;
}

interface ProcessingStep {
  id: string;
  label: string;
  description: string;
  icon: HeroIcon;
  animation: {
    particles?: Particle[];
    circles?: Circle[];
  };
}

interface ImprovementAnimationProps {
  currentStep?: string;
  isVisible?: boolean;
}

interface StepAnimationProps {
  step: ProcessingStep;
}

const StepAnimation = ({ step }: StepAnimationProps): JSX.Element | null => {
  switch (step.id) {
    case 'improving':
      return (
        <div className="relative w-16 h-16">
          {step.animation.particles?.map(particle => (
            <motion.div
              key={particle.id}
              className="absolute w-1 h-1 bg-indigo-500"
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [1, 2, 0],
                opacity: [0, 1, 0],
                x: [0, (Math.random() - 0.5) * 40],
                y: [0, (Math.random() - 0.5) * 40],
              }}
              transition={{
                duration: 1.5,
                delay: particle.delay,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              style={{
                left: '50%',
                top: '50%',
                width: particle.size,
                height: particle.size,
                transform: 'translate(-50%, -50%)'
              }}
            />
          ))}
        </div>
      );
    
    case 'analyzing':
      return (
        <div className="relative w-16 h-16">
          {step.animation.circles?.map(circle => (
            <motion.div
              key={circle.id}
              className="absolute border-2 border-indigo-500 rounded-full"
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 1],
                opacity: [0.8, 0],
              }}
              transition={{
                duration: 1.5,
                delay: circle.delay,
                repeat: Infinity,
                ease: "easeOut"
              }}
              style={{
                left: '50%',
                top: '50%',
                width: circle.size,
                height: circle.size,
                transform: 'translate(-50%, -50%)'
              }}
            />
          ))}
        </div>
      );
    
    default:
      return null;
  }
};

const ImprovementAnimation = ({ currentStep = '', isVisible = false }: ImprovementAnimationProps): JSX.Element | null => {
  const { t } = useTranslation();

  const processingSteps: ProcessingStep[] = [
    {
      id: 'improving',
      label: t('improvementAnimation.steps.improving.label'),
      description: t('improvementAnimation.steps.improving.description'),
      icon: SparklesIcon,
      animation: {
        particles: Array(6).fill(null).map((_, i) => ({
          id: i,
          delay: i * 0.2,
          size: Math.random() * 4 + 2
        }))
      }
    },
    {
      id: 'analyzing',
      label: t('improvementAnimation.steps.analyzing.label'),
      description: t('improvementAnimation.steps.analyzing.description'),
      icon: ChartBarIcon,
      animation: {
        circles: Array(3).fill(null).map((_, i) => ({
          id: i,
          size: (i + 1) * 20,
          delay: i * 0.3
        }))
      }
    }
  ];

  if (!isVisible) return null;

  return (
    <AnimatePresence>
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
          className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl max-w-md w-full mx-4"
        >
          <div className="space-y-8">
            {processingSteps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isPast = processingSteps.findIndex(s => s.id === currentStep) > index;
              const IconComponent = step.icon;

              return (
                <div key={step.id} className="relative">
                  {index !== processingSteps.length - 1 && (
                    <div
                      className={`absolute left-8 top-16 w-0.5 h-12 ${
                        isPast ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  )}
                  <div className="relative flex items-center">
                    <div className="flex-shrink-0">
                      {isActive ? (
                        <StepAnimation step={step} />
                      ) : (
                        <div
                          className={`w-16 h-16 rounded-full flex items-center justify-center ${
                            isPast
                              ? 'bg-indigo-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          <IconComponent className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <h3
                        className={`font-medium ${
                          isActive
                            ? 'text-indigo-500 dark:text-indigo-400'
                            : isPast
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {step.label}
                      </h3>
                      {isActive && (
                        <motion.p
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-gray-500 dark:text-gray-400 mt-1"
                        >
                          {step.description}
                        </motion.p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImprovementAnimation;
