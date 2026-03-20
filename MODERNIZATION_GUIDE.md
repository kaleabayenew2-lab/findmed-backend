# FindMed Backend Modernization Guide

## Overview

This guide documents the modernization of the FindMed backend with enterprise-grade patterns for robust API handling, error management, and sequential execution.

## Key Improvements

### 1. ✅ HTTP Client with Retry Logic (`src/utils/httpClient.js`)

**Features:**
- Automatic retry with exponential backoff
- Configurable timeout (default: 10 seconds)
- Maximum 3 retries by default
- Request/response logging
- Error normalization

**Usage:**
```javascript
const httpClient = require('../utils/httpClient');

// GET request with automatic retry
const response = await httpClient.get('https://api.example.com/data');

// POST request with custom timeout
const response = await httpClient.post('https://api.example.com/data', 
  { data: 'value' },
  { timeout: 5000 }
);
```

**Retry Strategy:**
- Attempt 1: Immediate
- Attempt 2: After 1 second
- Attempt 3: After 2 seconds
- Attempt 4: After 4 seconds

### 2. ✅ Error Handler (`src/utils/errorHandler.js`)

**Features:**
- Standardized error response formatting
- Error code mapping
- User-friendly error messages
- Production-safe error handling
- Validation error support

**Error Codes:**
```javascript
{
  VALIDATION_ERROR: 400,
  AUTHENTICATION_ERROR: 401,
  AUTHORIZATION_ERROR: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  TIMEOUT_ERROR: 504,
  NETWORK_ERROR: 503,
  EXTERNAL_SERVICE_ERROR: 502,
  SERVER_ERROR: 500
}
```

**Usage:**
```javascript
const errorHandler = require('../utils/errorHandler');

try {
  // Some operation
} catch (error) {
  const { statusCode, response } = errorHandler.handleError('ContextName', error);
  res.status(statusCode).json(response);
}
```

### 3. ✅ Logger (`src/utils/logger.js`)

**Features:**
- Structured logging with levels
- Timestamp tracking
- File logging for errors and warnings
- Request/response logging
- Development vs production modes

**Log Levels:**
- ERROR: Critical issues
- WARN: Warnings
- INFO: Information
- DEBUG: Debug details

**Usage:**
```javascript
const logger = require('../utils/logger');

logger.info('MyContext', 'Operation completed', { userId: 123 });
logger.warn('MyContext', 'Something unexpected', { data: value });
logger.error('MyContext', 'Error occurred', error);
logger.debug('MyContext', 'Debug info', { details: 'value' });
```

### 4. ✅ Centralized API Service (`src/services/apiService.js`)

**Features:**
- Sequential API execution (IMPORTANT for consistency)
- Combined external API wrapper functions
- Retry and timeout support
- Comprehensive error handling
- Health checks for external services

**Functions:**

#### Sequential Execution
```javascript
const apiService = require('../services/apiService');

const results = await apiService.executeSequential([
  {
    name: 'google-verify',
    fn: () => apiService.verifyGoogleToken(token)
  },
  {
    name: 'send-notification',
    fn: () => apiService.sendFCMNotification(deviceToken, notification)
  }
]);
```

#### Google OAuth
```javascript
const result = await apiService.verifyGoogleToken(idToken);
if (result.success) {
  const { userId, email } = result.data;
}
```

#### Firebase Cloud Messaging
```javascript
const result = await apiService.sendFCMNotification(deviceToken, {
  title: 'Hello',
  body: 'Message',
  data: { key: 'value' }
}, { priority: 'high', timeout: 10000 });
```

#### Telegram API
```javascript
const result = await apiService.sendTelegramMessage(chatId, 'Hello message');
if (result.success) {
  const { messageId } = result.data;
}
```

#### Bot API
```javascript
const result = await apiService.sendBotApiRequest('/endpoint', 'POST', {
  data: 'value'
});
```

#### Health Checks
```javascript
// Single service health check
const health = await apiService.checkServiceHealth('google-oauth');

// All services health check
const summary = await apiService.checkAllServicesHealth();
// Returns: { timestamp, totalServices, healthyServices, services: {...} }
```

### 5. ✅ Updated Push Notifications (`src/utils/pushNotifications.js`)

**Features:**
- Modern API service integration
- Sequential notification sending
- Batch push support
- Comprehensive error handling and logging

**Usage:**
```javascript
const pushNotifications = require('../utils/pushNotifications');

// Single user
await pushNotifications.sendPushToUserId(userId, 'Title', 'Body', { data: 'value' });

// Batch send
await pushNotifications.sendBatchPush([userId1, userId2], 'Title', 'Body');

// Direct token
await pushNotifications.sendNotificationToToken(deviceToken, {
  title: 'Title',
  body: 'Body',
  data: { key: 'value' }
});
```

### 6. ✅ Updated Controllers

**Users Controller (`src/controllers/usersController.js`):**
- Modern Google OAuth verification with retries
- Telegram OTP sending with error handling
- Structured logging throughout
- Try-catch blocks for all async operations
- Standardized error responses

### 7. ✅ Environment Variables

**New Configuration:**
```env
# API Service Configuration
API_TIMEOUT=10000                    # Timeout in ms
API_MAX_RETRIES=3                    # Max retry attempts
API_RETRY_DELAY_MS=1000              # Initial retry delay
ENABLE_API_LOGGING=false             # Debug logging
LOG_LEVEL=INFO                       # Logging level
```

## Implementation Guidelines

### When Building New Features

1. **Use the centralized API service** for all external API calls
   ```javascript
   const apiService = require('../services/apiService');
   ```

2. **Use the logger** for all logging
   ```javascript
   const logger = require('../utils/logger');
   ```

3. **Use error handler** for standardized error responses
   ```javascript
   const errorHandler = require('../utils/errorHandler');
   ```

4. **Wrap async operations** in try-catch blocks
   ```javascript
   try {
     // async operation
   } catch (error) {
     const { statusCode, response } = errorHandler.handleError('Context', error);
     res.status(statusCode).json(response);
   }
   ```

### Sequential Operations Pattern

When multiple operations must run in order and depend on each other:

```javascript
const results = await apiService.executeSequential([
  {
    name: 'verify-token',
    fn: () => apiService.verifyGoogleToken(token)
  },
  {
    name: 'update-user',
    fn: () => User.findByIdAndUpdate(userId, { email })
  },
  {
    name: 'send-notification',
    fn: () => pushNotifications.sendPushToUserId(userId, 'Welcome')
  }
]);

if (results.hasErrors) {
  // Handle partial failures
}
```

### Error Handling Pattern

```javascript
exports.myEndpoint = async (req, res) => {
  try {
    const { requiredField } = req.body;

    // Validate input
    if (!requiredField) {
      logger.warn('MyController', 'Missing required field');
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required field'
        }
      });
    }

    // Call external API using centralized service
    const apiResult = await apiService.externalApiCall(requiredField);
    if (!apiResult.success) {
      logger.error('MyController', 'External API failed', {
        error: apiResult.error
      });
      return res.status(apiResult.statusCode).json(apiResult.error);
    }

    // Success response
    logger.info('MyController', 'Operation completed successfully');
    res.json({ success: true, data: apiResult.data });

  } catch (error) {
    const { statusCode, response } = errorHandler.handleError(
      'MyController',
      error
    );
    res.status(statusCode).json(response);
  }
};
```

## Testing External APIs

### Health Check Endpoint

Add this to your routes to monitor external services:

```javascript
app.get('/api/health/services', async (req, res) => {
  try {
    const health = await apiService.checkAllServicesHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Manual Testing

```javascript
// Test Google OAuth
const googleResult = await apiService.verifyGoogleToken('token');

// Test FCM
const fcmResult = await apiService.sendFCMNotification('device-token', {
  title: 'Test',
  body: 'Test notification'
});

// Test Telegram
const telegramResult = await apiService.sendTelegramMessage('chat-id', 'Test message');

// Test Bot API
const botResult = await apiService.sendBotApiRequest('/test', 'GET');
```

## Migration Checklist

- [x] Create HTTP client with retry logic
- [x] Create error handler utility
- [x] Create logger utility
- [x] Create centralized API service
- [x] Update push notifications module
- [x] Update users controller (Google OAuth, Telegram OTP)
- [ ] Update remaining controllers (facilities, chat, ads, etc.)
- [ ] Update all external API calls to use centralized service
- [ ] Add comprehensive logging throughout
- [ ] Update environment configuration
- [ ] Test all endpoints
- [ ] Test retry logic with simulated failures
- [ ] Monitor logs in production

## Performance Benefits

1. **Reduced Cascading Failures** - Retries handle transient network issues
2. **Better Error Tracking** - Structured logging helps debugging
3. **Improved User Experience** - Timeouts prevent hanging requests
4. **Data Consistency** - Sequential APIs prevent race conditions
5. **Easier Maintenance** - Centralized service layer simplifies updates

## Troubleshooting

### API calls timing out
- Increase `API_TIMEOUT` in environment
- Check network connectivity
- Verify external service is responding

### Retry loops not working
- Verify `API_MAX_RETRIES` is set
- Check that error is retryable (network, 5xx, 429)
- Review logs for retry attempts

### Missing logs
- Check `LOG_LEVEL` in environment
- Enable `ENABLE_API_LOGGING=true` for API details
- Verify `logs/` directory exists and is writable

### External service failing
- Use health check endpoint to diagnose
- Verify API keys and tokens in environment
- Check service configuration and connectivity

## Next Steps

1. Test the modernized backend thoroughly
2. Monitor logs in production
3. Apply same patterns to remaining controllers
4. Consider circuit breaker pattern for very critical services
5. Add rate limiting to external API calls if needed
