import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheckIcon, ShieldExclamationIcon, KeyIcon, TrashIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import TwoFactorSetup from './TwoFactorSetup';
import { useAuthFetch } from '../hooks/useAuthFetch';
import logger from '../utils/logger.frontend';

interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: string | null;
  backupCodesRemaining: number;
}

const compactInputClassName = 'mb-4 w-full rounded-[13px] border border-[#e4e4e7] bg-white px-4 py-3 text-center font-mono text-2xl tracking-widest text-gray-900 focus:border-[#6b4eff] focus:outline-none focus:ring-2 focus:ring-[#6b4eff]/25 dark:border-white/10 dark:bg-[#111827] dark:text-gray-100';
const compactSecondaryButtonClassName = 'flex-1 rounded-[13px] border border-[#e4e4e7] bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-[#f8f8f7] dark:border-white/10 dark:bg-[#111827] dark:text-gray-300 dark:hover:bg-[#182235]';

export default function TwoFactorSettings() {
  const { t } = useTranslation();
  const { authGet, authPost } = useAuthFetch();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [regenerateCode, setRegenerateCode] = useState('');
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await authGet('/api/2fa/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      logger.error('[2FA] Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  }, [authGet]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleDisable = async () => {
    if (!disableCode) {
      toast.error('Entrez votre code 2FA');
      return;
    }

    setActionLoading(true);
    try {
      const response = await authPost('/api/2fa/disable', { code: disableCode });

      const data = await response.json();

      if (response.ok) {
        toast.success('2FA désactivé');
        setShowDisableModal(false);
        setDisableCode('');
        fetchStatus();
      } else {
        toast.error(data.message || 'Code invalide');
      }
    } catch {
      toast.error('Erreur lors de la désactivation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!regenerateCode) {
      toast.error('Entrez votre code 2FA');
      return;
    }

    setActionLoading(true);
    try {
      const response = await authPost('/api/2fa/backup-codes/regenerate', { code: regenerateCode });

      const data = await response.json();

      if (response.ok) {
        setNewBackupCodes(data.backupCodes);
        setRegenerateCode('');
        fetchStatus();
      } else {
        toast.error(data.message || 'Code invalide');
      }
    } catch {
      toast.error('Erreur lors de la régénération');
    } finally {
      setActionLoading(false);
    }
  };

  const copyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(newBackupCodes.join('\n'));
      toast.success('Codes copiés !');
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse rounded-[13px] bg-[#f8f8f7] p-6 dark:bg-[#182235]">
        <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-2/3"></div>
      </div>
    );
  }

  return (
    <div className="section-shell rounded-[13px] p-6">
      <div className="flex items-center gap-3 mb-4">
        <ShieldCheckIcon className="h-6 w-6 text-[#6b4eff] dark:text-[#c9ccff]" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('twoFactor.title')}
        </h3>
      </div>

      {/* OAuth notice */}
      <div className="mb-4 flex items-start gap-2 rounded-[13px] border border-[#e4e4e7] bg-[#f8f8f7] p-3 dark:border-white/10 dark:bg-[#182235]">
        <InformationCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#6b4eff] dark:text-[#c9ccff]" />
        <p className="text-sm text-slate-700 dark:text-slate-200">
          {t('twoFactor.loginOnlyNotice')}
        </p>
      </div>

      {status?.enabled ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <ShieldCheckIcon className="h-5 w-5" />
            <span className="font-medium">2FA activé</span>
          </div>
          
          {status.enabledAt && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Activé le {new Date(status.enabledAt).toLocaleDateString('fr-FR')}
            </p>
          )}

          <div className="flex items-center gap-2 text-sm">
            <KeyIcon className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-300">
              {status.backupCodesRemaining} codes de secours restants
            </span>
            {status.backupCodesRemaining <= 2 && (
              <span className="text-yellow-600 dark:text-yellow-400 text-xs">
                (Pensez à les régénérer)
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <button
              onClick={() => setShowRegenerateModal(true)}
              className="flex items-center gap-2 rounded-[13px] border border-[#e4e4e7] bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-[#f8f8f7] dark:border-white/10 dark:bg-[#111827] dark:text-gray-300 dark:hover:bg-[#182235]"
            >
              <KeyIcon className="h-4 w-4" />
              Régénérer les codes de secours
            </button>
            <button
              onClick={() => setShowDisableModal(true)}
              className="px-4 py-2 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
              <TrashIcon className="h-4 w-4" />
              Désactiver 2FA
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <ShieldExclamationIcon className="h-5 w-5" />
            <span>2FA non activé</span>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Protégez votre compte avec l'authentification à deux facteurs. 
            Vous aurez besoin d'une application comme Google Authenticator ou Authy.
          </p>

          <button
            onClick={() => setShowSetup(true)}
            className="flex items-center gap-2 rounded-[13px] bg-[#6b4eff] px-4 py-2 text-white transition-colors hover:bg-[#5b3eee]"
          >
            <ShieldCheckIcon className="h-5 w-5" />
            Activer 2FA
          </button>
        </div>
      )}

      {/* Setup Modal */}
      {showSetup && (
        <TwoFactorSetup
          onClose={() => setShowSetup(false)}
          onSuccess={() => {
            setShowSetup(false);
            fetchStatus();
          }}
        />
      )}

      {/* Disable Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-[13px] bg-white p-6 shadow-2xl dark:bg-[#182235]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Désactiver 2FA
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Entrez votre code 2FA actuel pour confirmer la désactivation.
            </p>
            <input
              type="text"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className={compactInputClassName}
              maxLength={6}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDisableModal(false);
                  setDisableCode('');
                }}
                className={compactSecondaryButtonClassName}
              >
                Annuler
              </button>
              <button
                onClick={handleDisable}
                disabled={actionLoading || disableCode.length !== 6}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Désactivation...' : 'Désactiver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Modal */}
      {showRegenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-[13px] bg-white p-6 shadow-2xl dark:bg-[#182235]">
            {newBackupCodes.length === 0 ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Régénérer les codes de secours
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Entrez votre code 2FA pour générer de nouveaux codes de secours.
                  Les anciens codes seront invalidés.
                </p>
                <input
                  type="text"
                  value={regenerateCode}
                  onChange={(e) => setRegenerateCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className={compactInputClassName}
                  maxLength={6}
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowRegenerateModal(false);
                      setRegenerateCode('');
                    }}
                    className={compactSecondaryButtonClassName}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={actionLoading || regenerateCode.length !== 6}
                    className="flex-1 rounded-[13px] bg-[#6b4eff] px-4 py-2 text-white transition-colors hover:bg-[#5b3eee] disabled:opacity-50"
                  >
                    {actionLoading ? 'Génération...' : 'Régénérer'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Nouveaux codes de secours
                </h3>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                  <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                    ⚠️ Sauvegardez ces codes maintenant. Ils ne seront plus affichés.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {newBackupCodes.map((code, index) => (
                    <code 
                      key={index}
                      className="rounded border border-[#e4e4e7] bg-[#f8f8f7] px-3 py-2 text-center font-mono text-sm dark:border-white/10 dark:bg-[#111827]"
                    >
                      {code}
                    </code>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={copyBackupCodes}
                    className={compactSecondaryButtonClassName}
                  >
                    Copier
                  </button>
                  <button
                    onClick={() => {
                      setShowRegenerateModal(false);
                      setNewBackupCodes([]);
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    J'ai sauvegardé
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
