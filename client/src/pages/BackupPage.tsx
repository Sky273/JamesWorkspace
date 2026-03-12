/**
 * BackupPage Component
 * Standalone page for database backup configuration via FTP/SFTP
 * Admin only access
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { 
    CloudArrowUpIcon, 
    CloudArrowDownIcon,
    PlayIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    TrashIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    ServerStackIcon
} from '@heroicons/react/24/outline';
import { useAuthFetch } from '../hooks/useAuthFetch';
import logger from '../utils/logger.frontend';

interface BackupSettings {
    id?: string;
    backup_target: 'local' | 'remote';
    protocol: 'ftp' | 'ftps' | 'sftp';
    tls_mode: 'none' | 'explicit' | 'implicit';
    host: string;
    port: number;
    username: string;
    remote_path: string;
    hasPassword?: boolean;
    daily_enabled: boolean;
    daily_time: string;
    daily_retention: number;
    weekly_enabled: boolean;
    weekly_day: number;
    weekly_time: string;
    weekly_retention: number;
    monthly_enabled: boolean;
    monthly_day: number;
    monthly_time: string;
    monthly_retention: number;
    schedulerStatus?: {
        daily: boolean;
        weekly: boolean;
        monthly: boolean;
    };
}

interface BackupHistoryItem {
    id: string;
    backup_type: string;
    filename: string;
    file_size: number;
    status: 'pending' | 'running' | 'success' | 'failed';
    error_message?: string;
    started_at: string;
    completed_at?: string;
    uploaded: boolean;
}

interface RemoteFile {
    name: string;
    size: number;
    date: string;
}

const defaultSettings: BackupSettings = {
    backup_target: 'local',
    protocol: 'ftp',
    tls_mode: 'explicit',
    host: '',
    port: 21,
    username: '',
    remote_path: '/backups',
    daily_enabled: false,
    daily_time: '02:00',
    daily_retention: 7,
    weekly_enabled: false,
    weekly_day: 0,
    weekly_time: '03:00',
    weekly_retention: 4,
    monthly_enabled: false,
    monthly_day: 1,
    monthly_time: '04:00',
    monthly_retention: 12
};

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

    const formatFileSize = (bytes: number): string => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateStr: string): string => {
        return new Date(dateStr).toLocaleString();
    };

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
                <div className="space-y-6">
                    {/* Backup Target Selection */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {t('backup.targetTitle', 'Backup Target')}
                        </h3>
                        
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="backup_target"
                                    value="local"
                                    checked={settings.backup_target === 'local'}
                                    onChange={() => handleInputChange('backup_target', 'local')}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {t('backup.targetLocal', 'Local only (server disk)')}
                                </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="backup_target"
                                    value="remote"
                                    checked={settings.backup_target === 'remote'}
                                    onChange={() => handleInputChange('backup_target', 'remote')}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {t('backup.targetRemote', 'Remote server (FTP/SFTP)')}
                                </span>
                            </label>
                        </div>
                        
                        {settings.backup_target === 'local' && (
                            <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                                <ExclamationTriangleIcon className="w-4 h-4" />
                                {t('backup.localWarning', 'Local backups are stored on the server. For disaster recovery, consider using remote backup.')}
                            </p>
                        )}
                    </div>

                    {/* Connection Settings - only show for remote target */}
                    {settings.backup_target === 'remote' && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {t('backup.connectionTitle')}
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('backup.protocol')}
                                </label>
                                <select
                                    value={settings.protocol}
                                    onChange={(e) => handleInputChange('protocol', e.target.value as 'ftp' | 'ftps' | 'sftp')}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                >
                                    <option value="ftp">FTP</option>
                                    <option value="ftps">FTPS (FTP over TLS)</option>
                                    <option value="sftp">SFTP (SSH)</option>
                                </select>
                            </div>
                            
                            {/* TLS Mode - only for FTP/FTPS */}
                            {settings.protocol !== 'sftp' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {t('backup.tlsMode')}
                                    </label>
                                    <select
                                        value={settings.tls_mode}
                                        onChange={(e) => handleInputChange('tls_mode', e.target.value as 'none' | 'explicit' | 'implicit')}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    >
                                        <option value="explicit">{t('backup.tlsExplicit')}</option>
                                        <option value="implicit">{t('backup.tlsImplicit')}</option>
                                        <option value="none">{t('backup.tlsNone')}</option>
                                    </select>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {t('backup.tlsHelp')}
                                    </p>
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('backup.host')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={settings.host}
                                    onChange={(e) => handleInputChange('host', e.target.value)}
                                    placeholder="ftp.example.com"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('backup.port')}
                                </label>
                                <input
                                    type="number"
                                    value={settings.port}
                                    onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 21)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('backup.username')}
                                </label>
                                <input
                                    type="text"
                                    value={settings.username}
                                    onChange={(e) => handleInputChange('username', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('backup.password')}
                                    {settings.hasPassword && (
                                        <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                                            ({t('backup.passwordSet')})
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={settings.hasPassword ? '••••••••' : ''}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('backup.remotePath')}
                                </label>
                                <input
                                    type="text"
                                    value={settings.remote_path}
                                    onChange={(e) => handleInputChange('remote_path', e.target.value)}
                                    placeholder="/backups"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={handleTestConnection}
                                disabled={testing || !settings.host || !settings.username}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md disabled:opacity-50 flex items-center gap-2"
                            >
                                {testing ? (
                                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                ) : (
                                    <CloudArrowUpIcon className="w-4 h-4" />
                                )}
                                {t('backup.testConnection')}
                            </button>
                        </div>
                    </div>
                    )}

                    {/* Schedule Settings */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {t('backup.scheduleTitle')}
                        </h3>
                        
                        {/* Daily */}
                        <div className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-md">
                            <input
                                type="checkbox"
                                checked={settings.daily_enabled}
                                onChange={(e) => handleInputChange('daily_enabled', e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="font-medium text-gray-900 dark:text-white w-24">
                                {t('backup.daily')}
                            </span>
                            <input
                                type="time"
                                value={settings.daily_time}
                                onChange={(e) => handleInputChange('daily_time', e.target.value)}
                                disabled={!settings.daily_enabled}
                                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {t('backup.retention')}:
                            </span>
                            <input
                                type="number"
                                min="1"
                                max="30"
                                value={settings.daily_retention}
                                onChange={(e) => handleInputChange('daily_retention', parseInt(e.target.value) || 7)}
                                disabled={!settings.daily_enabled}
                                className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                            />
                            {settings.schedulerStatus?.daily && (
                                <CheckCircleIcon className="w-5 h-5 text-green-500" title={t('backup.scheduled')} />
                            )}
                        </div>
                        
                        {/* Weekly */}
                        <div className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-md flex-wrap">
                            <input
                                type="checkbox"
                                checked={settings.weekly_enabled}
                                onChange={(e) => handleInputChange('weekly_enabled', e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="font-medium text-gray-900 dark:text-white w-24">
                                {t('backup.weekly')}
                            </span>
                            <select
                                value={settings.weekly_day}
                                onChange={(e) => handleInputChange('weekly_day', parseInt(e.target.value))}
                                disabled={!settings.weekly_enabled}
                                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                            >
                                {dayNames.map((day, index) => (
                                    <option key={index} value={index}>{day}</option>
                                ))}
                            </select>
                            <input
                                type="time"
                                value={settings.weekly_time}
                                onChange={(e) => handleInputChange('weekly_time', e.target.value)}
                                disabled={!settings.weekly_enabled}
                                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {t('backup.retention')}:
                            </span>
                            <input
                                type="number"
                                min="1"
                                max="52"
                                value={settings.weekly_retention}
                                onChange={(e) => handleInputChange('weekly_retention', parseInt(e.target.value) || 4)}
                                disabled={!settings.weekly_enabled}
                                className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                            />
                            {settings.schedulerStatus?.weekly && (
                                <CheckCircleIcon className="w-5 h-5 text-green-500" title={t('backup.scheduled')} />
                            )}
                        </div>
                        
                        {/* Monthly */}
                        <div className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-md flex-wrap">
                            <input
                                type="checkbox"
                                checked={settings.monthly_enabled}
                                onChange={(e) => handleInputChange('monthly_enabled', e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="font-medium text-gray-900 dark:text-white w-24">
                                {t('backup.monthly')}
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {t('backup.dayOfMonth')}:
                            </span>
                            <input
                                type="number"
                                min="1"
                                max="28"
                                value={settings.monthly_day}
                                onChange={(e) => handleInputChange('monthly_day', parseInt(e.target.value) || 1)}
                                disabled={!settings.monthly_enabled}
                                className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                            />
                            <input
                                type="time"
                                value={settings.monthly_time}
                                onChange={(e) => handleInputChange('monthly_time', e.target.value)}
                                disabled={!settings.monthly_enabled}
                                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {t('backup.retention')}:
                            </span>
                            <input
                                type="number"
                                min="1"
                                max="24"
                                value={settings.monthly_retention}
                                onChange={(e) => handleInputChange('monthly_retention', parseInt(e.target.value) || 12)}
                                disabled={!settings.monthly_enabled}
                                className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                            />
                            {settings.schedulerStatus?.monthly && (
                                <CheckCircleIcon className="w-5 h-5 text-green-500" title={t('backup.scheduled')} />
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                            {t('common.save')}
                        </button>
                        
                        <button
                            onClick={handleRunBackup}
                            disabled={backingUp || !settings.host}
                            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 flex items-center gap-2"
                        >
                            {backingUp ? (
                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            ) : (
                                <PlayIcon className="w-4 h-4" />
                            )}
                            {t('backup.runNow')}
                        </button>
                    </div>
                </div>
            )}

            {/* History Section */}
            {activeSection === 'history' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {t('backup.historyTitle')}
                        </h3>
                        <button
                            onClick={fetchHistory}
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
                                                    onClick={() => handleDeleteHistory(item.id)}
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
            )}

            {/* Restore Section */}
            {activeSection === 'restore' && (
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
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {t('backup.remoteBackups')}
                        </h3>
                        <button
                            onClick={fetchRemoteFiles}
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
                                                    onClick={() => handleRestore(file.name)}
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
            )}
        </div>
    );
};

export default BackupPage;
