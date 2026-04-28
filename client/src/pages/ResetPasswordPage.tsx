/**
 * ResetPasswordPage
 * Allows users to set a new password using a reset token from the email link
 */

import { useState, FormEvent, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/authService';
import AuthPageShell from '../components/AuthPageShell';

const authLinkClassName = 'text-sm font-medium text-[#6b4eff] transition-colors hover:text-[#5b3eee] dark:text-[#c9ccff] dark:hover:text-white';
const authFieldClassName = 'auth-field block w-full rounded-[13px] border border-[#e4e4e7] bg-white px-3 py-3 pr-11 text-gray-900 placeholder-gray-500 focus:border-[#6b4eff] focus:outline-none focus:ring-2 focus:ring-[#6b4eff]/25 sm:text-sm dark:border-white/10 dark:bg-[#111827] dark:text-gray-100 dark:placeholder-gray-400';

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
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const confirmPasswordRef = useRef<HTMLInputElement | null>(null);
  const formErrorId = error ? 'reset-password-form-error' : undefined;

  useEffect(() => {
    if (!token) {
      navigate('/forgot-password', { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (password !== confirmPassword) {
      const nextError = t('auth.resetPassword.passwordMismatch');
      setFieldErrors({ confirmPassword: nextError });
      setError(nextError);
      confirmPasswordRef.current?.focus();
      return;
    }

    if (password.length < 8) {
      const nextError = t('auth.resetPassword.passwordMinLength');
      setFieldErrors({ password: nextError });
      setError(nextError);
      passwordRef.current?.focus();
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
            <Link
              to="/signin"
              className="inline-flex items-center rounded-[13px] bg-[#6b4eff] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5b3eee] focus:outline-none focus:ring-2 focus:ring-[#6b4eff]/25 focus:ring-offset-2 dark:bg-[#8f95ff] dark:text-[#101423] dark:hover:bg-[#c9ccff]"
            >
              {t('auth.resetPassword.goToSignIn')}
            </Link>
          </div>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/40">
              <div id="reset-password-form-error" role="alert" aria-live="polite" className="text-sm text-red-700 dark:text-red-200">{error}</div>
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                ref={passwordRef}
                className={authFieldClassName}
                placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
                minLength={8}
                aria-invalid={fieldErrors.password ? 'true' : 'false'}
                aria-describedby={fieldErrors.password ? 'reset-password-password-error' : formErrorId}
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 top-7 flex items-center px-3 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200" aria-label={showPassword ? t('auth.togglePassword.hide') : t('auth.togglePassword.show')}>
                {showPassword ? <EyeSlashIcon aria-hidden="true" className="h-5 w-5" /> : <EyeIcon aria-hidden="true" className="h-5 w-5" />}
              </button>
              {fieldErrors.password ? (
                <p id="reset-password-password-error" className="mt-2 text-sm text-red-700 dark:text-red-200">
                  {fieldErrors.password}
                </p>
              ) : null}
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
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }
                }}
                ref={confirmPasswordRef}
                className={authFieldClassName}
                placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
                minLength={8}
                aria-invalid={fieldErrors.confirmPassword ? 'true' : 'false'}
                aria-describedby={fieldErrors.confirmPassword ? 'reset-password-confirm-error' : formErrorId}
              />
              <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="absolute inset-y-0 right-0 top-7 flex items-center px-3 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200" aria-label={showConfirmPassword ? t('auth.togglePassword.hideConfirmation') : t('auth.togglePassword.showConfirmation')}>
                {showConfirmPassword ? <EyeSlashIcon aria-hidden="true" className="h-5 w-5" /> : <EyeIcon aria-hidden="true" className="h-5 w-5" />}
              </button>
              {fieldErrors.confirmPassword ? (
                <p id="reset-password-confirm-error" className="mt-2 text-sm text-red-700 dark:text-red-200">
                  {fieldErrors.confirmPassword}
                </p>
              ) : null}
            </div>
          </div>

          <p className="rounded-[9px] bg-[#f8f8f7] px-3 py-2 text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">{t('auth.resetPassword.passwordHint')}</p>

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="app-primary-action w-full rounded-[13px] px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#6b4eff]/25 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('auth.resetPassword.submitButton')}
          </button>

          <div className="text-center">
            <Link to="/signin" className={authLinkClassName}>
              {t('auth.resetPassword.backToSignIn')}
            </Link>
          </div>
        </form>
      )}
    </AuthPageShell>
  );
};

export default ResetPasswordPage;
