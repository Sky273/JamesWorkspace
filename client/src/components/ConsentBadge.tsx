/**
 * ConsentBadge Component
 * Displays GDPR consent status with relevant information
 */

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { 
    ShieldCheckIcon, 
    ClockIcon, 
    XCircleIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    InformationCircleIcon,
    ChevronDownIcon,
    ChevronUpIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

export type ConsentStatus = 'not_required' | 'pending_consent' | 'active' | 'refused' | 'expired' | 'purged' | 'error';

interface ConsentBadgeProps {
    status: ConsentStatus;
    profileType?: 'employee' | 'external';
    candidateName?: string;
    candidateEmail?: string;
    consentRequestedAt?: string | null;
    consentRespondedAt?: string | null;
    consentTokenExpiresAt?: string | null;
    retentionUntil?: string | null;
    onResend?: () => Promise<void>;
    compact?: boolean;
}

const ConsentBadge = ({
    status,
    profileType,
    candidateName,
    candidateEmail,
    consentRequestedAt,
    consentRespondedAt,
    consentTokenExpiresAt,
    retentionUntil,
    onResend,
    compact = false
}: ConsentBadgeProps): JSX.Element => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const [resending, setResending] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const badgeRef = useRef<HTMLDivElement>(null);

    const handleResend = async () => {
        if (!onResend || resending) return;
        setResending(true);
        try {
            await onResend();
        } finally {
            setResending(false);
        }
    };

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const getStatusConfig = () => {
        switch (status) {
            case 'not_required':
                return {
                    icon: ShieldCheckIcon,
                    bgColor: 'bg-gray-100 dark:bg-gray-700',
                    textColor: 'text-gray-600 dark:text-gray-400',
                    borderColor: 'border-gray-200 dark:border-gray-600',
                    label: t('consent.status.notRequired')
                };
            case 'pending_consent':
                return {
                    icon: ClockIcon,
                    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
                    textColor: 'text-amber-700 dark:text-amber-400',
                    borderColor: 'border-amber-200 dark:border-amber-700',
                    label: t('consent.status.pending')
                };
            case 'active':
                return {
                    icon: ShieldCheckIcon,
                    bgColor: 'bg-green-50 dark:bg-green-900/20',
                    textColor: 'text-green-700 dark:text-green-400',
                    borderColor: 'border-green-200 dark:border-green-700',
                    label: t('consent.status.active')
                };
            case 'refused':
                return {
                    icon: XCircleIcon,
                    bgColor: 'bg-red-50 dark:bg-red-900/20',
                    textColor: 'text-red-700 dark:text-red-400',
                    borderColor: 'border-red-200 dark:border-red-700',
                    label: t('consent.status.refused')
                };
            case 'expired':
                return {
                    icon: ExclamationTriangleIcon,
                    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
                    textColor: 'text-orange-700 dark:text-orange-400',
                    borderColor: 'border-orange-200 dark:border-orange-700',
                    label: t('consent.status.expired')
                };
            case 'purged':
                return {
                    icon: XCircleIcon,
                    bgColor: 'bg-gray-100 dark:bg-gray-800',
                    textColor: 'text-gray-500 dark:text-gray-500',
                    borderColor: 'border-gray-200 dark:border-gray-700',
                    label: t('consent.status.purged')
                };
            case 'error':
                return {
                    icon: ExclamationTriangleIcon,
                    bgColor: 'bg-red-50 dark:bg-red-900/20',
                    textColor: 'text-red-700 dark:text-red-400',
                    borderColor: 'border-red-200 dark:border-red-700',
                    label: t('consent.status.error')
                };
            default:
                return {
                    icon: InformationCircleIcon,
                    bgColor: 'bg-gray-100 dark:bg-gray-700',
                    textColor: 'text-gray-600 dark:text-gray-400',
                    borderColor: 'border-gray-200 dark:border-gray-600',
                    label: t('consent.status.unknown')
                };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    // Compact version (just badge with hover tooltip using portal)
    if (compact) {
        const updateTooltipPosition = () => {
            if (badgeRef.current) {
                const rect = badgeRef.current.getBoundingClientRect();
                setTooltipPosition({
                    top: rect.top - 8, // 8px above the badge
                    left: rect.left + rect.width / 2
                });
            }
        };
        
        const handleMouseEnter = () => {
            updateTooltipPosition();
            setShowTooltip(true);
        };
        
        const tooltipContent = showTooltip && (candidateName || candidateEmail || retentionUntil) && createPortal(
            <div 
                className="fixed z-[99999] p-3 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 text-sm whitespace-nowrap"
                style={{ 
                    top: tooltipPosition.top,
                    left: tooltipPosition.left,
                    transform: 'translate(-50%, -100%)',
                    pointerEvents: 'none',
                    maxWidth: '400px'
                }}
            >
                <div className="space-y-1.5">
                    {candidateName && (
                        <div className="flex items-center gap-3">
                            <span className="text-gray-500 dark:text-gray-400">
                                {t('consent.badge.candidateName')}
                            </span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">
                                {candidateName}
                            </span>
                        </div>
                    )}
                    {candidateEmail && (
                        <div className="flex items-center gap-3">
                            <span className="text-gray-500 dark:text-gray-400">
                                {t('consent.badge.candidateEmail')}
                            </span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">
                                {candidateEmail}
                            </span>
                        </div>
                    )}
                    {retentionUntil && status === 'active' && (
                        <div className="flex items-center gap-3">
                            <span className="text-gray-500 dark:text-gray-400">
                                {t('consent.badge.retentionUntil')}
                            </span>
                            <span className="text-gray-900 dark:text-gray-100 font-medium">
                                {formatDate(retentionUntil)}
                            </span>
                        </div>
                    )}
                    {consentTokenExpiresAt && status === 'pending_consent' && (
                        <div className="flex items-center gap-3">
                            <span className="text-gray-500 dark:text-gray-400">
                                {t('consent.badge.responseDeadline')}
                            </span>
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                                {formatDate(consentTokenExpiresAt)}
                            </span>
                        </div>
                    )}
                </div>
                {/* Arrow pointing down */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1.5 w-3 h-3 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700 transform rotate-45" />
            </div>,
            document.body
        );
        
        return (
            <div 
                ref={badgeRef}
                className="relative inline-block"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <span 
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-default ${config.bgColor} ${config.textColor}`}
                >
                    <Icon className="h-3.5 w-3.5" />
                    {config.label}
                </span>
                {tooltipContent}
            </div>
        );
    }

    return (
        <div className={`border rounded-lg ${config.borderColor} ${config.bgColor} overflow-hidden`}>
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${config.textColor}`} />
                    <span className={`font-medium ${config.textColor}`}>
                        {t('consent.badge.title')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor} border ${config.borderColor}`}>
                        {config.label}
                    </span>
                </div>
                {expanded ? (
                    <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                ) : (
                    <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                )}
            </button>

            {/* Expanded Details */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-200 dark:border-gray-700"
                    >
                        <div className="p-3 space-y-2 text-sm">
                            {/* Profile Type */}
                            {profileType && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">
                                        {t('consent.badge.profileType')}
                                    </span>
                                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                                        {profileType === 'employee' 
                                            ? t('consent.form.profileType.employee')
                                            : t('consent.form.profileType.external')
                                        }
                                    </span>
                                </div>
                            )}

                            {/* Candidate Name */}
                            {candidateName && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">
                                        {t('consent.badge.candidateName')}
                                    </span>
                                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                                        {candidateName}
                                    </span>
                                </div>
                            )}

                            {/* Candidate Email */}
                            {candidateEmail && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">
                                        {t('consent.badge.candidateEmail')}
                                    </span>
                                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                                        {candidateEmail}
                                    </span>
                                </div>
                            )}

                            {/* Request Date */}
                            {consentRequestedAt && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">
                                        {t('consent.badge.requestedAt')}
                                    </span>
                                    <span className="text-gray-900 dark:text-gray-100">
                                        {formatDate(consentRequestedAt)}
                                    </span>
                                </div>
                            )}

                            {/* Response Date */}
                            {consentRespondedAt && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">
                                        {t('consent.badge.respondedAt')}
                                    </span>
                                    <span className="text-gray-900 dark:text-gray-100">
                                        {formatDate(consentRespondedAt)}
                                    </span>
                                </div>
                            )}

                            {/* Retention Until */}
                            {retentionUntil && status === 'active' && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">
                                        {t('consent.badge.retentionUntil')}
                                    </span>
                                    <span className="text-gray-900 dark:text-gray-100">
                                        {formatDate(retentionUntil)}
                                    </span>
                                </div>
                            )}

                            {/* Resend Button */}
                            {status === 'pending_consent' && onResend && (
                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <button
                                        onClick={handleResend}
                                        disabled={resending}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        <ArrowPathIcon className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
                                        {resending 
                                            ? t('consent.badge.resending')
                                            : t('consent.badge.resend')
                                        }
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ConsentBadge;
