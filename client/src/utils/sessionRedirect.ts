import logger from './logger.frontend';

let sessionRedirectInProgress = false;
let sessionExpiredHandler: (() => void) | null = null;

export const setSessionExpiredHandler = (handler: (() => void) | null): void => {
  sessionExpiredHandler = handler;
};

export const isSessionRedirectInProgress = (): boolean => sessionRedirectInProgress;

export const redirectToExpiredSession = (): void => {
  if (typeof window !== 'undefined') {
    window.location.replace('/signin?expired=true');
  }
};

export const triggerSessionExpiry = (): void => {
  if (sessionRedirectInProgress) {
    return;
  }

  sessionRedirectInProgress = true;

  if (sessionExpiredHandler) {
    logger.warn('[SessionRedirect] Triggering registered session expiry handler');
    sessionExpiredHandler();
    return;
  }

  logger.warn('[SessionRedirect] No session expiry handler registered, redirecting directly');
  redirectToExpiredSession();
};

export const resetSessionRedirect = (): void => {
  sessionRedirectInProgress = false;
};
