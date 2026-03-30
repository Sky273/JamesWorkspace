/**
 * ErrorToast Component
 * Custom toast component with expandable error details
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { ExclamationTriangleIcon, ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ErrorToastProps {
  message: string;
  details?: string;
  toastId: string;
}

const ErrorToast = ({ message, details, toastId }: ErrorToastProps): JSX.Element => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto ring-1 ring-red-500/20 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Erreur</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 break-words">{message}</p>

            {details ? (
              <>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showDetails ? (
                    <>
                      <ChevronUpIcon className="h-3 w-3" />
                      Masquer les détails
                    </>
                  ) : (
                    <>
                      <ChevronDownIcon className="h-3 w-3" />
                      Voir les détails
                    </>
                  )}
                </button>

                {showDetails ? (
                  <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs font-mono text-gray-600 dark:text-gray-400 max-h-32 overflow-auto whitespace-pre-wrap break-all">
                    {details}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={() => toast.dismiss(toastId)}
              className="rounded-md inline-flex text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
            >
              <span className="sr-only">Fermer</span>
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorToast;
