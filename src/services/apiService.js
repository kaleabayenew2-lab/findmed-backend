/**
 * Centralized API Service for FindMed Backend
 * Consolidates all external API calls with retry logic and error handling
 * Features: Sequential execution, retry with backoff, timeout, comprehensive logging
 */

const httpClient = require('../utils/httpClient');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');

const CONTEXT = 'ApiService';

/**
 * Execute multiple API calls sequentially (IMPORTANT for data consistency)
 * @param {Array<{name: string, fn: Function}>} calls - Array of {name, fn} to execute sequentially
 * @returns {Promise<Array>} Results in order
 */
async function executeSequential(calls) {
  const results = [];
  const errors = [];

  for (const call of calls) {
    try {
      logger.info(CONTEXT, `Executing sequential call: ${call.name}`);
      const result = await call.fn();
      results.push({ name: call.name, success: true, data: result });
    } catch (error) {
      const errorInfo = { name: call.name, success: false, error: error.message };
      results.push(errorInfo);
      errors.push(errorInfo);

      // Continue with next call even if one fails (for partial success scenarios)
      logger.warn(CONTEXT, `Sequential call failed: ${call.name}`, { error: error.message });
    }
  }

  return { results, errors, hasErrors: errors.length > 0 };
}

/**
 * Google OAuth Token Verification
 * Verifies Google ID token and returns user info
 */
async function verifyGoogleToken(token) {
  try {
    logger.info(CONTEXT, 'Verifying Google OAuth token');

    const response = await httpClient.get(
      'https://www.googleapis.com/oauth2/v1/tokeninfo',
      { params: { access_token: token } }
    );

    return {
      success: true,
      data: {
        userId: response.data.user_id,
        email: response.data.email,
        verifiedEmail: response.data.verified_email
      }
    };
  } catch (error) {
    const { statusCode, response } = errorHandler.handleError(
      CONTEXT,
      error,
      errorHandler.ERROR_CODES.AUTHENTICATION_ERROR
    );
    return { success: false, statusCode, error: response };
  }
}

/**
 * Firebase Cloud Messaging - Send Push Notification
 * Sends notification to device via FCM
 */
async function sendFCMNotification(deviceToken, notification, options = {}) {
  try {
    const {
      priority = 'high',
      retries = true,
      timeout = 10000
    } = options;

    logger.info(CONTEXT, 'Sending FCM notification', {
      deviceToken: deviceToken.substring(0, 20) + '...',
      priority
    });

    const fcmUrl = 'https://fcm.googleapis.com/fcm/send';
    const serverKey = process.env.FCM_SERVER_KEY;

    if (!serverKey) {
      throw errorHandler.createCustomError(
        'FCM_SERVER_KEY not configured',
        errorHandler.ERROR_CODES.SERVER_ERROR
      );
    }

    const response = await httpClient.post(
      fcmUrl,
      {
        to: deviceToken,
        priority,
        notification: {
          title: notification.title,
          body: notification.body,
          sound: 'default',
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        data: notification.data || {}
      },
      {
        headers: {
          'Authorization': `key=${serverKey}`,
          'Content-Type': 'application/json'
        },
        timeout
      }
    );

    if (response.data.success === 0) {
      throw new Error(`FCM failed: ${response.data.failure || 'Unknown error'}`);
    }

    logger.info(CONTEXT, 'FCM notification sent successfully', {
      messageId: response.data.results?.[0]?.message_id
    });

    return {
      success: true,
      data: {
        messageId: response.data.results?.[0]?.message_id,
        success: response.data.success,
        failure: response.data.failure
      }
    };
  } catch (error) {
    const { statusCode, response } = errorHandler.handleError(
      CONTEXT,
      error,
      errorHandler.ERROR_CODES.EXTERNAL_SERVICE_ERROR
    );
    return { success: false, statusCode, error: response };
  }
}

/**
 * Bot API - Generic Request Handler
 * Send requests to bot service with retry and timeout
 */
async function sendBotApiRequest(endpoint, method = 'GET', data = null, options = {}) {
  try {
    const {
      timeout = 10000,
      headers = {}
    } = options;

    const botApiUrl = process.env.BOT_API_URL;
    if (!botApiUrl) {
      throw errorHandler.createCustomError(
        'BOT_API_URL not configured',
        errorHandler.ERROR_CODES.SERVER_ERROR
      );
    }

    const url = `${botApiUrl}${endpoint}`;
    logger.info(CONTEXT, `Sending Bot API request: ${method} ${endpoint}`);

    let response;
    if (method === 'GET') {
      response = await httpClient.get(url, { timeout, headers });
    } else if (method === 'POST') {
      response = await httpClient.post(url, data, { timeout, headers });
    } else if (method === 'PUT') {
      response = await httpClient.put(url, data, { timeout, headers });
    } else if (method === 'DELETE') {
      response = await httpClient.delete(url, { timeout, headers });
    }

    logger.info(CONTEXT, `Bot API request completed: ${method} ${endpoint}`, {
      status: response.status
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    const { statusCode, response } = errorHandler.handleError(
      CONTEXT,
      error,
      errorHandler.ERROR_CODES.EXTERNAL_SERVICE_ERROR
    );
    return { success: false, statusCode, error: response };
  }
}

/**
 * Telegram API - Send Message
 * Send message via Telegram bot
 */
async function sendTelegramMessage(chatId, message, options = {}) {
  try {
    const {
      parseMode = 'HTML',
      timeout = 10000
    } = options;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw errorHandler.createCustomError(
        'TELEGRAM_BOT_TOKEN not configured',
        errorHandler.ERROR_CODES.SERVER_ERROR
      );
    }

    logger.info(CONTEXT, 'Sending Telegram message', { chatId });

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await httpClient.post(
      url,
      {
        chat_id: chatId,
        text: message,
        parse_mode: parseMode
      },
      { timeout }
    );

    logger.info(CONTEXT, 'Telegram message sent', {
      messageId: response.data.result?.message_id
    });

    return {
      success: true,
      data: {
        messageId: response.data.result?.message_id,
        chatId: response.data.result?.chat?.id
      }
    };
  } catch (error) {
    const { statusCode, response } = errorHandler.handleError(
      CONTEXT,
      error,
      errorHandler.ERROR_CODES.EXTERNAL_SERVICE_ERROR
    );
    return { success: false, statusCode, error: response };
  }
}

/**
 * External Service Health Check
 * Verify connectivity to critical external services
 */
async function checkServiceHealth(serviceName) {
  try {
    logger.info(CONTEXT, `Health check for service: ${serviceName}`);

    let url;
    switch (serviceName) {
      case 'google-oauth':
        url = 'https://www.googleapis.com/oauth2/v1/tokeninfo';
        break;
      case 'fcm':
        url = 'https://fcm.googleapis.com/fcm/send';
        break;
      case 'telegram':
        url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`;
        break;
      case 'bot-api':
        url = process.env.BOT_API_URL;
        break;
      default:
        return { success: false, error: 'Unknown service' };
    }

    const response = await httpClient.get(url, { timeout: 5000 });
    logger.info(CONTEXT, `Service health check passed: ${serviceName}`);

    return {
      success: true,
      status: 'healthy',
      statusCode: response.status
    };
  } catch (error) {
    logger.warn(CONTEXT, `Service health check failed: ${serviceName}`, {
      error: error.message
    });
    return {
      success: false,
      status: 'unhealthy',
      error: error.message
    };
  }
}

/**
 * Batch Health Check - Check multiple services
 * Execute sequential health checks for all critical services
 */
async function checkAllServicesHealth() {
  const services = [
    'google-oauth',
    'fcm',
    'telegram',
    'bot-api'
  ];

  const calls = services.map(service => ({
    name: `health-${service}`,
    fn: () => checkServiceHealth(service)
  }));

  const results = await executeSequential(calls);

  const summary = {
    timestamp: new Date().toISOString(),
    totalServices: services.length,
    healthyServices: results.results.filter(r => r.data?.success).length,
    services: {}
  };

  results.results.forEach(result => {
    summary.services[result.name] = result.data;
  });

  return summary;
}

module.exports = {
  // Sequential execution
  executeSequential,

  // Google OAuth
  verifyGoogleToken,

  // Firebase Cloud Messaging
  sendFCMNotification,

  // Bot API
  sendBotApiRequest,

  // Telegram
  sendTelegramMessage,

  // Health checks
  checkServiceHealth,
  checkAllServicesHealth
};
