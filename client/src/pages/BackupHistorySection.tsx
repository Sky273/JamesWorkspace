/**
 * BackupHistorySection - History tab for backup entries
 * Extracted from BackupPage.tsx
 */

import { useTranslation } from 'react-i18next';
import {
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    TrashIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import type { BackupHistoryItem } from './backupPage.types';
import { formatFileSize, formatDate } from './backupPage.types';

interface BackupHistorySectionProps {
    history: BackupHistoryItem[];
    onRefresh: () => void;
    onDelete: (id: string) => void;
}

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'success':
            return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
        case 'failed':
            return <XCircleIcon className="w-5 h-5 text-red-500" />;
        case 'running':
            return <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />;
        default:
            return <ClockIcon className="w-5 h-5 text-gray-400" />;
    }
};

export default function BackupHistorySection({
    history,
    onRefresh,
    onDelete
}: BackupHistorySectionProps) {
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {t('backup.historyTitle')}
                </h3>
                <button
                    onClick={onRefresh}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                >
                    <ArrowPathIcon className="w-4 h-4" />
                    {t('common.refresh')}
                </button>
            </div>
            
            {history.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    {t('backup.noHistory')}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-2 text-left">{t('backup.status')}</th>
                                <th className="px-4 py-2 text-left">{t('backup.type')}</th>
                                <th className="px-4 py-2 text-left">{t('backup.filename')}</th>
                                <th className="px-4 py-2 text-left">{t('backup.size')}</th>
                                <th className="px-4 py-2 text-left">{t('backup.date')}</th>
                                <th className="px-4 py-2 text-left">{t('backup.uploaded')}</th>
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                            {history.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-4 py-2">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(item.status)}
                                            <span className="capitalize">{item.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 capitalize">{item.backup_type}</td>
                                    <td className="px-4 py-2 font-mono text-xs">{item.filename}</td>
                                    <td className="px-4 py-2">{formatFileSize(item.file_size)}</td>
                                    <td className="px-4 py-2">{formatDate(item.started_at)}</td>
                                    <td className="px-4 py-2">
                                        {item.uploaded ? (
                                            <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                        ) : (
                                            <XCircleIcon className="w-5 h-5 text-gray-400" />
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        <button
                                            onClick={() => onDelete(item.id)}
                                            className="text-red-500 hover:text-red-700"
                                            title={t('common.delete')}
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
