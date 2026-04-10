import { MAX_LOGS } from '../config/constants.js';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createModuleLogger } from '../utils/logger.backend.js';

// Module logger (for internal errors only - security logs go to file)
const log = createModuleLogger('security');

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// SECURITY LOGGING SERVICE
// ============================================

// Log file configuration
const LOG_DIR = path.join(__dirname, '../../logs');
const SECURITY_LOG_FILE = path.join(LOG_DIR, 'security.log');
const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_FILES = 5; // Keep 5 rotated files

// Log levels
export const LOG_LEVELS = {
    INFO: 'INFO',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    SECURITY: 'SECURITY'
};

// Security event types
export const SECURITY_EVENTS = {
    AUTH_SUCCESS: 'AUTH_SUCCESS',
    AUTH_FAILURE: 'AUTH_FAILURE',
    AUTH_BLOCKED: 'AUTH_BLOCKED',
    AUTH_LOGOUT: 'AUTH_LOGOUT',
    RATE_LIMIT_HIT: 'RATE_LIMIT_HIT',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
    FILE_UPLOAD: 'FILE_UPLOAD',
    FILE_UPLOAD_REJECTED: 'FILE_UPLOAD_REJECTED',
    LLM_REQUEST: 'LLM_REQUEST',
    DATA_ACCESS: 'DATA_ACCESS',
    USER_CREATED: 'USER_CREATED',
    USER_UPDATED: 'USER_UPDATED',
    USER_DELETED: 'USER_DELETED',
    ADMIN_ACTION: 'ADMIN_ACTION',
    FIRM_DELETED: 'FIRM_DELETED',
    TEMPLATE_DELETED: 'TEMPLATE_DELETED',
    RESUME_DELETED: 'RESUME_DELETED',
    SETTINGS_CHANGED: 'SETTINGS_CHANGED',
    BACKUP_RESTORE: 'BACKUP_RESTORE'
};

// ============================================
// OPTIMIZED CIRCULAR BUFFER FOR SECURITY LOGS
// ============================================

// Pre-allocated fixed-size array for O(1) operations
const securityLogBuffer = new Array(MAX_LOGS).fill(null);
let securityLogWriteIndex = 0;
let securityLogCount = 0;
let securityLogPersistenceQueue = Promise.resolve();
let securityLogDirectoryReady = false;

async function ensureSecurityLogDirectory() {
    if (securityLogDirectoryReady) {
        return;
    }

    await fsPromises.mkdir(LOG_DIR, { recursive: true });
    securityLogDirectoryReady = true;
}

/**
 * Get security logs as array (ordered by timestamp, newest first)
 * Returns a copy to prevent external modification
 */
export function getSecurityLogs() {
    if (securityLogCount === 0) return [];
    
    const logs = [];
    const count = Math.min(securityLogCount, MAX_LOGS);
    
    // Read from newest to oldest
    for (let i = 0; i < count; i++) {
        const idx = (securityLogWriteIndex - 1 - i + MAX_LOGS) % MAX_LOGS;
        if (securityLogBuffer[idx]) {
            logs.push(securityLogBuffer[idx]);
        }
    }
    
    return logs;
}

/**
 * Get security logs count
 */
export function getSecurityLogsCount() {
    return Math.min(securityLogCount, MAX_LOGS);
}

// Legacy export for backward compatibility (returns getter function result)
export const securityLogs = { 
    get length() { return getSecurityLogsCount(); },
    [Symbol.iterator]: function* () { yield* getSecurityLogs(); },
    forEach: (fn) => getSecurityLogs().forEach(fn),
    filter: (fn) => getSecurityLogs().filter(fn),
    map: (fn) => getSecurityLogs().map(fn)
};

/**
 * Structured security logger
 */
export function securityLog(level, event, details = {}) {
    // Compact log entry - only essential fields, no nulls
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        ip: details.ip || 'unknown'
    };
    
    // Only add non-null fields to reduce memory
    if (details.email) logEntry.email = details.email;
    if (details.firmId) logEntry.firmId = details.firmId;
    if (details.firmName) logEntry.firmName = details.firmName;
    if (details.customerName) logEntry.customerName = details.customerName;
    if (details.customer) logEntry.customer = details.customer;
    if (details.role) logEntry.role = details.role;
    if (details.endpoint) logEntry.endpoint = details.endpoint;
    if (details.method) logEntry.method = details.method;
    if (details.statusCode) logEntry.statusCode = details.statusCode;
    if (details.message) logEntry.message = details.message;
    if (details.resourceId) logEntry.resourceId = details.resourceId;
    if (details.resourceType) logEntry.resourceType = details.resourceType;
    if (details.action) logEntry.action = details.action;
    if (details.duration) logEntry.duration = details.duration;
    if (typeof details.stack === 'string' && details.stack.trim().length > 0) {
        logEntry.stack = details.stack;
    }

    // O(1) circular buffer write
    securityLogBuffer[securityLogWriteIndex] = logEntry;
    securityLogWriteIndex = (securityLogWriteIndex + 1) % MAX_LOGS;
    securityLogCount++;
    
    // Persist critical security events to file
    if (shouldPersistLog(level, event)) {
        queueSecurityLogPersistence(logEntry);
    }
}

/**
 * Determine if a log should be persisted to file
 */
function shouldPersistLog(level, event) {
    // Always persist security-critical events
    const criticalEvents = [
        SECURITY_EVENTS.AUTH_FAILURE,
        SECURITY_EVENTS.AUTH_BLOCKED,
        SECURITY_EVENTS.RATE_LIMIT_HIT,
        SECURITY_EVENTS.INVALID_TOKEN,
        SECURITY_EVENTS.SUSPICIOUS_ACTIVITY,
        SECURITY_EVENTS.FILE_UPLOAD_REJECTED,
        SECURITY_EVENTS.USER_DELETED,
        SECURITY_EVENTS.FIRM_DELETED,
        SECURITY_EVENTS.TEMPLATE_DELETED,
        SECURITY_EVENTS.RESUME_DELETED,
        SECURITY_EVENTS.SETTINGS_CHANGED,
        SECURITY_EVENTS.BACKUP_RESTORE
    ];
    
    return level === LOG_LEVELS.SECURITY || 
           level === LOG_LEVELS.ERROR || 
           criticalEvents.includes(event);
}

/**
 * Persist log entry to file with rotation
 */
function queueSecurityLogPersistence(logEntry) {
    securityLogPersistenceQueue = securityLogPersistenceQueue
        .then(async () => {
            await ensureSecurityLogDirectory();
            await rotateLogFileIfNeeded();
            const logLine = JSON.stringify(logEntry) + '\n';
            await fsPromises.appendFile(SECURITY_LOG_FILE, logLine, 'utf8');
        })
        .catch((err) => {
            log.error('Failed to persist security log', { error: err.message });
        });

    return securityLogPersistenceQueue;
}

/**
 * Rotate log file if it exceeds max size
 */
async function rotateLogFileIfNeeded() {
    try {
        const stats = await fsPromises.stat(SECURITY_LOG_FILE).catch((error) => {
            if (error?.code === 'ENOENT') {
                return null;
            }
            throw error;
        });
        if (!stats) return;
        if (stats.size < MAX_LOG_FILE_SIZE) return;
        
        // Rotate existing files
        for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
            const oldFile = `${SECURITY_LOG_FILE}.${i}`;
            const newFile = `${SECURITY_LOG_FILE}.${i + 1}`;
            const oldFileExists = await fsPromises.stat(oldFile).then(() => true).catch((error) => {
                if (error?.code === 'ENOENT') {
                    return false;
                }
                throw error;
            });
            if (oldFileExists) {
                if (i === MAX_LOG_FILES - 1) {
                    await fsPromises.unlink(oldFile); // Delete oldest
                } else {
                    await fsPromises.rename(oldFile, newFile);
                }
            }
        }
        
        // Rename current file to .1
        await fsPromises.rename(SECURITY_LOG_FILE, `${SECURITY_LOG_FILE}.1`);
        
        log.info('Security log file rotated');
    } catch (err) {
        log.error('Failed to rotate log file', { error: err.message });
    }
}

export function flushSecurityLogPersistenceForTests() {
    return securityLogPersistenceQueue;
}

/**
 * Extract request metadata
 */
export function getRequestMetadata(req) {
    return {
        ip: req.ip || req.connection.remoteAddress,
        endpoint: req.path,
        method: req.method,
        userAgent: req.get('user-agent'),
        userId: req.user?.id || null,
        email: req.user?.email || null
    };
}
