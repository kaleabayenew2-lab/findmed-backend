/**
 * Error Handler Utility for FindMed Backend
 * Standardized error response formatting and handling
 */

const logger = require('./logger');

/**
 * Standard error codes
 */
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER_ERROR: 'SERVER_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR'
};

/**
 * Map error to HTTP status code
 */
function getStatusCode(errorCode) {
  const statusMap = {
    [ERROR_CODES.VALIDATION_ERROR]: 400,
    [ERROR_CODES.AUTHENTICATION_ERROR]: 401,
    [ERROR_CODES.AUTHORIZATION_ERROR]: 403,
    [ERROR_CODES.NOT_FOUND]: 404,
    [ERROR_CODES.CONFLICT]: 409,
    [ERROR_CODES.RATE_LIMIT]: 429,
    [ERROR_CODES.TIMEOUT_ERROR]: 504,
    [ERROR_CODES.NETWORK_ERROR]: 503,
    [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 502,
    [ERROR_CODES.SERVER_ERROR]: 500
  };
  return statusMap[errorCode] || 500;
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(errorCode, defaultMessage = 'An error occurred') {
  const messages = {
    [ERROR_CODES.VALIDATION_ERROR]: 'Invalid input provided',
    [ERROR_CODES.AUTHENTICATION_ERROR]: 'Authentication failed',
    [ERROR_CODES.AUTHORIZATION_ERROR]: 'You do not have permission to access this resource',
    [ERROR_CODES.NOT_FOUND]: 'Resource not found',
    [ERROR_CODES.CONFLICT]: 'Resource conflict',
    [ERROR_CODES.RATE_LIMIT]: 'Too many requests, please try again later',
    [ERROR_CODES.TIMEOUT_ERROR]: 'Request timeout, please try again',
    [ERROR_CODES.NETWORK_ERROR]: 'Network error, please check your connection',
    [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'External service unavailable, please try again',
    [ERROR_CODES.SERVER_ERROR]: 'An internal server error occurred'
  };
  return messages[errorCode] || defaultMessage;
}

/**
 * Create standardized error response
 */
function createErrorResponse(errorCode, message, details = null) {
  return {
    success: false,
    error: {
      code: errorCode,
      message: message || getUserFriendlyMessage(errorCode),
      ...(process.env.NODE_ENV === 'development' && details && { details })
    }
  };
}

/**
 * Handle API error with logging and standardization
 */
function handleError(context, error, defaultCode = ERROR_CODES.SERVER_ERROR) {
  // Determine error code and status
  let errorCode = defaultCode;
  let statusCode = getStatusCode(errorCode);
  let message = error.message || 'An error occurred';
  let details = null;

  // Handle specific error types
  if (error.response) {
    // Axios response error
    statusCode = error.response.status;
    details = error.response.data;

    if (statusCode === 401) {
      errorCode = ERROR_CODES.AUTHENTICATION_ERROR;
    } else if (statusCode === 403) {
      errorCode = ERROR_CODES.AUTHORIZATION_ERROR;
    } else if (statusCode === 404) {
      errorCode = ERROR_CODES.NOT_FOUND;
    } else if (statusCode === 429) {
      errorCode = ERROR_CODES.RATE_LIMIT;
    } else if (statusCode >= 500) {
      errorCode = ERROR_CODES.EXTERNAL_SERVICE_ERROR;
      message = 'External service error';
    } else if (statusCode >= 400) {
      errorCode = ERROR_CODES.VALIDATION_ERROR;
    }
  } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    errorCode = ERROR_CODES.TIMEOUT_ERROR;
    statusCode = 504;
  } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    errorCode = ERROR_CODES.NETWORK_ERROR;
    statusCode = 503;
  } else if (error.statusCode) {
    statusCode = error.statusCode;
    if (statusCode === 401) errorCode = ERROR_CODES.AUTHENTICATION_ERROR;
    else if (statusCode === 403) errorCode = ERROR_CODES.AUTHORIZATION_ERROR;
    else if (statusCode === 404) errorCode = ERROR_CODES.NOT_FOUND;
  }

  // Log the error
  logger.error(context, message, {
    code: errorCode,
    statusCode,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });

  return {
    statusCode,
    response: createErrorResponse(errorCode, message, details)
  };
}

/**
 * Validation error handler
 */
function handleValidationError(context, errors) {
  const formattedErrors = Array.isArray(errors)
    ? errors.map(e => ({
        field: e.param || e.field || 'unknown',
        message: e.msg || e.message || 'Invalid value'
      }))
    : [{ message: errors }];

  logger.warn(context, 'Validation error', { errors: formattedErrors });

  return {
    statusCode: 400,
    response: {
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        errors: formattedErrors
      }
    }
  };
}

/**
 * Create custom error
 */
function createCustomError(message, code = ERROR_CODES.SERVER_ERROR, statusCode = null) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode || getStatusCode(code);
  return error;
}

module.exports = {
  ERROR_CODES,
  handleError,
  handleValidationError,
  createErrorResponse,
  getUserFriendlyMessage,
  getStatusCode,
  createCustomError,

  /**
   * Express error handling middleware
   */
  errorMiddleware: (err, req, res, next) => {
    const { statusCode, response } = module.exports.handleError('ErrorMiddleware', err);
    res.status(statusCode).json(response);
  }
};
