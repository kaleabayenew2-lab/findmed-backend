/**
 * HTTP Client for FindMed Backend
 * Axios instance with retry logic, timeout, and error handling
 */

const axios = require('axios');
const logger = require('./logger');

// Configuration from environment
const DEFAULT_TIMEOUT = parseInt(process.env.API_TIMEOUT || '10000', 10);
const MAX_RETRIES = parseInt(process.env.API_MAX_RETRIES || '3', 10);
const RETRY_DELAY_MS = parseInt(process.env.API_RETRY_DELAY_MS || '1000', 10);

/**
 * Calculate exponential backoff delay
 * @param {number} attemptNumber - Current attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
function getRetryDelay(attemptNumber) {
  // Exponential backoff: 1s, 2s, 4s, etc.
  return RETRY_DELAY_MS * Math.pow(2, attemptNumber);
}

/**
 * Check if error is retryable
 * @param {Error} error - Error object
 * @returns {boolean} True if error should be retried
 */
function isRetryableError(error) {
  if (!error.response) {
    // Network errors are retryable
    return true;
  }

  const status = error.response.status;
  // Retry on 408 (Request Timeout), 429 (Too Many Requests), 5xx errors
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Create axios instance with interceptors
 */
const httpClient = axios.create({
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Request interceptor - log outgoing requests
 */
httpClient.interceptors.request.use(
  (config) => {
    const startTime = Date.now();
    config.metadata = { startTime };

    logger.logApiRequest(config.method?.toUpperCase(), config.url, {
      timeout: config.timeout,
      retries: config.retries || MAX_RETRIES
    });

    return config;
  },
  (error) => {
    logger.error('HttpClient', 'Request interceptor error', error.message);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - log responses
 */
httpClient.interceptors.response.use(
  (response) => {
    const duration = Date.now() - response.config.metadata.startTime;
    logger.logApiResponse(
      response.config.method?.toUpperCase(),
      response.config.url,
      response.status,
      duration
    );
    return response;
  },
  (error) => {
    if (error.config?.metadata) {
      const duration = Date.now() - error.config.metadata.startTime;
      logger.logApiError(
        error.config.method?.toUpperCase(),
        error.config.url,
        error.response?.status,
        error.message
      );
    }
    return Promise.reject(error);
  }
);

/**
 * Make HTTP request with automatic retry logic
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} url - Request URL
 * @param {object} config - Axios config (data, headers, params, etc.)
 * @returns {Promise<AxiosResponse>}
 */
async function makeRequest(method, url, config = {}) {
  let lastError;
  const maxAttempts = Math.min(MAX_RETRIES, 5); // Cap at 5 retries

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      const response = await httpClient({
        method,
        url,
        ...config,
        retries: maxAttempts - attempt
      });
      return response;
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error)) {
        // Don't retry non-retryable errors
        throw error;
      }

      if (attempt < maxAttempts) {
        const delay = getRetryDelay(attempt);
        logger.warn('HttpClient', `Retry attempt ${attempt + 1}/${maxAttempts} after ${delay}ms`, {
          url,
          error: error.message,
          status: error.response?.status
        });

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  logger.error('HttpClient', `All ${maxAttempts} retry attempts failed`, {
    url,
    finalError: lastError.message
  });
  throw lastError;
}

module.exports = {
  /**
   * Make GET request
   */
  get: (url, config) => makeRequest('GET', url, config),

  /**
   * Make POST request
   */
  post: (url, data, config) => makeRequest('POST', url, { ...config, data }),

  /**
   * Make PUT request
   */
  put: (url, data, config) => makeRequest('PUT', url, { ...config, data }),

  /**
   * Make PATCH request
   */
  patch: (url, data, config) => makeRequest('PATCH', url, { ...config, data }),

  /**
   * Make DELETE request
   */
  delete: (url, config) => makeRequest('DELETE', url, config),

  /**
   * Make generic request with custom method
   */
  request: makeRequest,

  /**
   * Get raw axios instance (for custom configurations)
   */
  axiosInstance: httpClient,

  /**
   * Configuration getters
   */
  config: {
    defaultTimeout: DEFAULT_TIMEOUT,
    maxRetries: MAX_RETRIES,
    retryDelayMs: RETRY_DELAY_MS,
    getRetryDelay
  }
};
