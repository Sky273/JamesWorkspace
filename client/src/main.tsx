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

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  const reason = String(event.reason?.message || event.reason || '');
  
  // List of patterns to suppress
  const suppressPatterns = [
    'message channel closed',
    'A listener indicated an asynchronous response',
    'Extension context invalidated',
    'Could not establish connection',
    'Failed to fetch', // Network errors from extensions
    'NetworkError' // Network errors
  ];
  
  // Check if this is an extension-related error
  const isExtensionError = suppressPatterns.some(pattern => reason.includes(pattern));
  
  if (isExtensionError) {
    event.preventDefault(); // Prevent console error
    return;
  }
  
  // Log legitimate application errors to console for debugging
  console.warn('[Unhandled Promise Rejection]', event.reason);
  
  // Prevent the default browser error display
  event.preventDefault();
});

// Global error handler for runtime errors
window.addEventListener('error', (event: ErrorEvent) => {
  const message = String(event.message || '');
  
  // Suppress extension-related errors and non-critical warnings
  const suppressPatterns = [
    'message channel closed',
    'Extension context invalidated',
    'Could not establish connection',
    'ResizeObserver loop completed with undelivered notifications',
    'ResizeObserver loop limit exceeded'
  ];
  
  if (suppressPatterns.some(pattern => message.includes(pattern))) {
    event.preventDefault();
    return;
  }
  
  // Log legitimate errors
  console.warn('[Runtime Error]', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

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
