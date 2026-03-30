import { EnvelopeIcon } from '@heroicons/react/24/outline';
import type { TranslateFn } from './types';

interface SendEmailConnectStepProps {
  isGoogleSsoUser: boolean;
  onConnectGmail: () => void;
  onReconnectApp: () => void;
  t: TranslateFn;
}

export default function SendEmailConnectStep({
  isGoogleSsoUser,
  onConnectGmail,
  onReconnectApp,
  t,
}: SendEmailConnectStepProps): JSX.Element {
  return (
    <div className="text-center py-6">
      <EnvelopeIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
      <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('mail.modal.connectTitle')}</h4>
      <p className="text-gray-500 dark:text-gray-400 mb-6">{t('mail.modal.connectDescription')}</p>

      {isGoogleSsoUser ? (
        <div className="space-y-4">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            {t('mail.modal.ssoReconnectMessage', { defaultValue: "Votre session Gmail a expiré. Veuillez vous reconnecter à l'application pour réactiver l'envoi d'emails." })}
          </p>
          <button
            onClick={onReconnectApp}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            {t('mail.modal.reconnectApp', { defaultValue: 'Se reconnecter' })}
          </button>
        </div>
      ) : (
        <button
          onClick={onConnectGmail}
          className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z"/>
          </svg>
          {t('mail.modal.connectGmail')}
        </button>
      )}
    </div>
  );
}
