/**
 * Modal Component
 * TypeScript version with full type safety
 */

import { ReactNode, MouseEvent } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// TYPES
// ============================================

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

// ============================================
// COMPONENT
// ============================================

const Modal = ({ isOpen, onClose, title, children }: ModalProps): JSX.Element | null => {
  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (): void => {
    onClose();
  };

  const handleContentClick = (e: MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full"
            onClick={handleContentClick}
          >
            <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-700 rounded-t">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              <button
                type="button"
                className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white rounded-lg text-sm p-1.5 ml-auto inline-flex items-center"
                onClick={onClose}
                aria-label="Close modal"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            {children} 
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
