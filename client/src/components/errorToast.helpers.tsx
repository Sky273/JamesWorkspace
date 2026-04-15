import toast from 'react-hot-toast';

import ErrorToast from './ErrorToast';
import { isSessionRedirectError } from '../utils/apiInterceptor';
import { isInsufficientCreditsRedirectError } from '../utils/insufficientCreditsRedirect';

const AI_PROVIDER_CONFIGURATION_PATTERNS = [
  /fournisseur ia est actuellement mal configur/i,
  /fournisseur ia est mal configur/i,
  /jeton d.?acc[eè]s a expir/i,
  /token expired or incorrect/i,
  /invalid api key/i,
  /incorrect api key/i,
  /api key not configured/i,
];

export const isAiProviderConfigurationError = (error: unknown): boolean => {
  const technicalMessage = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : typeof error === 'object' && error !== null
        ? String((error as Record<string, unknown>).message || (error as Record<string, unknown>).error || '')
        : '';

  return AI_PROVIDER_CONFIGURATION_PATTERNS.some((pattern) => pattern.test(technicalMessage));
};

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
    400: 'Requete invalide',
    401: 'Session expiree - veuillez vous reconnecter',
    403: 'Acces refuse',
    404: 'Ressource non trouvee',
    408: "Delai d'attente depasse",
    413: 'Fichier trop volumineux',
    422: 'Donnees invalides',
    429: 'Trop de requetes - veuillez patienter',
    500: 'Erreur serveur',
    502: 'Service indisponible',
    503: 'Service temporairement indisponible',
    504: "Delai d'attente du serveur depasse",
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

  if (isAiProviderConfigurationError(error)) {
    return {
      message: "Le service d'amelioration IA est temporairement indisponible. Contactez un administrateur.",
      details: '',
    };
  }

  const errorMappings: Array<{ pattern: RegExp; message: string }> = [
    { pattern: /fetch|network|net::ERR|Failed to fetch/i, message: 'Impossible de contacter le serveur. Verifiez votre connexion internet.' },
    { pattern: /timeout|timed out|ETIMEDOUT/i, message: 'La requete a pris trop de temps. Veuillez reessayer.' },
    { pattern: /401|unauthorized|not authenticated/i, message: 'Votre session a expire. Veuillez vous reconnecter.' },
    { pattern: /403|forbidden|access denied/i, message: "Vous n'avez pas les droits necessaires pour cette action." },
    { pattern: /404|not found/i, message: "La ressource demandee n'existe pas ou a ete supprimee." },
    { pattern: /500|internal server/i, message: 'Une erreur serveur est survenue. Veuillez reessayer plus tard.' },
    { pattern: /502|503|504|bad gateway|service unavailable/i, message: 'Le service est temporairement indisponible. Veuillez reessayer.' },
    { pattern: /CORS|cross-origin/i, message: "Erreur de configuration serveur. Contactez l'administrateur." },
    { pattern: /JSON|parse|syntax|Failed to parse/i, message: 'Erreur de format de donnees recues du serveur. Veuillez reessayer.' },
    { pattern: /Search Analysis|analyze.*response/i, message: "L'analyse du CV a echoue. Veuillez reessayer." },
    { pattern: /abort|cancelled|canceled/i, message: "L'operation a ete annulee." },
    { pattern: /quota|storage|space/i, message: 'Espace de stockage insuffisant.' },
    { pattern: /permission|denied/i, message: 'Permission refusee pour cette operation.' },
    { pattern: /invalid|validation/i, message: 'Les donnees saisies sont invalides. Veuillez verifier.' },
    { pattern: /duplicate|already exists/i, message: 'Cet element existe deja.' },
    { pattern: /rate limit|too many requests/i, message: 'Trop de requetes. Veuillez patienter quelques instants.' },
    { pattern: /file.*large|size.*exceed/i, message: 'Le fichier est trop volumineux.' },
    { pattern: /unsupported.*type|invalid.*format/i, message: 'Format de fichier non supporte.' },
  ];

  for (const mapping of errorMappings) {
    if (mapping.pattern.test(technicalMessage)) {
      return { message: mapping.message, details: technicalMessage + (details ? '\n\n' + details : '') };
    }
  }

  if (technicalMessage) {
    return {
      message: 'Une erreur est survenue. Veuillez reessayer.',
      details: technicalMessage + (details ? '\n\n' + details : ''),
    };
  }

  return { message: 'Une erreur inattendue est survenue.', details };
};

export const showCaughtError = (
  error: unknown,
  _contextMessage = 'Une erreur est survenue'
): void => {
  if (isSessionRedirectError(error) || isInsufficientCreditsRedirectError(error)) {
    return;
  }

  const { message, details } = getUserFriendlyMessage(error);
  showErrorWithDetails(message, details || undefined);
};
