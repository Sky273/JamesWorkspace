/**
 * SignIn Component
 * TypeScript version
 */

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { resetSessionState } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';
import { fetchWithCsrfRetry } from '../utils/apiInterceptor';
import TwoFactorVerify from './TwoFactorVerify';
import Footer from './Footer';

const SignIn = (): JSX.Element => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [requires2FA, setRequires2FA] = useState<boolean>(false);
  const [pending2FAUserId, setPending2FAUserId] = useState<string>('');

  // Reset session state on mount to ensure clean state for login
  // This clears isSessionExpiring flag and stale CSRF token cache
  useEffect(() => {
    resetSessionState();
  }, []);

  useEffect(() => {
    const expired = searchParams.get('expired');
    const googleError = searchParams.get('error');
    const googleEmail = searchParams.get('email');
    const success = searchParams.get('success');
    
    if (expired === 'true') {
      toast.error(t('auth.signIn.sessionExpired'), {
        duration: 4000,
        icon: '🔒',
      });
      navigate('/signin', { replace: true });
    }
    
    if (success === 'registered_pending') {
      toast.success(t('auth.signIn.registeredPending'), {
        duration: 6000,
        icon: '✅',
      });
      navigate('/signin', { replace: true });
    }
    
    if (googleError === 'no_account' && googleEmail) {
      setError(t('auth.signIn.googleNoAccount', { email: googleEmail }));
      navigate('/signin', { replace: true });
    } else if (googleError === 'account_inactive') {
      setError(t('auth.signIn.accountInactive'));
      navigate('/signin', { replace: true });
    } else if (googleError) {
      setError(t('auth.signIn.googleAuthFailed'));
      navigate('/signin', { replace: true });
    }
  }, [searchParams, navigate, t]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn(email.toLowerCase(), password);
      
      // Check if 2FA is required
      if (result && typeof result === 'object' && 'requires2FA' in result && result.requires2FA) {
        setRequires2FA(true);
        setPending2FAUserId(result.userId || '');
        setLoading(false);
        return;
      }
      
      navigate('/');
    } catch (error) {
      logger.error('Sign in failed:', error);
      setError(t('errors.unauthorized'));
    } finally {
      setLoading(false);
    }
  };

  const handle2FASuccess = (_user: unknown): void => {
    // User is now authenticated, navigate to home
    navigate('/');
    window.location.reload(); // Refresh to update auth state
  };

  const handle2FACancel = (): void => {
    setRequires2FA(false);
    setPending2FAUserId('');
    setPassword('');
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setPassword(e.target.value);
  };

  const handleGoogleSignIn = async (): Promise<void> => {
    setError('');
    setGoogleLoading(true);
    
    try {
      const response = await fetchWithCsrfRetry('/api/auth/google?action=signin');
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError(t('auth.signIn.googleAuthFailed'));
        setGoogleLoading(false);
      }
    } catch (err) {
      logger.error('Google sign in error:', err);
      setError(t('auth.signIn.googleAuthFailed'));
      setGoogleLoading(false);
    }
  };

  // Show 2FA verification screen if required
  if (requires2FA) {
    return (
      <TwoFactorVerify
        userId={pending2FAUserId}
        email={email}
        password={password}
        onSuccess={handle2FASuccess}
        onCancel={handle2FACancel}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            {t('auth.signIn.title')}
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/50 p-4">
              <div className="text-sm text-red-700 dark:text-red-200">{error}</div>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                {t('auth.signIn.emailLabel')}
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={handleEmailChange}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-800"
                placeholder={t('auth.signIn.emailPlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                {t('auth.signIn.passwordLabel')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={handlePasswordChange}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-800"
                placeholder={t('auth.signIn.passwordPlaceholder')}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                {t('auth.signIn.rememberMe')}
              </label>
            </div>

            <div className="text-sm">
              <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                {t('auth.signIn.forgotPassword')}
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('auth.signIn.signInButton')}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                {t('auth.signIn.orContinueWith')}
              </span>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="group relative w-full flex justify-center items-center py-2 px-4 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {googleLoading ? t('common.loading') : t('auth.signIn.signInWithGoogle')}
            </button>
          </div>

          <div className="text-center mt-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('auth.signIn.noAccount')}{' '}
              <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                {t('common.register')}
              </Link>
            </span>
          </div>
        </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SignIn;
