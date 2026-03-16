/**
 * BackupPage Component
 * Standalone page for database backup configuration via FTP/SFTP
 * Admin only access
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ArrowPathIcon, ServerStackIcon } from '@heroicons/react/24/outline';
import { useAuthFetch } from '../hooks/useAuthFetch';
import logger from '../utils/logger.frontend';
import type { BackupSettings, BackupHistoryItem, RemoteFile } from './backupPage.types';
import { defaultSettings } from './backupPage.types';
import BackupConfigSection from './BackupConfigSection';
import BackupHistorySection from './BackupHistorySection';
import BackupRestoreSection from './BackupRestoreSection';

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
    const [restoring, setRestoring] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<'config' | 'history' | 'restore'>('config');

     
    useEffect(() => {
        fetchSettings();
        fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await authGet('/api/backup/settings');
            if (response.ok) {
                const data = await response.json();
                if (data && data.id) {
                    setSettings({ 
                        ...defaultSettings, 
                        ...data,
                        tls_mode: data.tls_mode || 'explicit'
                    });
                }
            }
        } catch (error) {
            logger.error('Failed to fetch backup settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const response = await authGet('/api/backup/history?limit=20');
            if (response.ok) {
                const data = await response.json();
                setHistory(data.items || []);
            }
        } catch (error) {
            logger.error('Failed to fetch backup history:', error);
        }
    };

    const fetchRemoteFiles = async () => {
        setLoadingRemote(true);
        try {
            const response = await authGet('/api/backup/list-remote');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setRemoteFiles(data.files || []);
                } else {
                    toast.error(data.message || t('backup.remoteListError'));
                }
            }
        } catch (error) {
            logger.error('Failed to fetch remote files:', error);
            toast.error(t('backup.remoteListError'));
        } finally {
            setLoadingRemote(false);
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
                toast.error(data.message || t('backup.connectionError'));
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
        
        setRestoring(filename);
        try {
            const response = await authPost('/api/backup/restore', { filename });
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
            <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <ServerStackIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {t('backup.pageTitle')}
                    </h1>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('backup.pageDescription')}
                </p>
            </div>

            {/* Section Tabs */}
            <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700 mb-6">
                <button
                    onClick={() => setActiveSection('config')}
                    className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                        activeSection === 'config'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    {t('backup.configTab')}
                </button>
                <button
                    onClick={() => setActiveSection('history')}
                    className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                        activeSection === 'history'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    {t('backup.historyTab')}
                </button>
                <button
                    onClick={() => {
                        setActiveSection('restore');
                        fetchRemoteFiles();
                    }}
                    className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                        activeSection === 'restore'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                    {t('backup.restoreTab')}
                </button>
            </div>

            {/* Configuration Section */}
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

            {/* History Section */}
            {activeSection === 'history' && (
                <BackupHistorySection
                    history={history}
                    onRefresh={fetchHistory}
                    onDelete={handleDeleteHistory}
                />
            )}

            {/* Restore Section */}
            {activeSection === 'restore' && (
                <BackupRestoreSection
                    remoteFiles={remoteFiles}
                    loadingRemote={loadingRemote}
                    restoring={restoring}
                    onRefresh={fetchRemoteFiles}
                    onRestore={handleRestore}
                />
            )}
        </div>
    );
};

export default BackupPage;
