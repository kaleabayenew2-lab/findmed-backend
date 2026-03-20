/**
 * Logger Utility for FindMed Backend
 * Provides structured logging with levels, timestamps, and context
 */

const fs = require('fs');
const path = require('path');

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

const DEFAULT_LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const ENABLE_API_LOGGING = process.env.ENABLE_API_LOGGING === 'true';
const LOG_DIR = path.join(__dirname, '..', '..', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Format timestamp to ISO string
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Get log level priority
 */
function getLevelPriority(level) {
  const priorities = {
    [LOG_LEVELS.ERROR]: 4,
    [LOG_LEVELS.WARN]: 3,
    [LOG_LEVELS.INFO]: 2,
    [LOG_LEVELS.DEBUG]: 1
  };
  return priorities[level] || 0;
}

/**
 * Check if log should be shown based on configured level
 */
function shouldLog(level) {
  return getLevelPriority(level) >= getLevelPriority(DEFAULT_LOG_LEVEL);
}

/**
 * Format log message
 */
function formatMessage(level, context, message, data = null) {
  const timestamp = getTimestamp();
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level}] [${context}] ${message}${dataStr}`;
}

/**
 * Write log to file
 */
function writeToFile(logFile, message) {
  try {
    const fullPath = path.join(LOG_DIR, logFile);
    fs.appendFileSync(fullPath, message + '\n', 'utf8');
  } catch (error) {
    console.error(`[Logger] Failed to write to file: ${error.message}`);
  }
}

/**
 * Core logger function
 */
function log(level, context, message, data = null) {
  if (!shouldLog(level)) return;

  const formatted = formatMessage(level, context, message, data);

  // Console output
  if (level === LOG_LEVELS.ERROR) {
    console.error(formatted);
  } else if (level === LOG_LEVELS.WARN) {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }

  // File output for errors and warnings
  if (level === LOG_LEVELS.ERROR) {
    writeToFile('error.log', formatted);
  }
  if (level === LOG_LEVELS.WARN) {
    writeToFile('warning.log', formatted);
  }
}

module.exports = {
  /**
   * Log an error
   * @param {string} context - Context/module name
   * @param {string} message - Log message
   * @param {any} data - Optional data to log
   */
  error: (context, message, data) => log(LOG_LEVELS.ERROR, context, message, data),

  /**
   * Log a warning
   * @param {string} context - Context/module name
   * @param {string} message - Log message
   * @param {any} data - Optional data to log
   */
  warn: (context, message, data) => log(LOG_LEVELS.WARN, context, message, data),

  /**
   * Log info
   * @param {string} context - Context/module name
   * @param {string} message - Log message
   * @param {any} data - Optional data to log
   */
  info: (context, message, data) => log(LOG_LEVELS.INFO, context, message, data),

  /**
   * Log debug
   * @param {string} context - Context/module name
   * @param {string} message - Log message
   * @param {any} data - Optional data to log
   */
  debug: (context, message, data) => log(LOG_LEVELS.DEBUG, context, message, data),

  /**
   * Log API request
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {object} headers - Request headers
   */
  logApiRequest: (method, url, headers = {}) => {
    if (!ENABLE_API_LOGGING) return;
    log(LOG_LEVELS.DEBUG, 'API_REQUEST', `${method} ${url}`, { headers });
  },

  /**
   * Log API response
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {number} status - Response status code
   * @param {number} duration - Request duration in ms
   */
  logApiResponse: (method, url, status, duration) => {
    if (!ENABLE_API_LOGGING) return;
    const level = status >= 400 ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
    log(level, 'API_RESPONSE', `${method} ${url}`, { status, durationMs: duration });
  },

  /**
   * Log API error
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {number} status - Response status code (if available)
   * @param {string} error - Error message
   */
  logApiError: (method, url, status, error) => {
    log(LOG_LEVELS.ERROR, 'API_ERROR', `${method} ${url}`, { status, error });
  }
};
