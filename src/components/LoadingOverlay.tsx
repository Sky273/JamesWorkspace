/**
 * LoadingOverlay Component
 * Shows a loading overlay with optional progress and message
 */

import { motion, AnimatePresence } from 'framer-motion';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  progress?: number;
  subMessage?: string;
}

const LoadingOverlay = ({ 
  isLoading, 
  message = 'Chargement en cours...', 
  progress,
  subMessage 
}: LoadingOverlayProps): JSX.Element | null => {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4"
          >
            <div className="flex flex-col items-center">
              {/* Spinner */}
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-900 rounded-full" />
                <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin" />
                {progress !== undefined && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {Math.round(progress)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Message */}
              <p className="text-lg font-medium text-gray-900 dark:text-white text-center">
                {message}
              </p>

              {/* Sub message */}
              {subMessage && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {subMessage}
                </p>
              )}

              {/* Progress bar */}
              {progress !== undefined && (
                <div className="w-full mt-4 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingOverlay;
