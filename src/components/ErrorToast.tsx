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
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Erreur
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 break-words">
              {message}
            </p>
            
            {details && (
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
                
                {showDetails && (
                  <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs font-mono text-gray-600 dark:text-gray-400 max-h-32 overflow-auto whitespace-pre-wrap break-all">
                    {details}
                  </div>
                )}
              </>
            )}
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

/**
 * Show error toast with expandable details
 */
export const showErrorWithDetails = (
  message: string,
  details?: string,
  duration = 8000
): string => {
  const toastId = toast.custom(
    (t) => (
      <div className={t.visible ? 'animate-enter' : 'animate-leave'}>
        <ErrorToast message={message} details={details} toastId={t.id} />
      </div>
    ),
    { duration }
  );
  return toastId;
};

/**
 * Parse and show API error with details
 */
export const showApiError = async (
  response: Response,
  defaultMessage = 'Une erreur est survenue'
): Promise<void> => {
  let errorData: Record<string, unknown> = {};
  let details = '';
  
  try {
    errorData = await response.json();
    details = JSON.stringify(errorData, null, 2);
  } catch {
    details = `Status: ${response.status} ${response.statusText}`;
  }

  const message = (errorData.error as string) || 
                  (errorData.message as string) || 
                  getStatusMessage(response.status) ||
                  defaultMessage;

  showErrorWithDetails(message, details);
};

/**
 * Get user-friendly message from HTTP status
 */
export const getStatusMessage = (status: number): string | null => {
  const messages: Record<number, string> = {
    400: 'Requête invalide',
    401: 'Session expirée - veuillez vous reconnecter',
    403: 'Accès refusé',
    404: 'Ressource non trouvée',
    408: 'Délai d\'attente dépassé',
    413: 'Fichier trop volumineux',
    422: 'Données invalides',
    429: 'Trop de requêtes - veuillez patienter',
    500: 'Erreur serveur',
    502: 'Service indisponible',
    503: 'Service temporairement indisponible',
    504: 'Délai d\'attente du serveur dépassé'
  };
  return messages[status] || null;
};

/**
 * Convert technical error messages to user-friendly messages
 */
export const getUserFriendlyMessage = (error: unknown): { message: string; details: string } => {
  let technicalMessage = '';
  let details = '';

  if (error instanceof Error) {
    technicalMessage = error.message;
    details = error.stack || '';
  } else if (typeof error === 'string') {
    technicalMessage = error;
  } else if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    technicalMessage = (err.message as string) || (err.error as string) || '';
    details = JSON.stringify(error, null, 2);
  }

  // Map technical messages to user-friendly ones
  const errorMappings: Array<{ pattern: RegExp; message: string }> = [
    { pattern: /fetch|network|net::ERR|Failed to fetch/i, message: 'Impossible de contacter le serveur. Vérifiez votre connexion internet.' },
    { pattern: /timeout|timed out|ETIMEDOUT/i, message: 'La requête a pris trop de temps. Veuillez réessayer.' },
    { pattern: /401|unauthorized|not authenticated/i, message: 'Votre session a expiré. Veuillez vous reconnecter.' },
    { pattern: /403|forbidden|access denied/i, message: 'Vous n\'avez pas les droits nécessaires pour cette action.' },
    { pattern: /404|not found/i, message: 'La ressource demandée n\'existe pas ou a été supprimée.' },
    { pattern: /500|internal server/i, message: 'Une erreur serveur est survenue. Veuillez réessayer plus tard.' },
    { pattern: /502|503|504|bad gateway|service unavailable/i, message: 'Le service est temporairement indisponible. Veuillez réessayer.' },
    { pattern: /CORS|cross-origin/i, message: 'Erreur de configuration serveur. Contactez l\'administrateur.' },
    { pattern: /JSON|parse|syntax/i, message: 'Erreur de format de données. Veuillez réessayer.' },
    { pattern: /abort|cancelled|canceled/i, message: 'L\'opération a été annulée.' },
    { pattern: /quota|storage|space/i, message: 'Espace de stockage insuffisant.' },
    { pattern: /permission|denied/i, message: 'Permission refusée pour cette opération.' },
    { pattern: /invalid|validation/i, message: 'Les données saisies sont invalides. Veuillez vérifier.' },
    { pattern: /duplicate|already exists/i, message: 'Cet élément existe déjà.' },
    { pattern: /rate limit|too many requests/i, message: 'Trop de requêtes. Veuillez patienter quelques instants.' },
    { pattern: /file.*large|size.*exceed/i, message: 'Le fichier est trop volumineux.' },
    { pattern: /unsupported.*type|invalid.*format/i, message: 'Format de fichier non supporté.' },
  ];

  for (const mapping of errorMappings) {
    if (mapping.pattern.test(technicalMessage)) {
      return { message: mapping.message, details: technicalMessage + (details ? '\n\n' + details : '') };
    }
  }

  // If no mapping found, return a generic message but keep technical details
  if (technicalMessage) {
    return { 
      message: 'Une erreur est survenue. Veuillez réessayer.', 
      details: technicalMessage + (details ? '\n\n' + details : '')
    };
  }

  return { message: 'Une erreur inattendue est survenue.', details };
};

/**
 * Show error from catch block with user-friendly message and technical details
 */
export const showCaughtError = (
  error: unknown,
  _contextMessage = 'Une erreur est survenue'
): void => {
  const { message, details } = getUserFriendlyMessage(error);
  showErrorWithDetails(message, details);
};

export default ErrorToast;
