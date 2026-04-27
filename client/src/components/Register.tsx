/**
 * Register Component
 * TypeScript version
 */

import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { fetchWithCsrfRetry } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';
import AuthPageShell from './AuthPageShell';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string;
        callback?: (token: string) => void;
        'expired-callback'?: () => void;
        'error-callback'?: () => void;
        theme?: 'light' | 'dark' | 'auto';
      }) => string;
      remove?: (widgetId: string) => void;
      reset?: (widgetId?: string) => void;
    };
  }
}

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  website: string;
}

type FieldName = 'name' | 'email' | 'password' | 'confirmPassword';
type FieldErrors = Partial<Record<FieldName, string>>;

const TURNSTILE_SITE_KEY = (
  import.meta.env.CLOUDFLARE_TURNSTILE_SITE_KEY
  || import.meta.env.VITE_TURNSTILE_SITE_KEY
  || ''
).trim();
const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';
const authLinkClassName = 'font-medium text-[#6b4eff] transition-colors hover:text-[#5b3eee] dark:text-[#c9ccff] dark:hover:text-white';
const authInputClassName = 'relative block w-full border-0 bg-white px-3 py-3 text-gray-900 placeholder-gray-500 focus:z-10 focus:outline-none focus:ring-2 focus:ring-[#6b4eff]/25 sm:text-sm dark:bg-[#111827] dark:text-gray-100 dark:placeholder-gray-400';
const authSecondaryButtonClassName = 'flex w-full items-center justify-center rounded-[13px] border border-[#e4e4e7] bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-[#f8f8f7] focus:outline-none focus:ring-2 focus:ring-[#6b4eff]/25 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#111827] dark:text-gray-200 dark:hover:bg-[#182235]';

const Register = (): JSX.Element => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    website: '',
  });
  const [formRenderedAt] = useState<number>(() => Date.now());
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const captchaContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const fieldRefs = useRef<Partial<Record<FieldName, HTMLInputElement | null>>>({});
  const formErrorId = error ? 'register-form-error' : undefined;

  useEffect(() => {
    const regError = searchParams.get('error');
    if (regError === 'registration_failed') {
      setError(t('auth.register.googleRegistrationFailed'));
      navigate('/register', { replace: true });
    }
  }, [searchParams, navigate, t]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !captchaContainerRef.current || typeof window === 'undefined') {
      return;
    }

    let cancelled = false;

    const renderTurnstile = () => {
      if (cancelled || !captchaContainerRef.current || !window.turnstile || turnstileWidgetIdRef.current) {
        return;
      }

      turnstileWidgetIdRef.current = window.turnstile.render(captchaContainerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'auto',
        callback: (token: string) => {
          setCaptchaToken(token);
        },
        'expired-callback': () => {
          setCaptchaToken('');
        },
        'error-callback': () => {
          setCaptchaToken('');
        },
      });
    };

    if (window.turnstile) {
      renderTurnstile();
    } else {
      const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener('load', renderTurnstile, { once: true });
      } else {
        const script = document.createElement('script');
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.addEventListener('load', renderTurnstile, { once: true });
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (turnstileWidgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
      }
      turnstileWidgetIdRef.current = null;
    };
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    if (name in fieldErrors) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name as FieldName];
        return next;
      });
    }
  };

  const validateForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!formData.name) errors.name = t('errors.required');
    if (!formData.email) errors.email = t('errors.required');
    if (!formData.password) {
      errors.password = t('errors.required');
    } else if (formData.password.length < 8) {
      errors.password = t('errors.passwordLength');
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = t('errors.required');
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = t('errors.passwordMismatch');
    }

    return errors;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const validationErrors = validateForm();
    const firstFieldWithError = (Object.keys(validationErrors)[0] as FieldName | undefined);
    if (firstFieldWithError) {
      setFieldErrors(validationErrors);
      setError(validationErrors[firstFieldWithError] || '');
      fieldRefs.current[firstFieldWithError]?.focus();
      return;
    }

    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setFieldErrors({});
      setError('Captcha verification is required.');
      return;
    }

    setError('');
    setFieldErrors({});
    setLoading(true);

    try {
      const registrationResult = await register({
        name: formData.name,
        email: formData.email.toLowerCase(),
        password: formData.password,
        website: formData.website,
        formRenderedAt,
        captchaToken: TURNSTILE_SITE_KEY ? captchaToken : undefined,
        captchaProvider: TURNSTILE_SITE_KEY ? 'turnstile' : undefined,
      });
      navigate(`/signin?success=${registrationResult.registrationStatus === 'active' ? 'registered_active_test' : 'registered_pending'}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.serverError');
      setFieldErrors({});
      setError(errorMessage);
      if (turnstileWidgetIdRef.current) {
        window.turnstile?.reset?.(turnstileWidgetIdRef.current);
        setCaptchaToken('');
      }
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
            <div id="register-form-error" role="alert" aria-live="polite" className="text-sm text-red-700 dark:text-red-200">{error}</div>
          </div>
        ) : null}

        <div className="-space-y-px overflow-hidden rounded-[13px] border border-[#e4e4e7] shadow-none dark:border-white/10">
          <label htmlFor="website" className="sr-only">
            Website
          </label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={formData.website}
            onChange={handleChange}
            className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden opacity-0 pointer-events-none"
            aria-hidden="true"
          />
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
            ref={(node) => {
              fieldRefs.current.name = node;
            }}
            className={`${authInputClassName} rounded-t-[13px]`}
            placeholder={t('auth.register.namePlaceholder')}
            aria-invalid={fieldErrors.name ? 'true' : 'false'}
            aria-describedby={fieldErrors.name ? 'register-name-error' : formErrorId}
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
            ref={(node) => {
              fieldRefs.current.email = node;
            }}
            className={authInputClassName}
            placeholder={t('auth.register.emailPlaceholder')}
            aria-invalid={fieldErrors.email ? 'true' : 'false'}
            aria-describedby={fieldErrors.email ? 'register-email-error' : formErrorId}
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
              ref={(node) => {
                fieldRefs.current.password = node;
              }}
              className={`${authInputClassName} pr-11`}
              placeholder={t('auth.register.passwordPlaceholder')}
              aria-invalid={fieldErrors.password ? 'true' : 'false'}
              aria-describedby={fieldErrors.password ? 'register-password-error' : formErrorId}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
              aria-label={showPassword ? t('auth.togglePassword.hide') : t('auth.togglePassword.show')}
            >
              {showPassword ? <EyeSlashIcon aria-hidden="true" className="h-5 w-5" /> : <EyeIcon aria-hidden="true" className="h-5 w-5" />}
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
              ref={(node) => {
                fieldRefs.current.confirmPassword = node;
              }}
              className={`${authInputClassName} rounded-b-[13px] pr-11`}
              placeholder={t('auth.register.confirmPasswordPlaceholder')}
              aria-invalid={fieldErrors.confirmPassword ? 'true' : 'false'}
              aria-describedby={fieldErrors.confirmPassword ? 'register-confirm-password-error' : formErrorId}
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
              {showConfirmPassword ? <EyeSlashIcon aria-hidden="true" className="h-5 w-5" /> : <EyeIcon aria-hidden="true" className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {fieldErrors.name ? (
          <p id="register-name-error" className="text-sm text-red-700 dark:text-red-200">
            {fieldErrors.name}
          </p>
        ) : null}
        {fieldErrors.email ? (
          <p id="register-email-error" className="text-sm text-red-700 dark:text-red-200">
            {fieldErrors.email}
          </p>
        ) : null}
        {fieldErrors.password ? (
          <p id="register-password-error" className="text-sm text-red-700 dark:text-red-200">
            {fieldErrors.password}
          </p>
        ) : null}
        {fieldErrors.confirmPassword ? (
          <p id="register-confirm-password-error" className="text-sm text-red-700 dark:text-red-200">
            {fieldErrors.confirmPassword}
          </p>
        ) : null}

        {TURNSTILE_SITE_KEY ? (
          <div className="rounded-[13px] border border-[#e4e4e7] bg-white px-4 py-4 shadow-none dark:border-white/10 dark:bg-[#111827]">
            <div ref={captchaContainerRef} data-testid="turnstile-container" />
          </div>
        ) : null}

        <p className="rounded-[9px] bg-[#f8f8f7] px-3 py-2 text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">
          {t('auth.resetPassword.passwordHint')}
        </p>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="app-primary-action w-full rounded-[13px] px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#6b4eff]/25 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t('common.loading') : t('auth.register.registerButton')}
        </button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-500 dark:bg-[#182235] dark:text-gray-400">
              {t('auth.register.orContinueWith')}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleRegister}
          disabled={loading || googleLoading}
          className={authSecondaryButtonClassName}
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
            <Link to="/signin" className={authLinkClassName}>
              {t('common.signIn')}
            </Link>
          </span>
        </div>
      </form>
    </AuthPageShell>
  );
};

export default Register;
