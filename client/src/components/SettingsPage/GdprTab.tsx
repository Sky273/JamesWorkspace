/**
 * GDPR Settings Tab
 * Configuration for GDPR consent email sending and application mail delivery
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';
import toast from 'react-hot-toast';
import logger from '../../utils/logger.frontend';
import SettingsSwitch from './SettingsSwitch';

interface GdprTabProps {
  t: (key: string, options?: Record<string, unknown>) => string;
}

interface GdprMailStatus {
  connected: boolean;
  email?: string;
  provider?: string;
  selectedProvider?: string;
  effectiveProvider?: string;
  configSource?: string;
  needsReauth?: boolean;
  allowConnect?: boolean;
  allowDisconnect?: boolean;
  managedByConfiguration?: boolean;
  supportsOAuth?: boolean;
  missingFields?: string[];
}

interface GdprMailConfig {
  provider: 'gmail' | 'smtp' | 'auto';
  effectiveProvider?: 'gmail' | 'smtp';
  source?: 'environment' | 'database';
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFromName: string;
  smtpFromEmail: string;
  googleGdprRedirectUri: string;
  hasSmtpPassword: boolean;
  smtpConfigured?: boolean;
  googleClientConfigured?: boolean;
}

interface GdprMailConfigForm extends Omit<GdprMailConfig, 'hasSmtpPassword' | 'smtpConfigured' | 'googleClientConfigured'> {
  smtpPassword: string;
  clearSmtpPassword: boolean;
}

const DEFAULT_CONFIG: GdprMailConfig = {
  provider: 'gmail',
  effectiveProvider: 'gmail',
  source: 'environment',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPassword: '',
  smtpFromName: 'ResumeConverter',
  smtpFromEmail: '',
  googleGdprRedirectUri: '',
  hasSmtpPassword: false,
  smtpConfigured: false,
  googleClientConfigured: false,
};

function buildInitialForm(config: GdprMailConfig): GdprMailConfigForm {
  return {
    provider: config.provider,
    effectiveProvider: config.effectiveProvider,
    source: config.source,
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    smtpSecure: config.smtpSecure,
    smtpUser: config.smtpUser,
    smtpPassword: config.smtpPassword,
    smtpFromName: config.smtpFromName,
    smtpFromEmail: config.smtpFromEmail,
    googleGdprRedirectUri: config.googleGdprRedirectUri,
    clearSmtpPassword: false,
  };
}

export const GdprTab = ({ t }: GdprTabProps): JSX.Element => {
  const [mailStatus, setMailStatus] = useState<GdprMailStatus | null>(null);
  const [mailConfig, setMailConfig] = useState<GdprMailConfig>(DEFAULT_CONFIG);
  const [formState, setFormState] = useState<GdprMailConfigForm>(buildInitialForm(DEFAULT_CONFIG));
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testingSend, setTestingSend] = useState(false);
  const trustedOrigin = window.location.origin;
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oauthPopupRef = useRef<Window | null>(null);
  const oauthMessageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  const cleanupOAuthFlow = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (oauthMessageHandlerRef.current) {
      window.removeEventListener('message', oauthMessageHandlerRef.current);
      oauthMessageHandlerRef.current = null;
    }

    if (
      oauthPopupRef.current &&
      !oauthPopupRef.current.closed &&
      typeof oauthPopupRef.current.close === 'function'
    ) {
      oauthPopupRef.current.close();
    }
    oauthPopupRef.current = null;
  }, []);

  const fetchMailStatus = useCallback(async () => {
    const options = await createAuthOptionsWithCsrf({ method: 'GET' });
    const response = await fetchWithAuth('/api/gdpr/mail/status', options);
    if (!response.ok) {
      return { connected: false } as GdprMailStatus;
    }
    return response.json() as Promise<GdprMailStatus>;
  }, []);

  const fetchMailConfig = useCallback(async () => {
    const options = await createAuthOptionsWithCsrf({ method: 'GET' });
    const response = await fetchWithAuth('/api/gdpr/mail/config', options);
    if (!response.ok) {
      throw new Error('Failed to load mail config');
    }
    return response.json() as Promise<GdprMailConfig>;
  }, []);

  const refreshMailState = useCallback(async () => {
    try {
      const [status, config] = await Promise.all([
        fetchMailStatus(),
        fetchMailConfig(),
      ]);
      setMailStatus(status);
      setMailConfig(config);
      setFormState(buildInitialForm(config));
    } catch (error) {
      logger.error('[GdprTab] Error refreshing GDPR mail state:', error);
      setMailStatus({ connected: false });
      setMailConfig(DEFAULT_CONFIG);
      setFormState(buildInitialForm(DEFAULT_CONFIG));
    } finally {
      setLoading(false);
    }
  }, [fetchMailConfig, fetchMailStatus]);

  useEffect(() => {
    void refreshMailState();
    return () => {
      cleanupOAuthFlow();
    };
  }, [cleanupOAuthFlow, refreshMailState]);

  const handleConnect = async () => {
    setConnecting(true);
    cleanupOAuthFlow();

    try {
      const options = await createAuthOptionsWithCsrf({ method: 'GET' });
      const response = await fetchWithAuth('/api/gdpr/mail/auth-url', options);
      if (response.ok) {
        const data = await response.json();
        const popup = window.open(
          data.authUrl,
          'gdpr-gmail-auth',
          'width=600,height=700,scrollbars=yes'
        );
        oauthPopupRef.current = popup;

        if (!popup) {
          toast.error(t('settings.gdpr.errors.connectFailed'));
          setConnecting(false);
          return;
        }

        const handleOAuthMessage = async (event: MessageEvent) => {
          if (event.origin !== trustedOrigin) {
            return;
          }

          const payload = event.data;
          if (!payload || typeof payload !== 'object') {
            return;
          }

          const callbackType = (payload as { type?: string }).type;
          if (callbackType !== 'gdpr-oauth-success' && callbackType !== 'gdpr-oauth-error') {
            return;
          }

          cleanupOAuthFlow();

          if (callbackType === 'gdpr-oauth-success') {
            toast.success(t('settings.gdpr.connected'));
          } else {
            const callbackError = (payload as { error?: string }).error;
            toast.error(callbackError || t('settings.gdpr.errors.connectFailed'));
          }

          setConnecting(false);
          await refreshMailState();
        };

        oauthMessageHandlerRef.current = handleOAuthMessage;
        window.addEventListener('message', handleOAuthMessage);

        let pollCount = 0;
        const maxPolls = 600;

        pollIntervalRef.current = setInterval(async () => {
          pollCount++;
          if (popup?.closed || pollCount >= maxPolls) {
            cleanupOAuthFlow();
            setConnecting(false);
            await refreshMailState();
          }
        }, 500);
      } else {
        const data = await response.json().catch(() => ({ error: '' }));
        toast.error(data.error || t('settings.gdpr.errors.connectFailed'));
      }
    } catch (error) {
      logger.error('[GdprTab] Error connecting Gmail:', error);
      toast.error(t('settings.gdpr.errors.connectFailed'));
      cleanupOAuthFlow();
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(t('settings.gdpr.confirmDisconnect'))) return;

    setDisconnecting(true);
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'POST' });
      const response = await fetchWithAuth('/api/gdpr/mail/disconnect', options);
      if (response.ok) {
        toast.success(t('settings.gdpr.disconnected'));
        await refreshMailState();
      } else {
        const data = await response.json().catch(() => ({ error: '' }));
        toast.error(data.error || t('settings.gdpr.errors.disconnectFailed'));
      }
    } catch (error) {
      logger.error('[GdprTab] Error disconnecting:', error);
      toast.error(t('settings.gdpr.errors.disconnectFailed'));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleTestSend = async () => {
    const testEmail = prompt(t('settings.gdpr.testEmailPrompt'));
    if (!testEmail) return;

    setTestingSend(true);
    try {
      const options = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          provider: formState.provider,
          smtpHost: formState.smtpHost,
          smtpPort: Number(formState.smtpPort),
          smtpSecure: formState.smtpSecure,
          smtpUser: formState.smtpUser,
          smtpPassword: formState.smtpPassword || undefined,
          clearSmtpPassword: formState.clearSmtpPassword,
          smtpFromName: formState.smtpFromName,
          smtpFromEmail: formState.smtpFromEmail,
          googleGdprRedirectUri: formState.googleGdprRedirectUri,
        })
      });
      const response = await fetchWithAuth('/api/gdpr/mail/test', options);
      if (response.ok) {
        toast.success(t('settings.gdpr.testSent', { email: testEmail }));
      } else {
        const data = await response.json();
        toast.error(data.error || t('settings.gdpr.errors.testFailed'));
      }
    } catch (error) {
      logger.error('[GdprTab] Error sending test:', error);
      toast.error(t('settings.gdpr.errors.testFailed'));
    } finally {
      setTestingSend(false);
    }
  };

  const handleConfigFieldChange = <K extends keyof GdprMailConfigForm>(field: K, value: GdprMailConfigForm[K]) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
      ...(field === 'smtpPassword' && value ? { clearSmtpPassword: false } : {}),
    }));
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const options = await createAuthOptionsWithCsrf({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: formState.provider,
          smtpHost: formState.smtpHost,
          smtpPort: Number(formState.smtpPort),
          smtpSecure: formState.smtpSecure,
          smtpUser: formState.smtpUser,
          smtpPassword: formState.smtpPassword || undefined,
          clearSmtpPassword: formState.clearSmtpPassword,
          smtpFromName: formState.smtpFromName,
          smtpFromEmail: formState.smtpFromEmail,
          googleGdprRedirectUri: formState.googleGdprRedirectUri,
        })
      });
      const response = await fetchWithAuth('/api/gdpr/mail/config', options);
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: '' }));
        toast.error(data.error || t('settings.gdpr.errors.saveConfigFailed'));
        return;
      }

      toast.success(t('settings.gdpr.configSaved'));
      await refreshMailState();
    } catch (error) {
      logger.error('[GdprTab] Error saving mail config:', error);
      toast.error(t('settings.gdpr.errors.saveConfigFailed'));
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-[#6246ea] dark:text-[#c9ccff]" />
      </div>
    );
  }

  const providerLabel = mailStatus?.effectiveProvider === 'smtp' ? 'SMTP' : 'Gmail';
  const canConnect = mailStatus?.allowConnect ?? true;
  const canDisconnect = mailStatus?.allowDisconnect ?? Boolean(mailStatus?.connected);
  const showSmtpFields = formState.provider === 'smtp' || formState.provider === 'auto';
  const gmailConfigWarning = !mailConfig.googleClientConfigured;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-[var(--cv-text)]">
          <ShieldCheckIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
          {t('settings.gdpr.title')}
        </h2>
        <p className="text-sm text-[var(--cv-muted)]">
          {t('settings.gdpr.description')}
        </p>
      </div>

      <div className="rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-[var(--cv-text)]">
              {t('settings.gdpr.mailSystemTitle')}
            </h3>
            <p className="mt-1 text-sm text-[var(--cv-muted)]">
              {t('settings.gdpr.mailSystemDescription')}
            </p>
          </div>
          <button
            onClick={handleSaveConfig}
            disabled={savingConfig}
            className="app-primary-action flex items-center gap-2 rounded-[9px] px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {savingConfig ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : null}
            {t('settings.gdpr.saveConfig')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--cv-text)]">{t('settings.gdpr.providerLabel')}</span>
            <select
              value={formState.provider}
              onChange={(event) => handleConfigFieldChange('provider', event.target.value as GdprMailConfigForm['provider'])}
              className="rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm text-[var(--cv-text)] dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
            >
              <option value="gmail">{t('settings.gdpr.providers.gmail')}</option>
              <option value="smtp">{t('settings.gdpr.providers.smtp')}</option>
              <option value="auto">{t('settings.gdpr.providers.auto')}</option>
            </select>
          </label>

          <div className="rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 dark:border-white/10 dark:bg-[#182235]">
            <p className="text-sm font-medium text-[var(--cv-text)]">{t('settings.gdpr.currentRuntimeLabel')}</p>
            <p className="text-sm text-[var(--cv-muted)]">
              {providerLabel} • {mailConfig.source === 'database' ? t('settings.gdpr.configSource.database') : t('settings.gdpr.configSource.environment')}
            </p>
          </div>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm font-medium text-[var(--cv-text)]">{t('settings.gdpr.gmailRedirectUriLabel')}</span>
            <input
              type="url"
              value={formState.googleGdprRedirectUri}
              onChange={(event) => handleConfigFieldChange('googleGdprRedirectUri', event.target.value)}
              className="rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm text-[var(--cv-text)] dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
            />
          </label>

          {showSmtpFields ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--cv-text)]">{t('settings.gdpr.smtp.host')}</span>
                <input
                  type="text"
                  value={formState.smtpHost}
                  onChange={(event) => handleConfigFieldChange('smtpHost', event.target.value)}
                  className="rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm text-[var(--cv-text)] dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--cv-text)]">{t('settings.gdpr.smtp.port')}</span>
                <input
                  type="number"
                  value={formState.smtpPort}
                  onChange={(event) => handleConfigFieldChange('smtpPort', Number(event.target.value))}
                  className="rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm text-[var(--cv-text)] dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--cv-text)]">{t('settings.gdpr.smtp.user')}</span>
                <input
                  type="text"
                  value={formState.smtpUser}
                  onChange={(event) => handleConfigFieldChange('smtpUser', event.target.value)}
                  className="rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm text-[var(--cv-text)] dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--cv-text)]">{t('settings.gdpr.smtp.password')}</span>
                <input
                  type="password"
                  value={formState.smtpPassword}
                  onChange={(event) => handleConfigFieldChange('smtpPassword', event.target.value)}
                  placeholder={mailConfig.hasSmtpPassword ? t('settings.gdpr.smtp.passwordPlaceholder') : ''}
                  className="rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm text-[var(--cv-text)] dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--cv-text)]">{t('settings.gdpr.smtp.fromName')}</span>
                <input
                  type="text"
                  value={formState.smtpFromName}
                  onChange={(event) => handleConfigFieldChange('smtpFromName', event.target.value)}
                  className="rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm text-[var(--cv-text)] dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--cv-text)]">{t('settings.gdpr.smtp.fromEmail')}</span>
                <input
                  type="email"
                  value={formState.smtpFromEmail}
                  onChange={(event) => handleConfigFieldChange('smtpFromEmail', event.target.value)}
                  className="rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-sm text-[var(--cv-text)] dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
                />
              </label>

              <div className="md:col-span-2 flex items-center gap-2 text-sm text-[var(--cv-text)]">
                <SettingsSwitch
                  checked={formState.smtpSecure}
                  onChange={(checked) => handleConfigFieldChange('smtpSecure', checked)}
                  label={t('settings.gdpr.smtp.secure')}
                />
                <span>{t('settings.gdpr.smtp.secure')}</span>
              </div>

              <div className="md:col-span-2 flex items-center gap-2 text-sm text-[var(--cv-text)]">
                <SettingsSwitch
                  checked={formState.clearSmtpPassword}
                  onChange={(checked) => handleConfigFieldChange('clearSmtpPassword', checked)}
                  label={t('settings.gdpr.smtp.clearPassword')}
                />
                <span>{t('settings.gdpr.smtp.clearPassword')}</span>
              </div>
            </>
          ) : null}
        </div>

        {gmailConfigWarning ? (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
            {t('settings.gdpr.gmailCredentialsWarning')}
          </p>
        ) : null}
      </div>

      <div className="rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--cv-text)]">
          <EnvelopeIcon className="h-4 w-4 text-[#6246ea] dark:text-[#c9ccff]" />
          {t('settings.gdpr.emailConfig')}
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-[13px] border border-[#dedbe8] bg-white p-4 dark:border-white/10 dark:bg-[#182235]">
            <div className="flex items-center gap-3">
              {mailStatus?.connected ? (
                <CheckCircleIcon className="h-7 w-7 text-green-500" />
              ) : (
                <XCircleIcon className="h-7 w-7 text-gray-400" />
              )}
              <div>
                <p className="font-medium text-[var(--cv-text)]">
                  {mailStatus?.connected
                    ? t('settings.gdpr.connected')
                    : t('settings.gdpr.notConnected')}
                </p>
                {mailStatus?.email ? (
                  <p className="text-sm text-[var(--cv-muted)]">
                    {mailStatus.email}
                  </p>
                ) : null}
                <p className="text-xs text-[var(--cv-muted)]">
                  {mailStatus?.managedByConfiguration
                    ? `${providerLabel} - ${t('settings.gdpr.configSource.server')}`
                    : providerLabel}
                </p>
                {mailStatus?.missingFields && mailStatus.missingFields.length > 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {t('settings.gdpr.incompleteConfig', { fields: mailStatus.missingFields.join(', ') })}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleTestSend}
                disabled={testingSend}
                className="app-button-secondary rounded-[9px] px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {testingSend ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  t('settings.gdpr.testSend')
                )}
              </button>
              {mailStatus?.effectiveProvider === 'gmail' && canDisconnect ? (
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="rounded-[9px] border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:bg-[#111827] dark:text-red-300 dark:hover:bg-red-500/10"
                >
                  {disconnecting ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    t('settings.gdpr.disconnect')
                  )}
                </button>
              ) : null}
              {mailStatus?.effectiveProvider === 'gmail' && !mailStatus?.connected && canConnect ? (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="app-primary-action flex items-center gap-2 rounded-[9px] px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {connecting ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <EnvelopeIcon className="w-4 h-4" />
                  )}
                  {t('settings.gdpr.connectGmail')}
                </button>
              ) : null}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-[13px] border border-[#dedbe8] bg-white p-4 dark:border-white/10 dark:bg-[#182235]"
          >
            <h4 className="mb-2 font-semibold text-[var(--cv-text)]">
              {t('settings.gdpr.infoTitle')}
            </h4>
            <ul className="list-inside list-disc space-y-1 text-sm text-[var(--cv-muted)]">
              <li>{t('settings.gdpr.info1')}</li>
              <li>{t('settings.gdpr.info2')}</li>
              <li>{t('settings.gdpr.info3')}</li>
            </ul>
          </motion.div>
        </div>
      </div>

      <div className="rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-4 dark:border-white/10 dark:bg-[#111827]">
        <h3 className="mb-4 text-sm font-semibold text-[var(--cv-text)]">
          {t('settings.gdpr.consentSettings')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-[13px] border border-[#dedbe8] bg-white p-4 dark:border-white/10 dark:bg-[#182235]">
            <p className="text-sm text-[var(--cv-muted)]">{t('settings.gdpr.tokenExpiry')}</p>
            <p className="text-xl font-bold text-[var(--cv-text)]">14 {t('settings.gdpr.days')}</p>
          </div>
          <div className="rounded-[13px] border border-[#dedbe8] bg-white p-4 dark:border-white/10 dark:bg-[#182235]">
            <p className="text-sm text-[var(--cv-muted)]">{t('settings.gdpr.retention')}</p>
            <p className="text-xl font-bold text-[var(--cv-text)]">2 {t('settings.gdpr.years')}</p>
          </div>
          <div className="rounded-[13px] border border-[#dedbe8] bg-white p-4 dark:border-white/10 dark:bg-[#182235]">
            <p className="text-sm text-[var(--cv-muted)]">{t('settings.gdpr.reminder')}</p>
            <p className="text-xl font-bold text-[var(--cv-text)]">7 {t('settings.gdpr.days')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GdprTab;
