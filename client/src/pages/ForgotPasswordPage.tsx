/**
 * ForgotPasswordPage
 * Allows users to request a password reset email
 */

import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/authService';
import AuthPageShell from '../components/AuthPageShell';

const authLinkClassName = 'text-sm font-medium text-[#6b4eff] transition-colors hover:text-[#5b3eee] dark:text-[#c9ccff] dark:hover:text-white';
const authFieldClassName = 'auth-field block w-full rounded-[13px] border border-[#e4e4e7] bg-white px-3 py-3 text-gray-900 placeholder-gray-500 focus:border-[#6b4eff] focus:outline-none focus:ring-2 focus:ring-[#6b4eff]/25 sm:text-sm dark:border-white/10 dark:bg-[#111827] dark:text-gray-100 dark:placeholder-gray-400';

const ForgotPasswordPage = (): JSX.Element => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.forgotPassword(email);
      setSubmitted(true);
    } catch {
      setError(t('auth.forgotPassword.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title={t('auth.forgotPassword.title')}
      subtitle={t('auth.forgotPassword.subtitle')}
      asideTitle={t('auth.forgotPassword.title')}
      asideBody={t('auth.forgotPassword.subtitle')}
      asidePoints={[t('auth.forgotPassword.successMessage'), t('auth.forgotPassword.checkSpam')]}
      backLabel={t('common.back')}
    >
      {submitted ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 dark:border-green-900/60 dark:bg-green-950/30">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                {t('auth.forgotPassword.successTitle')}
              </h3>
              <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                {t('auth.forgotPassword.successMessage')}
              </p>
              <p className="mt-3 text-sm text-green-600 dark:text-green-400">
                {t('auth.forgotPassword.checkSpam')}
              </p>
            </div>
          </div>
          <div className="mt-6 text-center">
            <Link to="/signin" className={`inline-flex items-center gap-2 ${authLinkClassName}`}>
              {t('auth.forgotPassword.backToSignIn')}
              <ArrowRightIcon className="h-4 w-4" />
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

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('auth.forgotPassword.emailLabel')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authFieldClassName}
              placeholder={t('auth.forgotPassword.emailPlaceholder')}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="app-primary-action w-full rounded-[13px] px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#6b4eff]/25 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('auth.forgotPassword.submitButton')}
          </button>

          <div className="text-center">
            <Link to="/signin" className={authLinkClassName}>
              {t('auth.forgotPassword.backToSignIn')}
            </Link>
          </div>
        </form>
      )}
    </AuthPageShell>
  );
};

export default ForgotPasswordPage;
