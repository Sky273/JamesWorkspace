import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import type { TranslateFn } from './types';

interface SendEmailStatusStepProps {
  step: 'sending' | 'success' | 'error';
  draftLink: string;
  errorMessage: string;
  onRetry: () => void;
  t: TranslateFn;
}

export default function SendEmailStatusStep({ step, draftLink, errorMessage, onRetry, t }: SendEmailStatusStepProps): JSX.Element {
  if (step === 'sending') {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">{t('mail.modal.creating')}</p>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="text-center py-6">
        <CheckCircleIcon className="w-12 h-12 mx-auto text-green-500 mb-4" />
        <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('mail.modal.successTitle')}</h4>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{t('mail.modal.successDescription')}</p>
        <a
          href={draftLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 px-8 py-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 hover:border-red-400 dark:hover:border-red-500 text-gray-700 dark:text-gray-200 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all transform hover:scale-105 group"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
          </svg>
          <span className="group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors">{t('mail.modal.openDraft')}</span>
          <svg className="w-4 h-4 text-gray-400 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    );
  }

  return (
    <div className="text-center py-6">
      <ExclamationCircleIcon className="w-12 h-12 mx-auto text-red-500 mb-4" />
      <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('mail.modal.errorTitle')}</h4>
      <p className="text-gray-500 dark:text-gray-400 mb-6">{errorMessage}</p>
      <button onClick={onRetry} className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors">
        {t('mail.modal.retry')}
      </button>
    </div>
  );
}
