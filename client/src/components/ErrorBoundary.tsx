/**
 * ErrorBoundary Component
 * Global error boundary with clean error display and expandable details
 * Handles authentication errors by redirecting to signin page
 */

import { Component, ErrorInfo, ReactNode, useState } from 'react';
import { ExclamationTriangleIcon, ChevronDownIcon, ChevronUpIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { createLogger } from '../utils/logger.frontend';
import { isSessionRedirectError } from '../utils/apiInterceptor';

const log = createLogger('ErrorBoundary');

// Authentication-related error patterns that should trigger redirect to signin
const AUTH_ERROR_PATTERNS = [
  'kid_malformed',
  'Mal_wellFormed',
  'jwt malformed',
  'jwt expired',
  'invalid token',
  'token expired',
  'unauthorized',
  'invalid signature',
  'JsonWebTokenError',
  'TokenExpiredError',
  'NotBeforeError',
  'URI malformed',
  'URIError',
  'malformed URI',
  'Session expired - redirecting to login',
  'SessionRedirectError'
];

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRedirecting: boolean;
}

/**
 * Check if an error is authentication-related
 */
const isAuthError = (error: Error | null): boolean => {
  if (!error) return false;
  
  // Check for SessionRedirectError first
  if (isSessionRedirectError(error)) {
    return true;
  }
  
  const errorString = error.toString().toLowerCase();
  const errorMessage = (error.message || '').toLowerCase();
  
  return AUTH_ERROR_PATTERNS.some(pattern => 
    errorString.includes(pattern.toLowerCase()) || 
    errorMessage.includes(pattern.toLowerCase())
  );
};

/**
 * Redirect to signin page with expired flag
 */
const redirectToSignin = (): void => {
  // Clear any stored auth data
  document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
  // Redirect to signin with expired flag
  window.location.replace('/signin?expired=true');
};

interface ErrorDisplayProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry?: () => void;
}

const ErrorDisplay = ({ error, errorInfo, onRetry }: ErrorDisplayProps): JSX.Element => {
  const [showDetails, setShowDetails] = useState(false);

  const handleRetry = (): void => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-red-200 dark:border-red-800 overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 dark:bg-red-900/30 px-6 py-4 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
                Une erreur est survenue
              </h2>
              <p className="text-sm text-red-600 dark:text-red-300">
                L'application a rencontré un problème inattendu
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {error?.message || 'Une erreur inconnue s\'est produite.'}
          </p>

          {/* Details toggle */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            {showDetails ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
            {showDetails ? 'Masquer les détails' : 'Voir les détails techniques'}
          </button>

          {/* Error details */}
          {showDetails && (
            <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-auto max-h-64">
              <p className="text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-all">
                <strong>Error:</strong> {error?.toString()}
                {errorInfo?.componentStack && (
                  <>
                    {'\n\n'}
                    <strong>Component Stack:</strong>
                    {errorInfo.componentStack}
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleRetry}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Recharger la page
          </button>
        </div>
      </div>
    </div>
  );
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRedirecting: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Check if this is an authentication error - mark as redirecting
    if (isAuthError(error)) {
      log.warn('Auth error detected, will redirect to signin', { error: error.message });
      // Schedule redirect (can't call directly in static method)
      setTimeout(() => redirectToSignin(), 0);
      return { hasError: false, error: null, isRedirecting: true }; // Don't show error UI
    }
    return { hasError: true, error, isRedirecting: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Double-check for auth errors in componentDidCatch
    if (isAuthError(error)) {
      log.warn('Auth error in componentDidCatch, redirecting');
      redirectToSignin();
      return;
    }
    
    this.setState({ errorInfo });
    log.error('Caught error', { error: error.message, componentStack: errorInfo?.componentStack?.substring(0, 200) });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, isRedirecting: false });
  };

  render(): ReactNode {
    // If redirecting to signin, show a loading spinner instead of error or children
    if (this.state.isRedirecting) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Session expirée, redirection...</p>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorDisplay
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
export { ErrorDisplay };
