/**
 * ConsentForm Component
 * Form for collecting GDPR consent information during resume upload
 * Allows selection of profile type and candidate details
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    UserIcon, 
    EnvelopeIcon, 
    BuildingOfficeIcon,
    UserGroupIcon,
    PaperAirplaneIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

export type ProfileType = 'employee' | 'external';

export interface ConsentFormData {
    profileType: ProfileType;
    candidateName: string;
    candidateEmail: string;
}

interface ConsentFormProps {
    initialName?: string;
    onSubmit: (data: ConsentFormData) => Promise<void>;
    onSkip?: () => void;
    loading?: boolean;
}

const ConsentForm = ({ 
    initialName = '', 
    onSubmit, 
    onSkip,
    loading = false 
}: ConsentFormProps): JSX.Element => {
    const { t } = useTranslation();
    
    const [profileType, setProfileType] = useState<ProfileType>('external');
    const [candidateName, setCandidateName] = useState(initialName);
    const [candidateEmail, setCandidateEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!candidateName.trim()) {
            setError(t('consent.form.errors.nameRequired'));
            return;
        }

        if (profileType === 'external' && !candidateEmail.trim()) {
            setError(t('consent.form.errors.emailRequired'));
            return;
        }

        if (profileType === 'external' && candidateEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(candidateEmail)) {
                setError(t('consent.form.errors.emailInvalid'));
                return;
            }
        }

        try {
            await onSubmit({
                profileType,
                candidateName: candidateName.trim(),
                candidateEmail: candidateEmail.trim()
            });
            setSubmitted(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('consent.form.errors.submitFailed'));
        }
    };

    if (submitted) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center"
            >
                <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                    {profileType === 'employee' 
                        ? t('consent.form.success.employee')
                        : t('consent.form.success.external')
                    }
                </h3>
                <p className="text-sm text-green-600 dark:text-green-400">
                    {profileType === 'external' && t('consent.form.success.emailSent', { email: candidateEmail })}
                </p>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
        >
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <UserIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {t('consent.form.title')}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('consent.form.subtitle')}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Profile Type Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('consent.form.profileType.label')}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setProfileType('employee')}
                            className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                                profileType === 'employee'
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                        >
                            <BuildingOfficeIcon className={`h-5 w-5 ${
                                profileType === 'employee' 
                                    ? 'text-indigo-600 dark:text-indigo-400' 
                                    : 'text-gray-400'
                            }`} />
                            <span className={`text-sm font-medium ${
                                profileType === 'employee'
                                    ? 'text-indigo-700 dark:text-indigo-300'
                                    : 'text-gray-600 dark:text-gray-400'
                            }`}>
                                {t('consent.form.profileType.employee')}
                            </span>
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => setProfileType('external')}
                            className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                                profileType === 'external'
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                        >
                            <UserGroupIcon className={`h-5 w-5 ${
                                profileType === 'external' 
                                    ? 'text-indigo-600 dark:text-indigo-400' 
                                    : 'text-gray-400'
                            }`} />
                            <span className={`text-sm font-medium ${
                                profileType === 'external'
                                    ? 'text-indigo-700 dark:text-indigo-300'
                                    : 'text-gray-600 dark:text-gray-400'
                            }`}>
                                {t('consent.form.profileType.external')}
                            </span>
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {profileType === 'employee' 
                            ? t('consent.form.profileType.employeeHint')
                            : t('consent.form.profileType.externalHint')
                        }
                    </p>
                </div>

                {/* Candidate Name */}
                <div>
                    <label htmlFor="candidateName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('consent.form.candidateName.label')} *
                    </label>
                    <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            id="candidateName"
                            value={candidateName}
                            onChange={(e) => setCandidateName(e.target.value)}
                            placeholder={t('consent.form.candidateName.placeholder')}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            disabled={loading}
                        />
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('consent.form.candidateName.hint')}
                    </p>
                </div>

                {/* Candidate Email (only for external) */}
                {profileType === 'external' && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <label htmlFor="candidateEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('consent.form.candidateEmail.label')} *
                        </label>
                        <div className="relative">
                            <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="email"
                                id="candidateEmail"
                                value={candidateEmail}
                                onChange={(e) => setCandidateEmail(e.target.value)}
                                placeholder={t('consent.form.candidateEmail.placeholder')}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                disabled={loading}
                            />
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t('consent.form.candidateEmail.hint')}
                        </p>
                    </motion.div>
                )}

                {/* Error Message */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                    >
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </motion.div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition-colors"
                    >
                        {loading ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                {t('common.loading')}
                            </>
                        ) : (
                            <>
                                <PaperAirplaneIcon className="h-4 w-4" />
                                {profileType === 'external' 
                                    ? t('consent.form.submit.sendRequest')
                                    : t('consent.form.submit.confirm')
                                }
                            </>
                        )}
                    </button>
                    
                    {onSkip && (
                        <button
                            type="button"
                            onClick={onSkip}
                            disabled={loading}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors"
                        >
                            {t('consent.form.skip')}
                        </button>
                    )}
                </div>

                {/* GDPR Notice */}
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-2">
                    {t('consent.form.gdprNotice')}
                </p>
            </form>
        </motion.div>
    );
};

export default ConsentForm;
