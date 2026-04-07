/**
 * Register Component
 * TypeScript version
 */

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { fetchWithCsrfRetry } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';
import AuthPageShell from './AuthPageShell';

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const Register = (): JSX.Element => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  useEffect(() => {
    const regError = searchParams.get('error');
    if (regError === 'registration_failed') {
      setError(t('auth.register.googleRegistrationFailed'));
      navigate('/register', { replace: true });
    }
  }, [searchParams, navigate, t]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.name) return t('errors.required');
    if (!formData.email) return t('errors.required');
    if (!formData.password) return t('errors.required');
    if (formData.password.length < 8) return t('errors.passwordLength');
    if (formData.password !== formData.confirmPassword) return t('errors.passwordMismatch');
    return null;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      await register({
        name: formData.name,
        email: formData.email.toLowerCase(),
        password: formData.password
      });
      navigate('/signin?success=registered_pending');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.serverError');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async (): Promise<void> => {
    setError('');
    setGoogleLoading(true);

    try {
      const response = await fetchWithCsrfRetry('/api/auth/google?action=register');
      const data = await response.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError(t('auth.register.googleRegistrationFailed'));
        setGoogleLoading(false);
      }
    } catch (err) {
      logger.error('Google register error:', err);
      setError(t('auth.register.googleRegistrationFailed'));
      setGoogleLoading(false);
    }
  };

  return (
    <AuthPageShell
      title={t('auth.register.title')}
      subtitle={t('home.hero.description')}
      asideTitle={t('auth.register.title')}
      asideBody={t('home.hero.description')}
      asidePoints={[
        t('home.hero.badges.atsFriendly', 'ATS Friendly'),
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
          <label htmlFor="name" className="sr-only">
            {t('auth.register.nameLabel')}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={formData.name}
            onChange={handleChange}
            className="relative block w-full rounded-t-2xl border-0 bg-white px-3 py-3 text-gray-900 placeholder-gray-500 focus:z-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
            placeholder={t('auth.register.namePlaceholder')}
          />
          <label htmlFor="email" className="sr-only">
            {t('auth.register.emailLabel')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="relative block w-full border-0 bg-white px-3 py-3 text-gray-900 placeholder-gray-500 focus:z-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
            placeholder={t('auth.register.emailPlaceholder')}
          />
          <div className="relative">
            <label htmlFor="password" className="sr-only">
              {t('auth.register.passwordLabel')}
            </label>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
              className="relative block w-full border-0 bg-white px-3 py-3 pr-11 text-gray-900 placeholder-gray-500 focus:z-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
              placeholder={t('auth.register.passwordPlaceholder')}
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
          <div className="relative">
            <label htmlFor="confirmPassword" className="sr-only">
              {t('auth.register.confirmPasswordLabel')}
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="relative block w-full rounded-b-2xl border-0 bg-white px-3 py-3 pr-11 text-gray-900 placeholder-gray-500 focus:z-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
              placeholder={t('auth.register.confirmPasswordPlaceholder')}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((value) => !value)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
              aria-label={
                showConfirmPassword
                  ? t('auth.togglePassword.hideConfirmation')
                  : t('auth.togglePassword.showConfirmation')
              }
            >
              {showConfirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">
          {t('auth.resetPassword.passwordHint')}
        </p>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t('common.loading') : t('auth.register.registerButton')}
        </button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-500 dark:bg-[#0f172ad9] dark:text-gray-400">
              {t('auth.register.orContinueWith')}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleRegister}
          disabled={loading || googleLoading}
          className="flex w-full items-center justify-center rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {googleLoading ? t('common.loading') : t('auth.register.registerWithGoogle')}
        </button>

        <div className="text-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('auth.register.hasAccount')}{' '}
            <Link to="/signin" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
              {t('common.signIn')}
            </Link>
          </span>
        </div>
      </form>
    </AuthPageShell>
  );
};

export default Register;
