/**
 * BackupConfigSection - Configuration tab for backup settings
 * Extracted from BackupPage.tsx
 */

import { useTranslation } from 'react-i18next';
import {
    CloudArrowUpIcon,
    PlayIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import type { BackupSettings } from './backupPage.types';

interface BackupConfigSectionProps {
    settings: BackupSettings;
    password: string;
    setPassword: (v: string) => void;
    saving: boolean;
    testing: boolean;
    backingUp: boolean;
    dayNames: string[];
    onInputChange: (field: keyof BackupSettings, value: string | number | boolean) => void;
    onSave: () => void;
    onTestConnection: () => void;
    onRunBackup: () => void;
}

export default function BackupConfigSection({
    settings,
    password,
    setPassword,
    saving,
    testing,
    backingUp,
    dayNames,
    onInputChange,
    onSave,
    onTestConnection,
    onRunBackup
}: BackupConfigSectionProps) {
    const { t } = useTranslation();
    const requiresRemoteHost = settings.backup_target === 'remote' && !settings.host;
    const requiresRemoteCredentials = settings.backup_target === 'remote' && (!settings.host || !settings.username);

    return (
        <div className="space-y-6">
            {/* Backup Target Selection */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {t('backup.targetTitle', 'Backup Target')}
                </h3>
                
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="backup_target"
                            value="local"
                            checked={settings.backup_target === 'local'}
                            onChange={() => onInputChange('backup_target', 'local')}
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
                            onChange={() => onInputChange('backup_target', 'remote')}
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
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {t('backup.connectionTitle')}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('backup.protocol')}
                        </label>
                        <select
                            value={settings.protocol}
                            onChange={(e) => onInputChange('protocol', e.target.value as 'ftp' | 'ftps' | 'sftp')}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
                                onChange={(e) => onInputChange('tls_mode', e.target.value as 'none' | 'explicit' | 'implicit')}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
                            onChange={(e) => onInputChange('host', e.target.value)}
                            placeholder="ftp.example.com"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
                            onChange={(e) => onInputChange('port', parseInt(e.target.value) || 21)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('backup.username')}
                        </label>
                        <input
                            type="text"
                            value={settings.username}
                            onChange={(e) => onInputChange('username', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('backup.remotePath')}
                        </label>
                        <input
                            type="text"
                            value={settings.remote_path}
                            onChange={(e) => onInputChange('remote_path', e.target.value)}
                            placeholder="/backups"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onTestConnection}
                        disabled={testing || requiresRemoteCredentials}
                        className={`btn btn-secondary px-4 py-2 flex items-center gap-2 ${testing || requiresRemoteCredentials ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {t('backup.scheduleTitle')}
                </h3>
                
                {/* Daily */}
                <div className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-md">
                    <input
                        type="checkbox"
                        checked={settings.daily_enabled}
                        onChange={(e) => onInputChange('daily_enabled', e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="font-medium text-gray-900 dark:text-gray-100 w-24">
                        {t('backup.daily')}
                    </span>
                    <input
                        type="time"
                        value={settings.daily_time}
                        onChange={(e) => onInputChange('daily_time', e.target.value)}
                        disabled={!settings.daily_enabled}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        {t('backup.retention')}:
                    </span>
                    <input
                        type="number"
                        min="1"
                        max="30"
                        value={settings.daily_retention}
                        onChange={(e) => onInputChange('daily_retention', parseInt(e.target.value) || 7)}
                        disabled={!settings.daily_enabled}
                        className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
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
                        onChange={(e) => onInputChange('weekly_enabled', e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="font-medium text-gray-900 dark:text-gray-100 w-24">
                        {t('backup.weekly')}
                    </span>
                    <select
                        value={settings.weekly_day}
                        onChange={(e) => onInputChange('weekly_day', parseInt(e.target.value))}
                        disabled={!settings.weekly_enabled}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                    >
                        {dayNames.map((day, index) => (
                            <option key={index} value={index}>{day}</option>
                        ))}
                    </select>
                    <input
                        type="time"
                        value={settings.weekly_time}
                        onChange={(e) => onInputChange('weekly_time', e.target.value)}
                        disabled={!settings.weekly_enabled}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        {t('backup.retention')}:
                    </span>
                    <input
                        type="number"
                        min="1"
                        max="52"
                        value={settings.weekly_retention}
                        onChange={(e) => onInputChange('weekly_retention', parseInt(e.target.value) || 4)}
                        disabled={!settings.weekly_enabled}
                        className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
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
                        onChange={(e) => onInputChange('monthly_enabled', e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="font-medium text-gray-900 dark:text-gray-100 w-24">
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
                        onChange={(e) => onInputChange('monthly_day', parseInt(e.target.value) || 1)}
                        disabled={!settings.monthly_enabled}
                        className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                    />
                    <input
                        type="time"
                        value={settings.monthly_time}
                        onChange={(e) => onInputChange('monthly_time', e.target.value)}
                        disabled={!settings.monthly_enabled}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        {t('backup.retention')}:
                    </span>
                    <input
                        type="number"
                        min="1"
                        max="24"
                        value={settings.monthly_retention}
                        onChange={(e) => onInputChange('monthly_retention', parseInt(e.target.value) || 12)}
                        disabled={!settings.monthly_enabled}
                        className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                    />
                    {settings.schedulerStatus?.monthly && (
                        <CheckCircleIcon className="w-5 h-5 text-green-500" title={t('backup.scheduled')} />
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    className={`app-primary-action px-6 py-2 flex items-center gap-2 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {saving && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                    {t('common.save')}
                </button>
                
                <button
                    type="button"
                    onClick={onRunBackup}
                    disabled={backingUp || requiresRemoteHost}
                    className={`btn btn-secondary px-6 py-2 flex items-center gap-2 ${backingUp || requiresRemoteHost ? 'opacity-50 cursor-not-allowed' : ''}`}
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
    );
}
