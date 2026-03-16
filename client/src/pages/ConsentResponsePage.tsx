/**
 * ConsentResponsePage Component
 * Public page for candidates to respond to GDPR consent requests
 * Accessible without authentication via unique token
 */

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    ShieldCheckIcon,
    XCircleIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    ClockIcon
} from '@heroicons/react/24/outline';

interface ConsentInfo {
    candidateName: string;
    firmName: string;
    firmLogo?: string;
}

type PageState = 'loading' | 'ready' | 'submitting' | 'success' | 'error';

const ConsentResponsePage = (): JSX.Element => {
    const { token } = useParams<{ token: string }>();
    const [searchParams] = useSearchParams();
    const { t } = useTranslation();

    const [pageState, setPageState] = useState<PageState>('loading');
    const [consentInfo, setConsentInfo] = useState<ConsentInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [accepted, setAccepted] = useState<boolean | null>(null);

    // Check for action in URL (from email links)
    const actionFromUrl = searchParams.get('action');

    useEffect(() => {
        const fetchConsentInfo = async () => {
            if (!token) {
                setError(t('consent.response.errors.noToken'));
                setPageState('error');
                return;
            }

            try {
                const response = await fetch(`/api/consent/respond/${token}`);
                const data = await response.json();

                if (!response.ok) {
                    if (data.code === 'TOKEN_EXPIRED') {
                        setError(t('consent.response.errors.expired'));
                    } else if (data.code === 'ALREADY_PROCESSED') {
                        setError(t('consent.response.errors.alreadyProcessed'));
                    } else if (data.code === 'INVALID_TOKEN') {
                        setError(t('consent.response.errors.invalid'));
                    } else {
                        setError(data.error || t('consent.response.errors.generic'));
                    }
                    setPageState('error');
                    return;
                }

                setConsentInfo(data);
                setPageState('ready');

                // Auto-submit if action is in URL
                if (actionFromUrl === 'accept' || actionFromUrl === 'refuse') {
                    handleSubmit(actionFromUrl === 'accept');
                }
            } catch {
                setError(t('consent.response.errors.network'));
                setPageState('error');
            }
        };

        fetchConsentInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, t]);

    const handleSubmit = async (accept: boolean) => {
        if (!token) return;

        setPageState('submitting');
        setAccepted(accept);

        try {
            const response = await fetch(`/api/consent/respond/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: accept ? 'accept' : 'refuse' })
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.code === 'TOKEN_EXPIRED') {
                    setError(t('consent.response.errors.expired'));
                } else if (data.code === 'ALREADY_PROCESSED') {
                    setError(t('consent.response.errors.alreadyProcessed'));
                } else {
                    setError(data.error || t('consent.response.errors.submitFailed'));
                }
                setPageState('error');
                return;
            }

            setPageState('success');
        } catch {
            setError(t('consent.response.errors.network'));
            setPageState('error');
        }
    };

    // Loading state
    if (pageState === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">{t('common.loading')}</p>
                </div>
            </div>
        );
    }

    // Error state
    if (pageState === 'error') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center"
                >
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">
                        {t('consent.response.error.title')}
                    </h1>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <a
                        href="/"
                        className="inline-block px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                    >
                        {t('consent.response.backToHome')}
                    </a>
                </motion.div>
            </div>
        );
    }

    // Success state
    if (pageState === 'success') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center"
                >
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                        accepted ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                        {accepted ? (
                            <CheckCircleIcon className="h-8 w-8 text-green-600" />
                        ) : (
                            <XCircleIcon className="h-8 w-8 text-gray-600" />
                        )}
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">
                        {accepted 
                            ? t('consent.response.success.acceptedTitle')
                            : t('consent.response.success.refusedTitle')
                        }
                    </h1>
                    <p className="text-gray-600 mb-6">
                        {accepted 
                            ? t('consent.response.success.acceptedMessage')
                            : t('consent.response.success.refusedMessage')
                        }
                    </p>
                    {accepted && (
                        <p className="text-sm text-gray-500 mb-6">
                            {t('consent.response.success.retentionInfo')}
                        </p>
                    )}
                </motion.div>
            </div>
        );
    }

    // Ready state - show consent form
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-lg w-full bg-white rounded-xl shadow-lg overflow-hidden"
            >
                {/* Header with firm logo */}
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-6 text-center">
                    {consentInfo?.firmLogo ? (
                        <img 
                            src={consentInfo.firmLogo} 
                            alt={consentInfo.firmName}
                            className="h-12 mx-auto mb-2 object-contain"
                        />
                    ) : (
                        <h2 className="text-2xl font-bold text-white">
                            {consentInfo?.firmName}
                        </h2>
                    )}
                </div>

                {/* Content */}
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <ShieldCheckIcon className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">
                                {t('consent.response.title')}
                            </h1>
                            <p className="text-sm text-gray-500">
                                {t('consent.response.subtitle')}
                            </p>
                        </div>
                    </div>

                    <p className="text-gray-700 mb-4">
                        {t('consent.response.greeting', { name: consentInfo?.candidateName })}
                    </p>

                    <p className="text-gray-600 mb-4">
                        {t('consent.response.message', { firm: consentInfo?.firmName })}
                    </p>

                    {/* Why we process section */}
                    <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-4">
                        <h3 className="font-medium text-blue-900 mb-2">
                            📋 {t('consent.response.whyWeProcess')}
                        </h3>
                        <ul className="text-sm text-gray-700 space-y-1">
                            <li>• {t('consent.response.whyItem1')}</li>
                            <li>• {t('consent.response.whyItem2')}</li>
                            <li>• {t('consent.response.whyItem3')}</li>
                            <li>• {t('consent.response.whyItem4')}</li>
                        </ul>
                        <p className="text-xs text-gray-500 mt-2 italic">
                            {t('consent.response.automatedProcessing')}
                        </p>
                    </div>

                    {/* Data concerned section */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <h3 className="font-medium text-gray-900 mb-2">
                            📁 {t('consent.response.whatWeStore')}
                        </h3>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li>• {t('consent.response.storeItem1')}</li>
                            <li>• {t('consent.response.storeItem2')}</li>
                            <li>• {t('consent.response.storeItem3')}</li>
                        </ul>
                    </div>

                    {/* Retention period */}
                    <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-2">
                            <ClockIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800">
                                ⏱️ {t('consent.response.retentionPeriod')}
                            </p>
                        </div>
                    </div>

                    {/* Rights section */}
                    <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4 mb-6">
                        <p className="text-sm text-green-800">
                            ✅ {t('consent.response.rights')}
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => handleSubmit(true)}
                            disabled={pageState === 'submitting'}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors"
                        >
                            <CheckCircleIcon className="h-5 w-5" />
                            {t('consent.response.accept')}
                        </button>
                        <button
                            onClick={() => handleSubmit(false)}
                            disabled={pageState === 'submitting'}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 rounded-lg font-medium transition-colors"
                        >
                            <XCircleIcon className="h-5 w-5" />
                            {t('consent.response.refuse')}
                        </button>
                    </div>

                    {pageState === 'submitting' && (
                        <div className="mt-4 text-center">
                            <div className="h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-8 py-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400 text-center">
                        {t('consent.response.footer')}
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default ConsentResponsePage;
