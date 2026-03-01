import React, { useState } from 'react';
import { ShieldCheckIcon, KeyIcon, ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

interface TwoFactorVerifyProps {
  userId: string;
  email: string;
  password: string;
  onSuccess: (user: any) => void;
  onCancel: () => void;
}

export default function TwoFactorVerify({ userId, email, password, onSuccess, onCancel }: TwoFactorVerifyProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleVerify = async () => {
    if (code.length < 6) {
      setError('Entrez un code à 6 chiffres ou un code de secours');
      setStatus('error');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('loading');
    toast.loading('Vérification en cours...', { id: '2fa-verify' });

    try {
      const csrfToken = await authService.getCsrfToken();
      
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ email, password, totpCode: code })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Code 2FA invalide';
        setError(errorMsg);
        setStatus('error');
        toast.error(errorMsg, { id: '2fa-verify' });
        return;
      }

      if (data.user) {
        setStatus('success');
        toast.success('Connexion réussie !', { id: '2fa-verify' });
        // Small delay to show success state
        setTimeout(() => {
          onSuccess(data.user);
        }, 500);
      } else {
        setError('Réponse inattendue du serveur');
        setStatus('error');
        toast.error('Réponse inattendue du serveur', { id: '2fa-verify' });
      }
    } catch (err) {
      console.error('[2FA] Error:', err);
      const errorMsg = 'Erreur de connexion au serveur';
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <ShieldCheckIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">
            Vérification 2FA
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Entrez le code de votre application d'authentification
          </p>
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
              onKeyPress={handleKeyPress}
              placeholder="000000"
              className="w-full text-center text-3xl font-mono tracking-widest px-4 py-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={8}
              autoFocus
              autoComplete="one-time-code"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
              Ou utilisez un code de secours (8 caractères)
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-red-600 dark:text-red-400 text-sm text-center">
                {error}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleVerify}
              disabled={loading || code.length < 6}
              className={`flex-1 px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                status === 'success' 
                  ? 'bg-green-600 text-white' 
                  : status === 'error'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Vérification...
                </>
              ) : status === 'success' ? (
                <>
                  <CheckCircleIcon className="h-5 w-5" />
                  Connecté !
                </>
              ) : (
                <>
                  <KeyIcon className="h-5 w-5" />
                  Vérifier
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
