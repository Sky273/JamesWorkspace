/**
 * Error Handler Utility
 * Centralized error handling with toast notifications
 */

import toast from 'react-hot-toast';

interface ApiError {
  message: string;
  status?: number;
  details?: string;
  code?: string;
}

/**
 * Parse error from various sources into a standardized format
 */
export const parseError = (error: unknown): ApiError => {
  if (error instanceof Error) {
    return {
      message: error.message,
      details: error.stack
    };
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    return {
      message: (err.message as string) || (err.error as string) || 'Une erreur est survenue',
      status: err.status as number | undefined,
      details: err.details as string | undefined,
      code: err.code as string | undefined
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return { message: 'Une erreur inconnue est survenue' };
};

/**
 * Get user-friendly error message based on status code
 */
export const getErrorMessage = (status?: number, defaultMessage?: string): string => {
  switch (status) {
    case 400:
      return 'Requête invalide. Veuillez vérifier les données saisies.';
    case 401:
      return 'Session expirée. Veuillez vous reconnecter.';
    case 403:
      return 'Accès refusé. Vous n\'avez pas les permissions nécessaires.';
    case 404:
      return 'Ressource non trouvée.';
    case 408:
      return 'La requête a expiré. Veuillez réessayer.';
    case 413:
      return 'Le fichier est trop volumineux.';
    case 422:
      return 'Données invalides. Veuillez vérifier les informations saisies.';
    case 429:
      return 'Trop de requêtes. Veuillez patienter quelques instants.';
    case 500:
      return 'Erreur serveur. Veuillez réessayer plus tard.';
    case 502:
    case 503:
    case 504:
      return 'Service temporairement indisponible. Veuillez réessayer.';
    default:
      return defaultMessage || 'Une erreur est survenue';
  }
};

/**
 * Show error toast with user-friendly message
 */
export const showErrorToast = (
  error: unknown,
  options: { duration?: number; showDetails?: boolean } = {}
): string => {
  const { duration = 6000, showDetails = false } = options;
  const parsedError = parseError(error);
  const userMessage = getErrorMessage(parsedError.status, parsedError.message);
  
  let displayMessage = userMessage;
  if (showDetails && parsedError.details) {
    displayMessage = `${userMessage}\n\nDétails: ${parsedError.details.substring(0, 200)}...`;
  }

  return toast.error(displayMessage, { duration });
};

/**
 * Show simple error toast
 */
export const showSimpleErrorToast = (message: string, duration = 4000): string => {
  return toast.error(message, { duration });
};

/**
 * Handle API response errors
 */
export const handleApiError = async (
  response: Response,
  defaultMessage = 'Une erreur est survenue'
): Promise<never> => {
  let errorData: Record<string, unknown> = {};
  
  try {
    errorData = await response.json();
  } catch {
    // Response is not JSON
  }

  const error: ApiError = {
    message: (errorData.error as string) || (errorData.message as string) || defaultMessage,
    status: response.status,
    details: (errorData.details as string) || undefined,
    code: errorData.code as string | undefined
  };

  showErrorToast(error);
  throw new Error(error.message);
};

/**
 * Wrapper for async operations with error handling
 */
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  errorMessage = 'Une erreur est survenue'
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error) {
    const parsedError = parseError(error);
    showErrorToast({
      message: errorMessage,
      details: parsedError.message
    });
    return null;
  }
};

export default {
  parseError,
  getErrorMessage,
  showErrorToast,
  showSimpleErrorToast,
  handleApiError,
  withErrorHandling
};
