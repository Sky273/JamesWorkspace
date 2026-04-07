import React, { useState } from 'react';
import { ShieldCheckIcon, KeyIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { authService, User } from '../services/authService';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import AuthPageShell from './AuthPageShell';

interface TwoFactorVerifyProps {
  userId: string;
  email: string;
  password: string;
  onSuccess: (user: User) => void;
  onCancel: () => void;
}

export default function TwoFactorVerify({ userId: _userId, email, password, onSuccess, onCancel }: TwoFactorVerifyProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleVerify = async () => {
    if (code.length < 6) {
      setError('Entrez un code a 6 chiffres ou un code de secours');
      setStatus('error');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('loading');
    toast.loading('Verification en cours...', { id: '2fa-verify' });

    try {
      const result = await authService.signIn(email, password, code);

      if (result && 'id' in result) {
        setStatus('success');
        toast.success('Connexion reussie !', { id: '2fa-verify' });
        setTimeout(() => {
          onSuccess(result as User);
        }, 500);
      } else {
        setError('Reponse inattendue du serveur');
        setStatus('error');
        toast.error('Reponse inattendue du serveur', { id: '2fa-verify' });
      }
    } catch (err) {
      logger.error('[2FA] Verification error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Erreur de connexion au serveur';
      setError(errorMsg);
      setStatus('error');
      toast.error(errorMsg, { id: '2fa-verify' });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length >= 6) {
      handleVerify();
    }
  };

  return (
    <AuthPageShell
      title="Verification 2FA"
      subtitle="Entrez le code de votre application d'authentification"
      asideTitle="Verification complementaire"
      asideBody="Confirmez votre connexion avec votre application d'authentification ou un code de secours."
      asidePoints={['Code a 6 chiffres', 'Code de secours accepte', 'Session securisee']}
      backLabel="Retour"
    >
      <div className="space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <ShieldCheckIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="code" className="sr-only">
              Code 2FA
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => {
                const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                setCode(value.slice(0, 8));
                setError('');
              }}
              onKeyDown={handleKeyPress}
              placeholder="000000"
              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-4 text-center font-mono text-3xl tracking-widest text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              maxLength={8}
              autoFocus
              autoComplete="one-time-code"
            />
            <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
              Ou utilisez un code de secours (8 caracteres)
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-center text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
          ) : null}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-2xl border border-gray-300 px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleVerify}
              disabled={loading || code.length < 6}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 transition-colors ${
                status === 'success'
                  ? 'bg-green-600 text-white'
                  : status === 'error'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {loading ? (
                <>
                  <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verification...
                </>
              ) : status === 'success' ? (
                <>
                  <CheckCircleIcon className="h-5 w-5" />
                  Connecte !
                </>
              ) : (
                <>
                  <KeyIcon className="h-5 w-5" />
                  Verifier
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </AuthPageShell>
  );
}
