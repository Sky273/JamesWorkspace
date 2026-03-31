import { EnvelopeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { TranslateFn } from './types';

interface SendEmailModalHeaderProps {
  onClose: () => void;
  t: TranslateFn;
}

export default function SendEmailModalHeader({ onClose, t }: SendEmailModalHeaderProps): JSX.Element {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <EnvelopeIcon className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('mail.modal.title')}</h3>
      </div>
      <button
        onClick={onClose}
        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <XMarkIcon className="w-5 h-5" />
      </button>
    </div>
  );
}
