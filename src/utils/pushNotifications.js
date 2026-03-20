/**
 * Push Notifications Utility for FindMed Backend
 * Modern implementation using centralized API service with retry logic and error handling
 */

const User = require('../models/user');
const ChatMessage = require('../models/chatMessage');
const apiService = require('../services/apiService');
const logger = require('./logger');
const errorHandler = require('./errorHandler');

const CONTEXT = 'PushNotifications';

/**
 * Send push notification to device token
 * Uses centralized API service with automatic retry and timeout
 * @param {string} token - Device token
 * @param {object} notification - Notification object {title, body, data}
 * @returns {Promise<object>} Result object
 */
async function sendNotificationToToken(token, notification) {
  try {
    if (!token) {
      logger.warn(CONTEXT, 'Empty device token provided');
      return { success: false, error: 'Invalid token' };
    }

    logger.info(CONTEXT, 'Sending FCM notification to token', {
      tokenPreview: token.substring(0, 20) + '...'
    });

    const result = await apiService.sendFCMNotification(token, notification, {
      priority: 'high',
      timeout: 10000
    });

    if (result.success) {
      logger.info(CONTEXT, 'FCM notification sent successfully');
    } else {
      logger.error(CONTEXT, 'FCM notification failed', result.error);
    }

    return result;
  } catch (error) {
    logger.error(CONTEXT, 'sendNotificationToToken error', error.message);
    return {
      success: false,
      error: 'Failed to send notification'
    };
  }
}

/**
 * Send push notification to user by userId
 * Gets user device tokens and sends notifications with error handling
 * @param {string} userId - User ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional notification data
 * @returns {Promise<object>} Result with success status and details
 */
async function sendPushToUserId(userId, title, body, data = {}) {
  try {
    if (!userId || !title || !body) {
      logger.warn(CONTEXT, 'Missing required parameters for push notification');
      return {
        success: false,
        error: 'Missing required parameters'
      };
    }

    logger.info(CONTEXT, `Sending push to user: ${userId}`, {
      title,
      hasData: !!data
    });

    // Fetch user and device tokens
    let user;
    try {
      user = await User.findOne({ userId }) || await User.findById(userId);
    } catch (error) {
      logger.error(CONTEXT, 'Failed to fetch user', { userId, error: error.message });
      return {
        success: false,
        error: 'User not found'
      };
    }

    if (!user) {
      logger.warn(CONTEXT, 'User not found', { userId });
      return {
        success: false,
        error: 'User not found'
      };
    }

    // Get valid device tokens
    const tokens = (user.deviceTokens || [])
      .map(t => t.token)
      .filter(t => Boolean(t));

    if (!tokens.length) {
      logger.warn(CONTEXT, 'No device tokens for user', { userId });
      return {
        success: false,
        error: 'No device tokens found'
      };
    }

    // Calculate unread message count for badge
    let unreadCount = 0;
    try {
      unreadCount = await ChatMessage.countDocuments({
        to: userId,
        read: false
      }).catch(() => 0);
    } catch (error) {
      logger.warn(CONTEXT, 'Failed to fetch unread count', { error: error.message });
    }

    // Build notification payload
    const notification = {
      title,
      body,
      data: {
        ...data,
        badge: unreadCount.toString()
      }
    };

    // Send notification to all tokens sequentially to avoid race conditions
    const sendCalls = tokens.map((token, index) => ({
      name: `notification-${index}`,
      fn: () => sendNotificationToToken(token, notification)
    }));

    const results = await apiService.executeSequential(sendCalls);

    const successCount = results.results.filter(r => r.data?.success).length;
    const totalAttempts = tokens.length;

    logger.info(CONTEXT, `Push notifications sent`, {
      userId,
      successCount,
      totalAttempts
    });

    return {
      success: successCount > 0,
      totalAttempts,
      successCount,
      failureCount: totalAttempts - successCount,
      details: results.results
    };
  } catch (error) {
    logger.error(CONTEXT, 'sendPushToUserId error', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send push notification to multiple users
 * Batch send notifications with error handling
 * @param {Array<string>} userIds - Array of user IDs
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional notification data
 * @returns {Promise<object>} Result with summary
 */
async function sendBatchPush(userIds, title, body, data = {}) {
  try {
    if (!Array.isArray(userIds) || !userIds.length) {
      logger.warn(CONTEXT, 'Invalid userIds for batch push');
      return {
        success: false,
        error: 'Invalid user IDs'
      };
    }

    logger.info(CONTEXT, `Sending batch push to ${userIds.length} users`, { title });

    const sendCalls = userIds.map((userId, index) => ({
      name: `batch-${index}`,
      fn: () => sendPushToUserId(userId, title, body, data)
    }));

    const results = await apiService.executeSequential(sendCalls);

    const successCount = results.results.filter(r => r.data?.success).length;
    const totalCount = userIds.length;

    logger.info(CONTEXT, `Batch push completed`, {
      totalUsers: totalCount,
      successCount,
      failureCount: totalCount - successCount
    });

    return {
      success: successCount > 0,
      totalUsers: totalCount,
      successCount,
      failureCount: totalCount - successCount,
      details: results.results
    };
  } catch (error) {
    logger.error(CONTEXT, 'sendBatchPush error', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendPushToUserId,
  sendNotificationToToken,
  sendBatchPush
};
