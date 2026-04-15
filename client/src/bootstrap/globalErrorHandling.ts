import { createLogger } from '../utils/logger.frontend';
import { resetSessionState } from '../utils/apiInterceptor';
import { isInsufficientCreditsRedirectError } from '../utils/insufficientCreditsRedirect';

const log = createLogger('GlobalError');

const AUTH_ERROR_PATTERNS = [
  'URI malformed',
  'URIError',
  'malformed URI',
  'jwt malformed',
  'jwt expired',
  'invalid token',
  'token expired',
  'unauthorized',
  'session expired',
  'SessionRedirectError',
  'Session expired - redirecting to login',
];

const DEV_CONSOLE_SUPPRESS_PATTERNS = [
  'message channel closed',
  'A listener indicated an asynchronous response',
  'Uncaught (in promise) Error: A listener indicated an asynchronous response',
  'Extension context invalidated',
  'Could not establish connection',
  'ResizeObserver loop',
  'HydrateFallback',
  'content.js',
  'WebAssembly.instantiate()',
  'CompileError: WebAssembly',
  'Executing inline script violates the following Content Security Policy directive',
  'Content Security Policy directive',
];

const EXTENSION_ERROR_PATTERNS = [
  'message channel closed',
  'A listener indicated an asynchronous response',
  'Extension context invalidated',
  'Could not establish connection',
  'content.js',
  'chrome-extension://',
  'moz-extension://',
  'safari-web-extension://',
  'WebAssembly.instantiate()',
  'CompileError: WebAssembly',
];

const RUNTIME_SUPPRESS_PATTERNS = [
  ...EXTENSION_ERROR_PATTERNS,
  'ResizeObserver loop completed with undelivered notifications',
  'ResizeObserver loop limit exceeded',
];

function includesPattern(message: string, patterns: string[]): boolean {
  const normalized = message.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

function isAuthError(message: string): boolean {
  return includesPattern(message, AUTH_ERROR_PATTERNS);
}

function isSessionRedirect(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === 'object' && error !== null) {
    const err = error as { name?: string; message?: string };
    return err.name === 'SessionRedirectError' || err.message?.includes('Session expired - redirecting to login') || false;
  }
  return String(error).includes('SessionRedirectError');
}

function isExternalScriptIssue(parts: Array<string | undefined>): boolean {
  return includesPattern(parts.filter(Boolean).join(' '), EXTENSION_ERROR_PATTERNS);
}

function isExternalCspViolation(event: SecurityPolicyViolationEvent): boolean {
  return (
    event.effectiveDirective === 'script-src' &&
    event.blockedURI === 'inline' &&
    !event.sourceFile
  );
}

function redirectToSignin(): void {
  if (window.location.pathname === '/signin') return;

  resetSessionState();
  window.location.replace('/signin?expired=true');
}

function installDevelopmentConsoleFilters(): void {
  if (!import.meta.env.DEV) return;

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const message = args.map((arg) => String(arg || '')).join(' ');
    if (includesPattern(message, DEV_CONSOLE_SUPPRESS_PATTERNS)) {
      return;
    }
    originalConsoleError(...args);
  };

  const originalConsoleWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const message = args.map((arg) => String(arg || '')).join(' ');
    if (includesPattern(message, ['HydrateFallback', 'ResizeObserver loop'])) {
      return;
    }
    originalConsoleWarn(...args);
  };
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const reason = String((event.reason as { message?: string } | undefined)?.message || event.reason || '');
  const stack = String((event.reason as { stack?: string } | undefined)?.stack || '');
  const combinedReason = `${reason} ${stack}`;

  if (isSessionRedirect(event.reason)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  if (isInsufficientCreditsRedirectError(event.reason)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  if (isAuthError(reason) || isAuthError(stack)) {
    log.warn('Authentication-related rejection captured, redirecting to signin', { reason });
    event.preventDefault();
    event.stopImmediatePropagation();
    redirectToSignin();
    return;
  }

  if (isExternalScriptIssue([reason, stack])) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  if (includesPattern(combinedReason, ['Failed to fetch', 'NetworkError'])) {
    log.warn('Unhandled network rejection', { reason });
    return;
  }

  log.error('Unhandled promise rejection', {
    reason,
    stack: stack || undefined,
  });
}

function handleRuntimeError(event: ErrorEvent): void {
  const message = String(event.message || '');
  const errorString = String(event.error || '');
  const combinedMessage = `${message} ${errorString}`;

  if (isSessionRedirect(event.error)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  if (isInsufficientCreditsRedirectError(event.error)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  if (isAuthError(message) || isAuthError(errorString)) {
    log.warn('Authentication-related runtime error captured, redirecting to signin', {
      message,
      error: errorString || undefined,
    });
    event.preventDefault();
    event.stopImmediatePropagation();
    redirectToSignin();
    return;
  }

  if (isExternalScriptIssue([message, errorString, event.filename])) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  if (includesPattern(combinedMessage, RUNTIME_SUPPRESS_PATTERNS)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  log.error('Runtime error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error instanceof Error
      ? { name: event.error.name, message: event.error.message, stack: event.error.stack }
      : errorString || undefined,
  });
}

function handleSecurityPolicyViolation(event: SecurityPolicyViolationEvent): void {
  if (isExternalCspViolation(event)) {
    return;
  }

  log.warn('Content Security Policy violation', {
    directive: event.effectiveDirective,
    blockedURI: event.blockedURI,
    sourceFile: event.sourceFile || undefined,
    lineNumber: event.lineNumber || undefined,
    columnNumber: event.columnNumber || undefined,
  });
}

export function installGlobalErrorHandling(): void {
  installDevelopmentConsoleFilters();
  window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
  window.addEventListener('error', handleRuntimeError, true);
  window.addEventListener('securitypolicyviolation', handleSecurityPolicyViolation);
}
