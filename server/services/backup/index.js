/**
 * Backup Service - Main Entry Point
 * Re-exports all backup functionality from sub-modules
 */

// Settings
export { 
    initBackupTables, 
    getBackupSettings, 
    saveBackupSettings 
} from './settings.service.js';

// History
export { 
    getBackupHistory, 
    deleteHistoryEntry,
    createHistoryEntry,
    updateHistoryEntry,
    cleanupStaleRunningEntries
} from './history.service.js';

// FTP/SFTP
export { 
    testConnection, 
    listRemoteBackups,
    uploadFile,
    downloadFile,
    cleanupOldRemoteBackups
} from './ftp.service.js';

// Core backup operations
export { 
    createBackup, 
    restoreBackup,
    cleanupAllLocalBackups,
    getLocalBackupStats,
    cleanupOldLocalBackups,
    BACKUP_DIR,
    TEMP_DIR
} from './core.service.js';

// Default export for backward compatibility
export default {
    // Settings
    getBackupSettings,
    saveBackupSettings,
    // History
    getBackupHistory,
    deleteHistoryEntry,
    // FTP
    testConnection,
    listRemoteBackups,
    // Core
    createBackup,
    restoreBackup,
    cleanupAllLocalBackups,
    getLocalBackupStats
};
