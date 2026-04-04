/**
 * Backup Service - Main Entry Point
 * Re-exports all backup functionality from sub-modules
 */

// Import all modules first
import { initBackupTables, getBackupSettings, saveBackupSettings } from './settings.service.js';
import { getBackupHistory, deleteHistoryEntry, createHistoryEntry, updateHistoryEntry, cleanupStaleRunningEntries } from './history.service.js';
import { testConnection, listRemoteBackups, uploadFile, downloadFile, cleanupOldRemoteBackups } from './ftp.service.js';
import { createBackup, restoreBackup, cleanupAllLocalBackups, getLocalBackupStats, cleanupOldLocalBackups, BACKUP_DIR, TEMP_DIR } from './core.service.js';

// Named exports
export {
    // Settings
    initBackupTables,
    getBackupSettings,
    saveBackupSettings,
    // History
    getBackupHistory,
    deleteHistoryEntry,
    createHistoryEntry,
    updateHistoryEntry,
    cleanupStaleRunningEntries,
    // FTP/SFTP
    testConnection,
    listRemoteBackups,
    uploadFile,
    downloadFile,
    cleanupOldRemoteBackups,
    // Core
    createBackup,
    restoreBackup,
    cleanupAllLocalBackups,
    getLocalBackupStats,
    cleanupOldLocalBackups,
    BACKUP_DIR,
    TEMP_DIR
};
