/**
 * GDPR Settings Tab
 * Configuration for GDPR consent email sending via Gmail
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  EnvelopeIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ArrowPathIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { fetchWithAuth, createAuthOptionsWithCsrf } from '../../utils/apiInterceptor';
import toast from 'react-hot-toast';
import logger from '../../utils/logger.frontend';

interface GdprTabProps {
  t: (key: string, options?: Record<string, unknown>) => string;
}

interface GdprMailStatus {
  connected: boolean;
  email?: string;
  provider?: string;
  needsReauth?: boolean;
}

export const GdprTab = ({ t }: GdprTabProps): JSX.Element => {
  const [mailStatus, setMailStatus] = useState<GdprMailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testingSend, setTestingSend] = useState(false);

  useEffect(() => {
    fetchMailStatus();
  }, []);

  const fetchMailStatus = async () => {
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'GET' });
      const response = await fetchWithAuth('/api/gdpr/mail/status', options);
      if (response.ok) {
        const data = await response.json();
        setMailStatus(data);
      } else {
        setMailStatus({ connected: false });
      }
    } catch (error) {
      logger.error('[GdprTab] Error fetching mail status:', error);
      setMailStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    let pollInterval: NodeJS.Timeout | null = null;
    
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'GET' });
      const response = await fetchWithAuth('/api/gdpr/mail/auth-url', options);
      if (response.ok) {
        const data = await response.json();
        // Open OAuth popup
        const popup = window.open(
          data.authUrl,
          'gdpr-gmail-auth',
          'width=600,height=700,scrollbars=yes'
        );
        
        // Poll for completion with timeout (max 5 minutes)
        let pollCount = 0;
        const maxPolls = 600; // 5 minutes at 500ms intervals
        
        pollInterval = setInterval(async () => {
          pollCount++;
          if (popup?.closed || pollCount >= maxPolls) {
            if (pollInterval) clearInterval(pollInterval);
            setConnecting(false);
            // Refresh status
            await fetchMailStatus();
          }
        }, 500);
      } else {
        toast.error(t('settings.gdpr.errors.connectFailed'));
      }
    } catch (error) {
      logger.error('[GdprTab] Error connecting Gmail:', error);
      toast.error(t('settings.gdpr.errors.connectFailed'));
      if (pollInterval) clearInterval(pollInterval);
    } finally {
      // Note: setConnecting(false) is handled in the interval callback
      // to avoid premature state change
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(t('settings.gdpr.confirmDisconnect'))) return;
    
    setDisconnecting(true);
    try {
      const options = await createAuthOptionsWithCsrf({ method: 'POST' });
      const response = await fetchWithAuth('/api/gdpr/mail/disconnect', options);
      if (response.ok) {
        setMailStatus({ connected: false });
        toast.success(t('settings.gdpr.disconnected'));
      } else {
        toast.error(t('settings.gdpr.errors.disconnectFailed'));
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
        body: JSON.stringify({ email: testEmail })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <ShieldCheckIcon className="w-6 h-6 text-green-600" />
          {t('settings.gdpr.title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('settings.gdpr.description')}
        </p>
      </div>

      {/* Gmail Connection Status */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <EnvelopeIcon className="w-5 h-5" />
          {t('settings.gdpr.emailConfig')}
        </h3>

        <div className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-3">
              {mailStatus?.connected ? (
                <CheckCircleIcon className="w-8 h-8 text-green-500" />
              ) : (
                <XCircleIcon className="w-8 h-8 text-gray-400" />
              )}
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {mailStatus?.connected 
                    ? t('settings.gdpr.connected') 
                    : t('settings.gdpr.notConnected')}
                </p>
                {mailStatus?.email && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {mailStatus.email}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {mailStatus?.connected ? (
                <>
                  <button
                    onClick={handleTestSend}
                    disabled={testingSend}
                    className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50"
                  >
                    {testingSend ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      t('settings.gdpr.testSend')
                    )}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-600 dark:border-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                  >
                    {disconnecting ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      t('settings.gdpr.disconnect')
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {connecting ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <EnvelopeIcon className="w-4 h-4" />
                  )}
                  {t('settings.gdpr.connectGmail')}
                </button>
              )}
            </div>
          </div>

          {/* Info Box */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
              {t('settings.gdpr.infoTitle')}
            </h4>
            <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
              <li>{t('settings.gdpr.info1')}</li>
              <li>{t('settings.gdpr.info2')}</li>
              <li>{t('settings.gdpr.info3')}</li>
            </ul>
          </motion.div>
        </div>
      </div>

      {/* Consent Settings */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          {t('settings.gdpr.consentSettings')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.gdpr.tokenExpiry')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">14 {t('settings.gdpr.days')}</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.gdpr.retention')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">2 {t('settings.gdpr.years')}</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.gdpr.reminder')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">7 {t('settings.gdpr.days')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GdprTab;
