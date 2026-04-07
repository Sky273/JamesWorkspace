/**
 * ResetPasswordPage
 * Allows users to set a new password using a reset token from the email link
 */

import { useState, FormEvent, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/authService';
import AuthPageShell from '../components/AuthPageShell';

const ResetPasswordPage = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/forgot-password', { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.resetPassword.passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('auth.resetPassword.passwordMinLength'));
      return;
    }

    setLoading(true);

    try {
      const result = await authService.resetPassword(token, password);
      if (!result.success) {
        const errorKey = result.code ? `auth.resetPassword.errors.${result.code}` : '';
        const translatedError = errorKey ? t(errorKey) : result.message;
        setError(translatedError !== errorKey ? translatedError : result.message);
        return;
      }
      setSuccess(true);
    } catch {
      setError(t('auth.resetPassword.error'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) return <></>;

  return (
    <AuthPageShell
      title={t('auth.resetPassword.title')}
      subtitle={t('auth.resetPassword.subtitle')}
      asideTitle={t('auth.resetPassword.title')}
      asideBody={t('auth.resetPassword.passwordHint')}
      asidePoints={[t('auth.resetPassword.passwordMinLength'), t('auth.resetPassword.backToSignIn')]}
      backLabel={t('common.back')}
    >
      {success ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 dark:border-green-900/60 dark:bg-green-950/30">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-green-800 dark:text-green-200">{t('auth.resetPassword.successTitle')}</h3>
              <p className="mt-2 text-sm text-green-700 dark:text-green-300">{t('auth.resetPassword.successMessage')}</p>
            </div>
          </div>
          <div className="mt-6 text-center">
            <Link to="/signin" className="inline-flex items-center rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
              {t('auth.resetPassword.goToSignIn')}
            </Link>
          </div>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/40">
              <div className="text-sm text-red-700 dark:text-red-200">{error}</div>
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="relative">
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('auth.resetPassword.newPasswordLabel')}</label>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 pr-11 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
                minLength={8}
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 top-7 flex items-center px-3 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>

            <div className="relative">
              <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('auth.resetPassword.confirmPasswordLabel')}</label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 pr-11 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
                minLength={8}
              />
              <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="absolute inset-y-0 right-0 top-7 flex items-center px-3 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200" aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}>
                {showConfirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">{t('auth.resetPassword.passwordHint')}</p>

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('auth.resetPassword.submitButton')}
          </button>

          <div className="text-center">
            <Link to="/signin" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
              {t('auth.resetPassword.backToSignIn')}
            </Link>
          </div>
        </form>
      )}
    </AuthPageShell>
  );
};

export default ResetPasswordPage;
