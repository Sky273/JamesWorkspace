/**
 * Types and constants for BackupPage
 * Extracted from BackupPage.tsx
 */

export interface BackupSettings {
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

export interface BackupHistoryItem {
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

export interface RemoteFile {
    name: string;
    size: number;
    date: string;
}

export const defaultSettings: BackupSettings = {
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

export const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString();
};
