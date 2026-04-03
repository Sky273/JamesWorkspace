/**
 * Logging utility for PDF server
 */

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CONFIGURED_LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const CONFIGURED_LOG_LEVEL_NUM = LOG_LEVELS[CONFIGURED_LOG_LEVEL] ?? LOG_LEVELS.info;

function safeSerializeLogData(data) {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  try {
    return JSON.stringify(data);
  } catch (error) {
    return JSON.stringify({
      serializationError: error.message,
      type: Object.prototype.toString.call(data)
    });
  }
}

function log(level, message, data = null) {
  if (LOG_LEVELS[level] > CONFIGURED_LOG_LEVEL_NUM) return;
  
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const prefix = `${timestamp} [${level.toUpperCase().padEnd(5)}] [pdf-server]`;
  
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  
  if (data) {
    logFn(`${prefix} ${message}`, safeSerializeLogData(data));
  } else {
    logFn(`${prefix} ${message}`);
  }
}

module.exports = { log, LOG_LEVELS, safeSerializeLogData };
