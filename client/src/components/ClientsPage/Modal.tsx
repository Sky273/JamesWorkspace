/**
 * Modal Component for ClientsPage
 */

import { ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal = ({ isOpen, onClose, title, children, size = 'md' }: ModalProps): JSX.Element | null => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        <div className={`relative w-full ${sizeClasses[size]} transform rounded-[13px] border border-[#dedbe8] bg-white shadow-xl transition-all dark:border-white/10 dark:bg-[#182235]`}>
          <div className="flex items-center justify-between border-b border-[#dedbe8] p-4 dark:border-white/10">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[9px] p-1 text-gray-400 transition-colors hover:bg-[#f8f8f7] hover:text-gray-600 dark:hover:bg-[#263052] dark:hover:text-gray-300"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
