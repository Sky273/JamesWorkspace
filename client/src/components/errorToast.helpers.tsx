import toast from 'react-hot-toast';

import ErrorToast from './ErrorToast';
import { isSessionRedirectError } from '../utils/apiInterceptor';

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
    504: 'Délai d\'attente du serveur dépassé',
  };
  return messages[status] || null;
};

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

  const message = (errorData.error as string)
    || (errorData.message as string)
    || getStatusMessage(response.status)
    || defaultMessage;

  showErrorWithDetails(message, details);
};

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

  const errorMappings: Array<{ pattern: RegExp; message: string }> = [
    { pattern: /fetch|network|net::ERR|Failed to fetch/i, message: 'Impossible de contacter le serveur. Vérifiez votre connexion internet.' },
    { pattern: /timeout|timed out|ETIMEDOUT/i, message: 'La requête a pris trop de temps. Veuillez réessayer.' },
    { pattern: /401|unauthorized|not authenticated/i, message: 'Votre session a expiré. Veuillez vous reconnecter.' },
    { pattern: /403|forbidden|access denied/i, message: 'Vous n\'avez pas les droits nécessaires pour cette action.' },
    { pattern: /404|not found/i, message: 'La ressource demandée n\'existe pas ou a été supprimée.' },
    { pattern: /500|internal server/i, message: 'Une erreur serveur est survenue. Veuillez réessayer plus tard.' },
    { pattern: /502|503|504|bad gateway|service unavailable/i, message: 'Le service est temporairement indisponible. Veuillez réessayer.' },
    { pattern: /CORS|cross-origin/i, message: 'Erreur de configuration serveur. Contactez l\'administrateur.' },
    { pattern: /JSON|parse|syntax|Failed to parse/i, message: 'Erreur de format de données reçues du serveur. Veuillez réessayer.' },
    { pattern: /Search Analysis|analyze.*response/i, message: 'L\'analyse du CV a échoué. Veuillez réessayer.' },
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

  if (technicalMessage) {
    return {
      message: 'Une erreur est survenue. Veuillez réessayer.',
      details: technicalMessage + (details ? '\n\n' + details : ''),
    };
  }

  return { message: 'Une erreur inattendue est survenue.', details };
};

export const showCaughtError = (
  error: unknown,
  _contextMessage = 'Une erreur est survenue'
): void => {
  if (isSessionRedirectError(error)) {
    return;
  }

  const { message, details } = getUserFriendlyMessage(error);
  showErrorWithDetails(message, details);
};
