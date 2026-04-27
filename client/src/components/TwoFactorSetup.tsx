import React, { useState } from 'react';
import { ShieldCheckIcon, KeyIcon, ClipboardDocumentIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuthFetch } from '../hooks/useAuthFetch';

interface TwoFactorSetupProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface SetupData {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

const compactPrimaryButtonClassName = 'flex w-full items-center justify-center gap-2 rounded-[13px] bg-[#6b4eff] px-4 py-3 text-white transition-colors hover:bg-[#5b3eee] disabled:opacity-50';
const compactSecondaryButtonClassName = 'flex-1 rounded-[13px] border border-[#e4e4e7] bg-white px-4 py-3 text-gray-700 transition-colors hover:bg-[#f8f8f7] dark:border-white/10 dark:bg-[#111827] dark:text-gray-300 dark:hover:bg-[#182235]';
const compactCodeInputClassName = 'w-full rounded-[13px] border border-[#e4e4e7] bg-white px-4 py-4 text-center font-mono text-3xl tracking-widest text-gray-900 focus:border-[#6b4eff] focus:outline-none focus:ring-2 focus:ring-[#6b4eff]/25 dark:border-white/10 dark:bg-[#111827] dark:text-gray-100';

export default function TwoFactorSetup({ onClose, onSuccess }: TwoFactorSetupProps) {
  const { t: _t } = useTranslation();
  const { authPost } = useAuthFetch();
  const [step, setStep] = useState<'intro' | 'setup' | 'verify' | 'backup'>('intro');
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    try {
      const response = await authPost('/api/2fa/setup', {});
      
      if (!response.ok) {
        throw new Error('Failed to start 2FA setup');
      }
      
      const data = await response.json();
      setSetupData(data);
      setStep('setup');
    } catch {
      toast.error('Erreur lors de l\'initialisation du 2FA');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Le code doit contenir 6 chiffres');
      return;
    }
    
    setLoading(true);
    try {
      const response = await authPost('/api/2fa/verify', { code: verificationCode });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.message || 'Code invalide');
        return;
      }
      
      toast.success('2FA activé avec succès !');
      setStep('backup');
    } catch {
      toast.error('Erreur lors de la vérification');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'secret' | 'backup') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'secret') {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      } else {
        setCopiedBackup(true);
        setTimeout(() => setCopiedBackup(false), 2000);
      }
      toast.success('Copié !');
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  const handleComplete = () => {
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[13px] bg-white shadow-2xl dark:bg-[#182235]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="h-6 w-6 text-[#6b4eff] dark:text-[#c9ccff]" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Authentification à deux facteurs
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Step: Intro */}
          {step === 'intro' && (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                L'authentification à deux facteurs (2FA) ajoute une couche de sécurité supplémentaire à votre compte.
              </p>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                Vous aurez besoin d'une application d'authentification comme :
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 text-sm">
                <li>Google Authenticator</li>
                <li>Microsoft Authenticator</li>
                <li>Authy</li>
              </ul>
              <button
                onClick={startSetup}
                disabled={loading}
                className={`${compactPrimaryButtonClassName} mt-4`}
              >
                {loading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <>
                    <KeyIcon className="h-5 w-5" />
                    Configurer 2FA
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step: Setup - QR Code */}
          {step === 'setup' && setupData && (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-300 text-center">
                Scannez ce QR code avec votre application d'authentification
              </p>
              
              <div className="flex justify-center">
                <img 
                  src={setupData.qrCodeDataUrl} 
                  alt="QR Code 2FA" 
                  className="w-48 h-48 border-4 border-white rounded-lg shadow-lg"
                />
              </div>
              
              <div className="rounded-[13px] bg-[#f8f8f7] p-3 dark:bg-[#111827]">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Ou entrez ce code manuellement :
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded border border-[#e4e4e7] bg-white px-3 py-2 font-mono text-sm dark:border-white/10 dark:bg-[#182235]">
                    {setupData.secret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(setupData.secret, 'secret')}
                    className="p-2 text-gray-500 transition-colors hover:text-[#6b4eff] dark:hover:text-[#c9ccff]"
                  >
                    {copiedSecret ? (
                      <CheckIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <ClipboardDocumentIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              
              <button
                onClick={() => setStep('verify')}
                className={compactPrimaryButtonClassName}
              >
                Suivant
              </button>
            </div>
          )}

          {/* Step: Verify */}
          {step === 'verify' && (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-300 text-center">
                Entrez le code à 6 chiffres affiché dans votre application
              </p>
              
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className={compactCodeInputClassName}
                maxLength={6}
                autoFocus
              />
              
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('setup')}
                  className={compactSecondaryButtonClassName}
                >
                  Retour
                </button>
                <button
                  onClick={verifyCode}
                  disabled={loading || verificationCode.length !== 6}
                  className="flex-1 rounded-[13px] bg-[#6b4eff] px-4 py-3 text-white transition-colors hover:bg-[#5b3eee] disabled:opacity-50"
                >
                  {loading ? 'Vérification...' : 'Vérifier'}
                </button>
              </div>
            </div>
          )}

          {/* Step: Backup Codes */}
          {step === 'backup' && setupData && (
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                  ⚠️ Sauvegardez ces codes de secours
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                  Si vous perdez l'accès à votre application d'authentification, vous pourrez utiliser ces codes pour vous connecter.
                </p>
              </div>
              
              <div className="rounded-[13px] bg-[#f8f8f7] p-4 dark:bg-[#111827]">
                <div className="grid grid-cols-2 gap-2">
                  {setupData.backupCodes.map((code, index) => (
                    <code 
                      key={index}
                      className="rounded border border-[#e4e4e7] bg-white px-3 py-2 text-center font-mono text-sm dark:border-white/10 dark:bg-[#182235]"
                    >
                      {code}
                    </code>
                  ))}
                </div>
                <button
                  onClick={() => copyToClipboard(setupData.backupCodes.join('\n'), 'backup')}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-[13px] border border-[#e4e4e7] bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-[#f8f8f7] dark:border-white/10 dark:bg-[#182235] dark:text-gray-300 dark:hover:bg-[#263052]"
                >
                  {copiedBackup ? (
                    <>
                      <CheckIcon className="h-5 w-5 text-green-500" />
                      Copié !
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="h-5 w-5" />
                      Copier tous les codes
                    </>
                  )}
                </button>
              </div>
              
              <button
                onClick={handleComplete}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                J'ai sauvegardé mes codes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
