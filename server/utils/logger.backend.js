// Import winston directly to avoid import.meta.url issues

// ============================================
// LOGGING CONFIGURATION
// ============================================

// Log levels hierarchy (lower number = higher priority)
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

// Get configured log level from environment
// Pre-production default: 'info' (shows error, warn, info but not debug)
const CONFIGURED_LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const CONFIGURED_LOG_LEVEL_NUM = LOG_LEVELS[CONFIGURED_LOG_LEVEL] ?? LOG_LEVELS.info;

// ============================================
// OPTIMIZED CIRCULAR BUFFER FOR PROXY LOGS
// ============================================

const LOG_BUFFER_SIZE = parseInt(process.env.LOG_BUFFER_SIZE || '1000', 10);

// Pre-allocated fixed-size array for O(1) operations
const proxyLogBuffer = new Array(LOG_BUFFER_SIZE).fill(null);
let proxyLogWriteIndex = 0;
let proxyLogCount = 0;

/**
 * Get proxy logs as array (ordered by timestamp, newest first)
 * Returns a copy to prevent external modification
 */
export function getProxyLogs() {
    if (proxyLogCount === 0) return [];
    
    const logs = [];
    const count = Math.min(proxyLogCount, LOG_BUFFER_SIZE);
    
    // Read from newest to oldest
    for (let i = 0; i < count; i++) {
        const idx = (proxyLogWriteIndex - 1 - i + LOG_BUFFER_SIZE) % LOG_BUFFER_SIZE;
        if (proxyLogBuffer[idx]) {
            logs.push(proxyLogBuffer[idx]);
        }
    }
    
    return logs;
}

/**
 * Get proxy logs count
 */
export function getProxyLogsCount() {
    return Math.min(proxyLogCount, LOG_BUFFER_SIZE);
}

// Legacy export for backward compatibility
export const proxyLogs = {
    get length() { return getProxyLogsCount(); },
    [Symbol.iterator]: function* () { yield* getProxyLogs(); },
    forEach: (fn) => getProxyLogs().forEach(fn),
    filter: (fn) => getProxyLogs().filter(fn),
    map: (fn) => getProxyLogs().map(fn)
};

/**
 * Check if a log level should be output based on configuration
 * @param {string} level - Log level to check
 * @returns {boolean} True if should log
 */
function shouldLog(level) {
    const levelNum = LOG_LEVELS[level] ?? LOG_LEVELS.info;
    return levelNum <= CONFIGURED_LOG_LEVEL_NUM;
}

/**
 * Add log entry to circular buffer - O(1) operation
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {string} module - Source module name
 * @param {Object} data - Additional data
 */
function addToLogBuffer(level, message, module, data) {
    // Compact log entry - only include non-null data
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        module: module || 'app',
        message,
        source: 'proxy'
    };
    
    // Only spread data if it has properties (avoid empty object overhead)
    if (data && Object.keys(data).length > 0) {
        Object.assign(logEntry, data);
    }
    
    // O(1) circular buffer write
    proxyLogBuffer[proxyLogWriteIndex] = logEntry;
    proxyLogWriteIndex = (proxyLogWriteIndex + 1) % LOG_BUFFER_SIZE;
    proxyLogCount++;
}

/**
 * Redact sensitive information from objects before logging
 */
export function redactSensitiveData(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sensitiveFields = [
        'password', 'Password', 
        'token', 'accessToken', 'refreshToken',
        'apiKey', 'api_key', 'API_KEY',
        'secret', 'Secret',
        'authorization', 'Authorization',
        'cookie', 'Cookie',
        'x-api-key', 'x-csrf-token'
    ];
    
    const redacted = { ...obj };
    
    for (const field of sensitiveFields) {
        if (redacted[field]) {
            redacted[field] = '[REDACTED]';
        }
    }
    
    // Redact nested objects
    for (const key in redacted) {
        if (typeof redacted[key] === 'object' && redacted[key] !== null) {
            redacted[key] = redactSensitiveData(redacted[key]);
        }
    }
    
    return redacted;
}

/**
 * Safe logging function that redacts sensitive data
 * @param {string} level - Log level: 'error', 'warn', 'info', 'debug'
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log (optional)
 * @param {string} module - Source module name (optional, for tracing)
 * 
 * Usage examples:
 *   safeLog('info', 'Server started', { port: 3001 }, 'server');
 *   safeLog('error', 'Database connection failed', { error: err.message }, 'database');
 *   safeLog('debug', 'Processing request', { path: '/api/users' }, 'routes.users');
 */
export function safeLog(level, message, data = null, module = null) {
    // Extract module from data if provided there (backward compatibility)
    let moduleSource = module;
    let logData = data;
    
    if (data && typeof data === 'object' && data._module) {
        moduleSource = data._module;
        const { _module, ...rest } = data;
        logData = Object.keys(rest).length > 0 ? rest : null;
    }
    
    const redactedData = logData ? redactSensitiveData(logData) : null;
    
    // Add to log buffer for admin viewing (always, regardless of log level)
    addToLogBuffer(level, message, moduleSource, redactedData);
    
    // Check if this level should be logged based on configuration
    if (!shouldLog(level)) {
        return;
    }
    
    // Format timestamp
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    // Format module prefix
    const modulePrefix = moduleSource ? `[${moduleSource}] ` : '';
    
    // Format log line
    const logLine = `${timestamp} [${level.toUpperCase().padEnd(5)}] ${modulePrefix}${message}`;
    
    // Output based on level
    const consoleFn = level === 'error' ? console.error : 
                      level === 'warn' ? console.warn : 
                      console.log;
    
    consoleFn(logLine);
    
    // Output data on separate line if present (compact format for pre-production)
    if (redactedData) {
        const dataStr = JSON.stringify(redactedData);
        // Only expand JSON if it's complex or long
        if (dataStr.length > 100 || level === 'error') {
            consoleFn(JSON.stringify(redactedData, null, 2));
        } else {
            consoleFn(`  → ${dataStr}`);
        }
    }
}

/**
 * Create a logger instance for a specific module
 * This provides a convenient way to log with module context
 * @param {string} moduleName - Name of the module
 * @returns {Object} Logger with error, warn, info, debug methods
 * 
 * Usage:
 *   const log = createModuleLogger('database');
 *   log.info('Connection established', { host: 'localhost' });
 *   log.error('Query failed', { error: err.message });
 */
export function createModuleLogger(moduleName) {
    return {
        error: (message, data = null) => safeLog('error', message, data, moduleName),
        warn: (message, data = null) => safeLog('warn', message, data, moduleName),
        info: (message, data = null) => safeLog('info', message, data, moduleName),
        debug: (message, data = null) => safeLog('debug', message, data, moduleName)
    };
}

/**
 * Get proxy logs statistics - optimized to iterate buffer directly
 */
export function getProxyLogsStats() {
    const stats = {
        total: getProxyLogsCount(),
        byLevel: {},
        recent: {
            last24h: 0,
            lastHour: 0
        }
    };
    
    if (stats.total === 0) return stats;
    
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    
    // Iterate directly over buffer (avoid creating copy)
    const count = Math.min(proxyLogCount, LOG_BUFFER_SIZE);
    for (let i = 0; i < count; i++) {
        const log = proxyLogBuffer[i];
        if (!log) continue;
        
        stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
        
        const logTime = new Date(log.timestamp).getTime();
        if (logTime > oneDayAgo) stats.recent.last24h++;
        if (logTime > oneHourAgo) stats.recent.lastHour++;
    }
    
    return stats;
}
