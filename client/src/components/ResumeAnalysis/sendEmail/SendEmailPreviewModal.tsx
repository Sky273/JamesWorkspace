import { XMarkIcon } from '@heroicons/react/24/outline';
import type { TranslateFn } from './types';

interface SendEmailPreviewModalProps {
  isOpen: boolean;
  sanitizedPreviewHtml: string;
  onClose: () => void;
  t: TranslateFn;
}

export default function SendEmailPreviewModal({ isOpen, sanitizedPreviewHtml, onClose, t }: SendEmailPreviewModalProps): JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('mail.modal.templatePreview')}</h3>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
            {sanitizedPreviewHtml ? (
              <iframe
                srcDoc={sanitizedPreviewHtml}
                title="Email Preview"
                className="w-full h-[500px] border-0"
                sandbox="allow-same-origin allow-popups"
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">{t('mail.modal.loadingPreview')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
