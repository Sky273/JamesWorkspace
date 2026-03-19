/**
 * Main Entry Point
 * TypeScript version
 */

// IMPORTANT: i18n must be imported FIRST before any React components
import i18n from './i18n';
import { I18nextProvider } from 'react-i18next';

import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/main.css';
import { AuthProvider } from './context/AuthContext';

// ============================================
// GLOBAL ERROR HANDLING
// ============================================

// Suppress browser extension errors and non-critical warnings that pollute the console
// These errors come from extensions like ad blockers, not from our code
// Only apply in development mode to avoid production issues
if (import.meta.env.DEV) {
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const message = String(args[0] || '');
    
    // List of patterns to suppress (extension-related errors and non-critical warnings)
    const suppressPatterns = [
      'message channel closed',
      'A listener indicated an asynchronous response',
      'Uncaught (in promise) Error: A listener indicated an asynchronous response',
      'Extension context invalidated',
      'Could not establish connection',
      'ResizeObserver loop',
      'HydrateFallback'
    ];
    
    // Check if message should be suppressed
    if (suppressPatterns.some(pattern => message.includes(pattern))) {
      return;
    }
    
    originalConsoleError(...args);
  };

  const originalConsoleWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const message = String(args[0] || '');
    
    const suppressPatterns = [
      'HydrateFallback',
      'ResizeObserver loop'
    ];
    
    if (suppressPatterns.some(pattern => message.includes(pattern))) {
      return;
    }
    
    originalConsoleWarn(...args);
  };
}

// Authentication-related error patterns that should trigger redirect to signin
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
  'Session expired - redirecting to login'
];

// Check if an error is authentication-related or a session redirect
const isAuthError = (message: string): boolean => {
  const lowerMessage = message.toLowerCase();
  return AUTH_ERROR_PATTERNS.some(pattern => lowerMessage.includes(pattern.toLowerCase()));
};

// Check if error is a SessionRedirectError (should be silently ignored)
const isSessionRedirect = (error: unknown): boolean => {
  if (!error) return false;
  if (typeof error === 'object' && error !== null) {
    const err = error as { name?: string; message?: string };
    return err.name === 'SessionRedirectError' || 
           err.message?.includes('Session expired - redirecting to login') || false;
  }
  return String(error).includes('SessionRedirectError');
};

// Redirect to signin page silently
const redirectToSignin = (): void => {
  // Prevent multiple redirects
  if (window.location.pathname === '/signin') return;
  
  // Clear any stored auth data
  document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
  // Redirect silently
  window.location.replace('/signin?expired=true');
};

// Global handler for unhandled promise rejections - use capture phase
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  const reason = String(event.reason?.message || event.reason || '');
  const stack = String(event.reason?.stack || '');
  const combinedReason = `${reason} ${stack}`.toLowerCase();
  
  // Check if this is a SessionRedirectError - suppress completely (redirect already in progress)
  if (isSessionRedirect(event.reason)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return; // Don't redirect again, it's already happening
  }
  
  // Check if this is an auth-related error - redirect silently
  if (isAuthError(reason) || isAuthError(stack)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    redirectToSignin();
    return;
  }
  
  // Extension-related patterns (suppress completely)
  const extensionPatterns = [
    'message channel closed',
    'A listener indicated an asynchronous response',
    'Extension context invalidated',
    'Could not establish connection'
  ];
  
  // Network error patterns (log as warning, don't display to user)
  const networkPatterns = [
    'Failed to fetch',
    'NetworkError'
  ];
  
  // Check if this is an extension-related error (suppress completely)
  if (extensionPatterns.some(pattern => combinedReason.includes(pattern.toLowerCase()))) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  
  // Network errors: log for debugging but don't show browser error overlay
  if (networkPatterns.some(pattern => combinedReason.includes(pattern.toLowerCase()))) {
    console.warn('[Network Error]', event.reason);
    event.preventDefault();
    return;
  }
  
  // Log legitimate application errors to console for debugging
  console.warn('[Unhandled Promise Rejection]', event.reason);
  
  // Prevent the default browser error display
  event.preventDefault();
}, true); // Use capture phase

// Global error handler for runtime errors
window.addEventListener('error', (event: ErrorEvent) => {
  const message = String(event.message || '');
  const errorString = String(event.error || '');
  const combinedMessage = `${message} ${errorString}`.toLowerCase();
  
  // Check if this is a SessionRedirectError - suppress completely (redirect already in progress)
  if (isSessionRedirect(event.error)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return; // Don't redirect again, it's already happening
  }
  
  // Check if this is an auth-related error - redirect silently
  if (isAuthError(message) || isAuthError(errorString)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    redirectToSignin();
    return;
  }
  
  // Suppress extension-related errors and non-critical warnings
  const suppressPatterns = [
    'message channel closed',
    'Extension context invalidated',
    'Could not establish connection',
    'ResizeObserver loop completed with undelivered notifications',
    'ResizeObserver loop limit exceeded'
  ];
  
  if (suppressPatterns.some(pattern => combinedMessage.includes(pattern.toLowerCase()))) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  
  // Log legitimate errors
  console.warn('[Runtime Error]', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
}, true); // Use capture phase to intercept before React

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </I18nextProvider>
  </StrictMode>
);
