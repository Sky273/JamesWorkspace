/**
 * SignIn Component
 * TypeScript version
 */

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { resetSessionState, fetchWithCsrfRetry } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';
import TwoFactorVerify from './TwoFactorVerify';
import AuthPageShell from './AuthPageShell';

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
  const [showPassword, setShowPassword] = useState<boolean>(false);

  useEffect(() => {
    resetSessionState();
  }, []);

  useEffect(() => {
    const expired = searchParams.get('expired');
    const googleError = searchParams.get('error');
    const googleEmail = searchParams.get('email');
    const success = searchParams.get('success');

    if (expired === 'true') {
      toast.error(t('auth.signIn.sessionExpired'), { duration: 4000, icon: '!' });
      navigate('/signin', { replace: true });
    }

    if (success === 'registered_pending') {
      toast.success(t('auth.signIn.registeredPending'), { duration: 6000, icon: 'OK' });
      navigate('/signin', { replace: true });
    }

    if (success === 'registered_active_test') {
      const registeredActiveTestMessage = t('auth.signIn.registeredActiveTest');
      toast.success(
        registeredActiveTestMessage === 'auth.signIn.registeredActiveTest'
          ? "Inscription réussie ! Votre compte de test est actif et vous pouvez vous connecter immédiatement."
          : registeredActiveTestMessage,
        { duration: 6000, icon: 'OK' }
      );
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

      if (result && typeof result === 'object' && 'requires2FA' in result && result.requires2FA) {
        setRequires2FA(true);
        setPending2FAUserId(result.userId || '');
        setLoading(false);
        return;
      }

      if (result && typeof result === 'object' && 'status' in result && result.status === 'pending') {
        setError(t('auth.signIn.accountPending'));
        return;
      }

      navigate('/');
    } catch (authError) {
      logger.error('Sign in failed:', authError);
      const rawMessage = authError instanceof Error ? authError.message : '';
      setError(
        rawMessage.includes('Password replacement required')
          ? rawMessage
          : t('errors.unauthorized')
      );
    } finally {
      setLoading(false);
    }
  };

  const handle2FASuccess = (_user: unknown): void => {
    navigate('/');
  };

  const handle2FACancel = (): void => {
    setRequires2FA(false);
    setPending2FAUserId('');
    setPassword('');
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
    <AuthPageShell
      title={t('auth.signIn.title')}
      subtitle={t('home.hero.description')}
      asideTitle={t('auth.signIn.title')}
      asideBody={t('home.hero.description')}
      asidePoints={[
        t('home.hero.badges.secure', '100% Securise'),
        t('home.hero.badges.fastAnalysis', 'Analyse rapide'),
        t('home.hero.badges.gdprCompliant', 'Compatible RGPD'),
      ]}
      backLabel={t('common.back')}
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/40">
            <div className="text-sm text-red-700 dark:text-red-200">{error}</div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 shadow-sm -space-y-px dark:border-white/10">
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
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            className="relative block w-full rounded-t-2xl border-0 bg-white px-3 py-3 text-gray-900 placeholder-gray-500 focus:z-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
            placeholder={t('auth.signIn.emailPlaceholder')}
          />
          <div className="relative">
            <label htmlFor="password" className="sr-only">
              {t('auth.signIn.passwordLabel')}
            </label>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              className="relative block w-full rounded-b-2xl border-0 bg-white px-3 py-3 pr-11 text-gray-900 placeholder-gray-500 focus:z-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
              placeholder={t('auth.signIn.passwordPlaceholder')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
              aria-label={showPassword ? t('auth.togglePassword.hide') : t('auth.togglePassword.show')}
            >
              {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <label htmlFor="remember-me" className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-700" />
            {t('auth.signIn.rememberMe')}
          </label>
          <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
            {t('auth.signIn.forgotPassword')}
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t('common.loading') : t('auth.signIn.signInButton')}
        </button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-500 dark:bg-[#0f172ad9] dark:text-gray-400">
              {t('auth.signIn.orContinueWith')}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading || googleLoading}
          className="flex w-full items-center justify-center rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {googleLoading ? t('common.loading') : t('auth.signIn.signInWithGoogle')}
        </button>

        <div className="text-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('auth.signIn.noAccount')}{' '}
            <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
              {t('common.register')}
            </Link>
          </span>
        </div>
      </form>
    </AuthPageShell>
  );
};

export default SignIn;
