import { XMarkIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export default function ConfirmDialog({
  cancelLabel,
  confirmLabel,
  confirmToneClassName = 'bg-red-500 text-white hover:bg-red-600',
  content,
  disabled = false,
  isOpen,
  onClose,
  onConfirm,
  title,
}: {
  cancelLabel: string;
  confirmLabel: string;
  confirmToneClassName?: string;
  content: ReactNode;
  disabled?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[10000] isolate flex items-center justify-center bg-slate-500/45 p-4 backdrop-blur-[1px] dark:bg-slate-700/55">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" type="button">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-4">
          <div className="text-gray-700 dark:text-gray-300 mb-6">{content}</div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} disabled={disabled} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50" type="button">
              {cancelLabel}
            </button>
            <button onClick={onConfirm} disabled={disabled} className={['px-4 py-2 rounded-lg transition-colors disabled:opacity-50', confirmToneClassName].join(' ')} type="button">
              {confirmLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
