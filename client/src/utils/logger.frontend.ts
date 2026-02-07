/**
 * Frontend Logger Utility
 * Provides structured logging with module context and log levels
 * 
 * Features:
 * - Module-based logging for easy tracing
 * - Log levels: error, warn, info, debug
 * - Development vs production mode handling
 * - Formatted output with timestamps
 * - Data redaction for sensitive fields
 * - Rate limiting to prevent spam
 * 
 * Log Level Guidelines:
 * - ERROR: Critical failures that break functionality (API errors, crashes)
 * - WARN: Recoverable issues, deprecations, fallbacks used
 * - INFO: Key user actions, state changes, navigation (sparse, meaningful)
 * - DEBUG: Detailed debugging info, data dumps, timing (dev only)
 */

// ============================================
// CONFIGURATION
// ============================================

const isDev = import.meta.env.DEV;

// Log levels hierarchy (lower = higher priority)
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

// Configured log level (from env or default)
// Production: 'error' (only critical errors)
// Pre-production: 'warn' (errors and warnings)
// Development: 'info' (errors, warnings, key info - not debug spam)
const CONFIGURED_LEVEL: LogLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || (isDev ? 'info' : 'error');
const CONFIGURED_LEVEL_NUM = LOG_LEVELS[CONFIGURED_LEVEL] ?? LOG_LEVELS.info;

// Sensitive fields to redact in logs
const SENSITIVE_FIELDS = [
  'password', 'token', 'accessToken', 'refreshToken',
  'apiKey', 'api_key', 'secret', 'authorization',
  'cookie', 'csrf', 'creditCard', 'ssn'
];

// Rate limiting to prevent log spam
const LOG_RATE_LIMIT_MS = 100; // Min ms between identical logs
const RECENT_LOGS_MAX_SIZE = 1000; // Max entries to prevent memory leak
const recentLogs = new Map<string, number>();

// Periodic cleanup of old log entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const expiryTime = 60000; // 1 minute expiry for rate limit entries
  
  for (const [key, timestamp] of recentLogs.entries()) {
    if (now - timestamp > expiryTime) {
      recentLogs.delete(key);
    }
  }
  
  // Enforce max size if still too large
  if (recentLogs.size > RECENT_LOGS_MAX_SIZE) {
    const entries = [...recentLogs.entries()].sort((a, b) => a[1] - b[1]);
    const toRemove = entries.slice(0, recentLogs.size - RECENT_LOGS_MAX_SIZE);
    toRemove.forEach(([key]) => recentLogs.delete(key));
  }
}, 5 * 60 * 1000);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= CONFIGURED_LEVEL_NUM;
}

/**
 * Format timestamp for log output
 */
function formatTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(11, 19);
}

/**
 * Redact sensitive data from objects
 */
function redactSensitive(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(item => redactSensitive(item));
  }
  
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitive(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Format log prefix with level and module
 */
function formatPrefix(level: LogLevel, module?: string): string {
  const time = formatTimestamp();
  const levelStr = level.toUpperCase().padEnd(5);
  const moduleStr = module ? `[${module}]` : '';
  return `${time} [${levelStr}] ${moduleStr}`;
}

// ============================================
// LOGGER INTERFACE
// ============================================

export interface ModuleLogger {
  error: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  debug: (message: string, data?: unknown) => void;
  log: (message: string, data?: unknown) => void; // Alias for info (backward compatibility)
}

export interface Logger extends ModuleLogger {
  group: (label: string) => void;
  groupEnd: () => void;
  table: (data: unknown) => void;
}

// ============================================
// CORE LOGGING FUNCTION
// ============================================

/**
 * Check if this log should be rate-limited (prevent spam)
 */
function isRateLimited(key: string): boolean {
  const now = Date.now();
  const lastLog = recentLogs.get(key);
  
  if (lastLog && (now - lastLog) < LOG_RATE_LIMIT_MS) {
    return true;
  }
  
  recentLogs.set(key, now);
  
  // Clean old entries periodically (keep map small)
  if (recentLogs.size > 100) {
    const cutoff = now - LOG_RATE_LIMIT_MS * 10;
    for (const [k, v] of recentLogs.entries()) {
      if (v < cutoff) recentLogs.delete(k);
    }
  }
  
  return false;
}

/**
 * Core log function with level, module, message and optional data
 * Includes rate limiting to prevent spam from repeated identical logs
 */
function log(level: LogLevel, module: string | undefined, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;
  
  // Rate limit identical messages (except errors which are always shown)
  if (level !== 'error') {
    const logKey = `${level}:${module || ''}:${message}`;
    if (isRateLimited(logKey)) return;
  }
  
  const prefix = formatPrefix(level, module);
  const redactedData = data ? redactSensitive(data) : undefined;
  
  const consoleFn = level === 'error' ? console.error :
                    level === 'warn' ? console.warn :
                    level === 'debug' ? console.debug :
                    console.log;
  
  if (redactedData !== undefined) {
    // For objects, show on same line if small, otherwise expand
    const dataStr = JSON.stringify(redactedData);
    if (dataStr.length < 80) {
      consoleFn(`${prefix} ${message}`, redactedData);
    } else {
      consoleFn(`${prefix} ${message}`);
      consoleFn(redactedData);
    }
  } else {
    consoleFn(`${prefix} ${message}`);
  }
}

// ============================================
// EXPORTED LOGGER
// ============================================

/**
 * Default logger (no module context)
 * Use createLogger('moduleName') for module-specific logging
 */
export const logger: Logger = {
  error: (message: string, data?: unknown) => log('error', undefined, message, data),
  warn: (message: string, data?: unknown) => log('warn', undefined, message, data),
  info: (message: string, data?: unknown) => log('info', undefined, message, data),
  debug: (message: string, data?: unknown) => log('debug', undefined, message, data),
  log: (message: string, data?: unknown) => log('info', undefined, message, data), // Alias for info
  
  group: (label: string): void => {
    if (shouldLog('debug')) console.group(label);
  },
  
  groupEnd: (): void => {
    if (shouldLog('debug')) console.groupEnd();
  },
  
  table: (data: unknown): void => {
    if (shouldLog('debug')) console.table(data);
  }
};

/**
 * Create a logger instance for a specific module
 * Provides consistent module context for all logs
 * 
 * @example
 * const log = createLogger('AuthService');
 * log.info('User logged in', { userId: '123' });
 * // Output: 10:15:30 [INFO ] [AuthService] User logged in { userId: '123' }
 */
export function createLogger(moduleName: string): ModuleLogger {
  return {
    error: (message: string, data?: unknown) => log('error', moduleName, message, data),
    warn: (message: string, data?: unknown) => log('warn', moduleName, message, data),
    info: (message: string, data?: unknown) => log('info', moduleName, message, data),
    debug: (message: string, data?: unknown) => log('debug', moduleName, message, data),
    log: (message: string, data?: unknown) => log('info', moduleName, message, data) // Alias for info
  };
}

export default logger;
