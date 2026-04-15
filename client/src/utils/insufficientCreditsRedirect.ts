const INSUFFICIENT_CREDITS_ROUTE = '/credits-required';

export class InsufficientCreditsRedirectError extends Error {
  constructor(message = 'Insufficient credits redirect in progress') {
    super(message);
    this.name = 'InsufficientCreditsRedirectError';
  }
}

function normalizeQueryValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
}

export function redirectToInsufficientCreditsPage(details: Record<string, unknown> | null = null): void {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams();
  const required = normalizeQueryValue(details?.required);
  const available = normalizeQueryValue(details?.available);
  const actionType = normalizeQueryValue(details?.actionType);
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (required) {
    params.set('required', required);
  }

  if (available) {
    params.set('available', available);
  }

  if (actionType) {
    params.set('action', actionType);
  }

  if (currentPath && !currentPath.startsWith(INSUFFICIENT_CREDITS_ROUTE)) {
    params.set('from', currentPath);
  }

  const nextUrl = `${INSUFFICIENT_CREDITS_ROUTE}${params.size > 0 ? `?${params.toString()}` : ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentUrl === nextUrl) {
    return;
  }

  if (window.history && typeof window.history.replaceState === 'function') {
    window.history.replaceState(window.history.state, '', nextUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }

  window.location.replace(nextUrl);
}

export function isInsufficientCreditsRedirectError(error: unknown): error is InsufficientCreditsRedirectError {
  return error instanceof InsufficientCreditsRedirectError
    || (typeof error === 'object'
      && error !== null
      && 'name' in error
      && (error as { name?: string }).name === 'InsufficientCreditsRedirectError');
}

export { INSUFFICIENT_CREDITS_ROUTE };
