import { SessionRedirectError } from './auth.types';

const SESSION_ERROR_PATTERNS = [
  'csrf',
  'token',
  'session',
  'expired',
  'invalid_csrf',
  'CSRF_INVALID',
  'TOKEN_EXPIRED',
];

export const REQUEST_TIMEOUT_MESSAGE = 'Request timeout';
export const FORBIDDEN_MESSAGE_FALLBACK = 'Acces refuse';
export const REQUEST_TIMEOUT_USER_MESSAGE = 'La requete a expire. Veuillez reessayer.';
export const GATEWAY_TIMEOUT_USER_MESSAGE = 'Le serveur a mis trop de temps a repondre. Le traitement peut continuer en arriere-plan.';

export const getResponseErrorMessage = async (response: Response, fallbackMessage: string): Promise<string> => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const errorData = await response.clone().json().catch(() => null) as Record<string, unknown> | null;
    const nestedError = errorData?.error;

    if (typeof nestedError === 'string' && nestedError.trim()) {
      return nestedError.trim();
    }

    if (nestedError && typeof nestedError === 'object' && typeof (nestedError as Record<string, unknown>).message === 'string') {
      const nestedMessage = String((nestedError as Record<string, unknown>).message).trim();
      if (nestedMessage) return nestedMessage;
    }

    if (typeof errorData?.message === 'string' && errorData.message.trim()) {
      return errorData.message.trim();
    }
  }

  const rawText = await response.text().catch(() => '');
  const trimmedText = rawText.trim();
  const isHtml = contentType.includes('text/html') || /^\s*<!DOCTYPE html>/i.test(trimmedText) || /^\s*<html/i.test(trimmedText);
  const isGatewayTimeout = response.status === 524 || /Error code 524/i.test(trimmedText) || /A timeout occurred/i.test(trimmedText);

  if (isGatewayTimeout) {
    return GATEWAY_TIMEOUT_USER_MESSAGE;
  }

  if (isHtml) {
    return `Le serveur a retourne une page d'erreur (${response.status} ${response.statusText}).`;
  }

  return trimmedText || fallbackMessage;
};

export const parseForbiddenResponse = async (response: Response): Promise<{ errorMessage: string; errorCode: string }> => {
  let errorMessage = FORBIDDEN_MESSAGE_FALLBACK;
  let errorCode = '';

  try {
    const errorData = await response.clone().json() as Record<string, unknown>;
    errorMessage = typeof errorData.error === 'string' ? errorData.error : errorMessage;
    errorCode = typeof errorData.code === 'string' ? errorData.code : '';
  } catch {
    // Ignore JSON parse errors
  }

  return { errorMessage, errorCode };
};

export const isSessionForbiddenError = (errorMessage: string, errorCode: string): boolean => {
  const normalizedMessage = errorMessage.toLowerCase();
  const normalizedCode = errorCode.toLowerCase();

  return SESSION_ERROR_PATTERNS.some((pattern) =>
    normalizedMessage.includes(pattern.toLowerCase()) ||
    normalizedCode.includes(pattern.toLowerCase())
  );
};

export const toTimeoutError = (): Error => new Error(REQUEST_TIMEOUT_MESSAGE);
export const toTimeoutUserError = (): Error => new Error(REQUEST_TIMEOUT_USER_MESSAGE);
export const toSessionRedirectError = (): SessionRedirectError => new SessionRedirectError();
