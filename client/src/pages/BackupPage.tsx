/**
 * BackupPage Component
 * Standalone page for database backup configuration via FTP/SFTP
 * Admin only access
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ArrowPathIcon, ArrowUturnLeftIcon, ClockIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import PageHeader from '../components/page/PageHeader';
import ResponsivePageTabs from '../components/page/ResponsivePageTabs';
import { useAuthFetch } from '../hooks/useAuthFetch';
import logger from '../utils/logger.frontend';
import type { BackupSettings, BackupHistoryItem, RemoteFile } from './backupPage.types';
import { defaultSettings } from './backupPage.types';
import BackupConfigSection from './BackupConfigSection';
import BackupHistorySection from './BackupHistorySection';
import BackupRestoreSection from './BackupRestoreSection';

function getBackupErrorMessage(rawMessage: string | undefined, fallbackMessage: string): string {
    const message = String(rawMessage || '').trim();
    const lowerMessage = message.toLowerCase();

    if (
        lowerMessage.includes('self-signed certificate') ||
        lowerMessage.includes('unable to verify the first certificate') ||
        lowerMessage.includes('unable to get local issuer certificate') ||
        lowerMessage.includes('certificate has expired') ||
        lowerMessage.includes('hostname/ip does not match certificate')
    ) {
        return 'Le certificat TLS du serveur distant est invalide ou non reconnu.';
    }

    return message || fallbackMessage;
}

const BackupPage = (): JSX.Element => {
    const { t } = useTranslation();
    const { authGet, authPost, authPut, authDelete } = useAuthFetch();
    
    const [settings, setSettings] = useState<BackupSettings>(defaultSettings);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [backingUp, setBackingUp] = useState(false);
    const [history, setHistory] = useState<BackupHistoryItem[]>([]);
    const [remoteFiles, setRemoteFiles] = useState<RemoteFile[]>([]);
    const [loadingRemote, setLoadingRemote] = useState(false);
    const [remoteLoadAttempted, setRemoteLoadAttempted] = useState(false);
    const [remoteLoadError, setRemoteLoadError] = useState<string | null>(null);
    const [restoring, setRestoring] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<'config' | 'history' | 'restore'>('config');
    const settingsRequestIdRef = useRef(0);
    const historyRequestIdRef = useRef(0);
    const remoteFilesRequestIdRef = useRef(0);

     
    const fetchSettings = useCallback(async () => {
        const requestId = ++settingsRequestIdRef.current;
        try {
            const response = await authGet('/api/backup/settings');
            if (response.ok) {
                const data = await response.json();
                if (requestId !== settingsRequestIdRef.current) {
                    return;
                }
                if (data && data.id) {
                    setSettings({ 
                        ...defaultSettings, 
                        ...data,
                        tls_mode: data.tls_mode || 'explicit'
                    });
                }
            }
        } catch (error) {
            if (requestId !== settingsRequestIdRef.current) {
                return;
            }
            logger.error('Failed to fetch backup settings:', error);
        } finally {
            if (requestId === settingsRequestIdRef.current) {
                setLoading(false);
            }
        }
    }, [authGet]);

    const fetchHistory = useCallback(async () => {
        const requestId = ++historyRequestIdRef.current;
        try {
            const response = await authGet('/api/backup/history?limit=20');
            if (response.ok) {
                const data = await response.json();
                if (requestId !== historyRequestIdRef.current) {
                    return;
                }
                setHistory(data.items || []);
            }
        } catch (error) {
            if (requestId !== historyRequestIdRef.current) {
                return;
            }
            logger.error('Failed to fetch backup history:', error);
        }
    }, [authGet]);

    useEffect(() => {
        fetchSettings();
        fetchHistory();
    }, [fetchSettings, fetchHistory]);

    const fetchRemoteFiles = async ({ silent = false }: { silent?: boolean } = {}) => {
        const requestId = ++remoteFilesRequestIdRef.current;
        if (settings.backup_target !== 'remote' || !settings.host) {
            setRemoteFiles([]);
            setRemoteLoadError(null);
            setRemoteLoadAttempted(true);
            return;
        }

        setLoadingRemote(true);
        setRemoteLoadAttempted(true);
        setRemoteLoadError(null);
        try {
            const response = await authGet('/api/backup/list-remote');
            if (response.ok) {
                const data = await response.json();
                if (requestId !== remoteFilesRequestIdRef.current) {
                    return;
                }
                if (data.success) {
                    setRemoteFiles(data.files || []);
                    setRemoteLoadError(null);
                } else {
                    setRemoteFiles([]);
                    const errorMessage = getBackupErrorMessage(data.message, t('backup.remoteListError'));
                    setRemoteLoadError(errorMessage);
                    if (!silent) {
                        toast.error(errorMessage);
                    }
                }
            } else {
                if (requestId !== remoteFilesRequestIdRef.current) {
                    return;
                }
                const fallbackMessage = t('backup.remoteListError');
                setRemoteFiles([]);
                setRemoteLoadError(fallbackMessage);
                if (!silent) {
                    toast.error(fallbackMessage);
                }
            }
        } catch (error) {
            if (requestId !== remoteFilesRequestIdRef.current) {
                return;
            }
            logger.error('Failed to fetch remote files:', error);
            const fallbackMessage = t('backup.remoteListError');
            setRemoteFiles([]);
            setRemoteLoadError(fallbackMessage);
            if (!silent) {
                toast.error(fallbackMessage);
            }
        } finally {
            if (requestId === remoteFilesRequestIdRef.current) {
                setLoadingRemote(false);
            }
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...settings,
                password: password || undefined
            };
            
            const response = await authPut('/api/backup/settings', payload);
            if (response.ok) {
                const data = await response.json();
                setSettings({ ...defaultSettings, ...data });
                setPassword('');
                toast.success(t('backup.saveSuccess'));
            } else {
                toast.error(t('backup.saveError'));
            }
        } catch (error) {
            logger.error('Failed to save backup settings:', error);
            toast.error(t('backup.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        try {
            const payload = {
                protocol: settings.protocol,
                tls_mode: settings.tls_mode,
                host: settings.host,
                port: settings.port,
                username: settings.username,
                password: password || undefined,
                remote_path: settings.remote_path
            };
            
            const response = await authPost('/api/backup/test-connection', payload);
            const data = await response.json();
            
            if (data.success) {
                toast.success(t('backup.connectionSuccess'));
            } else {
                toast.error(getBackupErrorMessage(data.message, t('backup.connectionError')));
            }
        } catch (error) {
            logger.error('Connection test failed:', error);
            toast.error(t('backup.connectionError'));
        } finally {
            setTesting(false);
        }
    };

    const handleRunBackup = async () => {
        setBackingUp(true);
        try {
            const response = await authPost('/api/backup/run', {});
            const data = await response.json();
            
            if (data.success) {
                toast.success(t('backup.backupSuccess'));
                fetchHistory();
            } else {
                toast.error(data.error || t('backup.backupError'));
            }
        } catch (error) {
            logger.error('Backup failed:', error);
            toast.error(t('backup.backupError'));
        } finally {
            setBackingUp(false);
        }
    };

    const handleDeleteHistory = async (id: string) => {
        try {
            historyRequestIdRef.current += 1;
            const response = await authDelete(`/api/backup/history/${id}`);
            if (response.ok) {
                setHistory(prev => prev.filter(item => item.id !== id));
                toast.success(t('backup.historyDeleted'));
            }
        } catch (error) {
            logger.error('Failed to delete history entry:', error);
        }
    };

    const handleRestore = async (filename: string) => {
        if (!window.confirm(t('backup.restoreConfirm'))) {
            return;
        }

        const confirmation = window.prompt(t('backup.restoreConfirmTextPrompt'));
        if (confirmation !== 'RESTORE') {
            toast.error(t('backup.restoreCancelled'));
            return;
        }
        
        setRestoring(filename);
        try {
            const response = await authPost('/api/backup/restore', { filename, confirmText: 'RESTORE' });
            const data = await response.json();
            
            if (data.success) {
                toast.success(t('backup.restoreSuccess'));
            } else {
                toast.error(data.message || t('backup.restoreError'));
            }
        } catch (error) {
            logger.error('Restore failed:', error);
            toast.error(t('backup.restoreError'));
        } finally {
            setRestoring(null);
        }
    };

    const handleInputChange = (field: keyof BackupSettings, value: string | number | boolean) => {
        setSettings(prev => {
            const updated = { ...prev, [field]: value };
            
            if (field === 'protocol') {
                if (value === 'sftp') {
                    updated.port = 22;
                } else {
                    updated.port = 21;
                }
            }
            
            return updated;
        });
    };

    const dayNames = [
        t('backup.sunday'),
        t('backup.monday'),
        t('backup.tuesday'),
        t('backup.wednesday'),
        t('backup.thursday'),
        t('backup.friday'),
        t('backup.saturday')
    ];

    if (loading) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="cv-surface app-page-shell max-w-6xl"
            >
                <div className="section-shell rounded-[2rem] p-8">
                    <div className="flex items-start gap-4">
                        <ArrowPathIcon className="mt-1 w-6 h-6 animate-spin text-primary-500" />
                        <div className="flex-1 space-y-4">
                            <div>
                                <div className="h-8 w-72 max-w-full rounded-full bg-gray-200/80 dark:bg-gray-700/70 animate-pulse" />
                                <div className="mt-3 h-4 w-[32rem] max-w-full rounded-full bg-gray-200/70 dark:bg-gray-700/60 animate-pulse" />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                                <div className="h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                                <div className="h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('backup.pageDescription')}</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="cv-surface app-page-shell max-w-6xl"
        >
            <PageHeader title={t('backup.pageTitle')} subtitle={t('backup.pageDescription')} />

            <ResponsivePageTabs
                label={t('backup.sections.title', 'Sections')}
                minItemWidthRem={10}
                onChange={(nextSection) => {
                    if (nextSection === 'restore') {
                        setActiveSection('restore');
                        void fetchRemoteFiles({ silent: true });
                        return;
                    }
                    setActiveSection(nextSection);
                }}
                options={[
                    { value: 'config', label: t('backup.configTab'), icon: Cog6ToothIcon },
                    { value: 'history', label: t('backup.historyTab'), icon: ClockIcon },
                    { value: 'restore', label: t('backup.restoreTab'), icon: ArrowUturnLeftIcon },
                ]}
                value={activeSection}
            />

            <div className="section-shell rounded-[2rem] p-6">
                {activeSection === 'config' && (
                    <BackupConfigSection
                        settings={settings}
                        password={password}
                        setPassword={setPassword}
                        saving={saving}
                        testing={testing}
                        backingUp={backingUp}
                        dayNames={dayNames}
                        onInputChange={handleInputChange}
                        onSave={handleSave}
                        onTestConnection={handleTestConnection}
                        onRunBackup={handleRunBackup}
                    />
                )}

                {activeSection === 'history' && (
                    <BackupHistorySection
                        history={history}
                        onRefresh={fetchHistory}
                        onDelete={handleDeleteHistory}
                    />
                )}

                {activeSection === 'restore' && (
                    <BackupRestoreSection
                        settings={settings}
                        remoteFiles={remoteFiles}
                        loadingRemote={loadingRemote}
                        remoteLoadAttempted={remoteLoadAttempted}
                        remoteLoadError={remoteLoadError}
                        restoring={restoring}
                        onRefresh={() => void fetchRemoteFiles()}
                        onRestore={handleRestore}
                    />
                )}
            </div>
        </motion.div>
    );
};

export default BackupPage;
