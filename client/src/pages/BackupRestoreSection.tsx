/**
 * BackupRestoreSection - Restore tab for remote backup files
 * Extracted from BackupPage.tsx
 */

import { useTranslation } from 'react-i18next';
import {
    CloudArrowDownIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import type { RemoteFile } from './backupPage.types';
import { formatFileSize, formatDate } from './backupPage.types';

interface BackupRestoreSectionProps {
    remoteFiles: RemoteFile[];
    loadingRemote: boolean;
    restoring: string | null;
    onRefresh: () => void;
    onRestore: (filename: string) => void;
}

export default function BackupRestoreSection({
    remoteFiles,
    loadingRemote,
    restoring,
    onRefresh,
    onRestore
}: BackupRestoreSectionProps) {
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                    <div>
                        <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                            {t('backup.restoreWarningTitle')}
                        </h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            {t('backup.restoreWarning')}
                        </p>
                    </div>
                </div>
            </div>
            
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {t('backup.remoteBackups')}
                </h3>
                <button
                    onClick={onRefresh}
                    disabled={loadingRemote}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                >
                    {loadingRemote ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                        <ArrowPathIcon className="w-4 h-4" />
                    )}
                    {t('common.refresh')}
                </button>
            </div>
            
            {loadingRemote ? (
                <div className="flex justify-center py-8">
                    <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            ) : remoteFiles.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    {t('backup.noRemoteBackups')}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-2 text-left">{t('backup.filename')}</th>
                                <th className="px-4 py-2 text-left">{t('backup.size')}</th>
                                <th className="px-4 py-2 text-left">{t('backup.date')}</th>
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                            {remoteFiles.map((file) => (
                                <tr key={file.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-4 py-2 font-mono text-xs">{file.name}</td>
                                    <td className="px-4 py-2">{formatFileSize(file.size)}</td>
                                    <td className="px-4 py-2">{formatDate(file.date)}</td>
                                    <td className="px-4 py-2">
                                        <button
                                            onClick={() => onRestore(file.name)}
                                            disabled={restoring !== null}
                                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded disabled:opacity-50 flex items-center gap-1"
                                        >
                                            {restoring === file.name ? (
                                                <ArrowPathIcon className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <CloudArrowDownIcon className="w-3 h-3" />
                                            )}
                                            {t('backup.restore')}
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
