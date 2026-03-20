# Quick Start - Modern Backend Patterns

## 5-Minute Overview

Your FindMed backend now includes modern patterns for API handling, error management, and logging.

## The Four Core Utilities

### 1. HTTP Client (Automatic Retry)
```javascript
const httpClient = require('../utils/httpClient');

// Any external API call - automatically retries on failure
const response = await httpClient.get('https://api.example.com/data');
```

### 2. Error Handler (Standardized Responses)
```javascript
const errorHandler = require('../utils/errorHandler');

try {
  // Do something
} catch (error) {
  const { statusCode, response } = errorHandler.handleError('MyContext', error);
  res.status(statusCode).json(response);
}
```

### 3. Logger (Structured Logging)
```javascript
const logger = require('../utils/logger');

logger.info('MyContext', 'Message', { data: 'value' });
logger.error('MyContext', 'Error occurred', error);
```

### 4. API Service (Centralized External APIs)
```javascript
const apiService = require('../services/apiService');

// Google OAuth
const result = await apiService.verifyGoogleToken(idToken);

// FCM notifications
await apiService.sendFCMNotification(deviceToken, { title, body });

// Telegram messages
await apiService.sendTelegramMessage(chatId, message);

// Sequential execution
const results = await apiService.executeSequential([
  { name: 'op1', fn: () => operation1() },
  { name: 'op2', fn: () => operation2() }
]);
```

## Standard Controller Pattern

```javascript
const apiService = require('../services/apiService');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');

const CONTEXT = 'MyController';

exports.myEndpoint = async (req, res) => {
  try {
    const { requiredField } = req.body;

    // Validate input
    if (!requiredField) {
      logger.warn(CONTEXT, 'Missing required field');
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required field'
        }
      });
    }

    // Call external API (with automatic retry)
    const apiResult = await apiService.verifyGoogleToken(requiredField);
    if (!apiResult.success) {
      logger.error(CONTEXT, 'API call failed', apiResult.error);
      return res.status(apiResult.statusCode).json(apiResult.error);
    }

    // Success
    logger.info(CONTEXT, 'Operation completed');
    res.json({ success: true, data: apiResult.data });

  } catch (error) {
    const { statusCode, response } = errorHandler.handleError(CONTEXT, error);
    res.status(statusCode).json(response);
  }
};
```

## What You Get

✅ **Automatic Retries** - Failed requests retry 3 times with backoff
✅ **Timeout Protection** - All requests timeout after 10 seconds
✅ **Structured Logging** - All operations logged with timestamps and context
✅ **Error Handling** - Consistent, user-friendly error responses
✅ **Sequential Execution** - Multiple operations in order without race conditions
✅ **Health Checks** - Monitor external service connectivity

## Environment Variables

```env
# API Configuration (all optional - these are defaults)
API_TIMEOUT=10000              # Timeout in milliseconds
API_MAX_RETRIES=3              # Number of retry attempts
API_RETRY_DELAY_MS=1000        # Initial delay between retries
ENABLE_API_LOGGING=false       # Debug API calls
LOG_LEVEL=INFO                 # ERROR, WARN, INFO, DEBUG
```

## Common Tasks

### Task 1: Call an External API (with Retries)
```javascript
const httpClient = require('../utils/httpClient');

const response = await httpClient.post('https://api.example.com/endpoint', {
  data: 'value'
}, { timeout: 5000 });

console.log(response.data);
```

### Task 2: Verify Google Token
```javascript
const apiService = require('../services/apiService');

const result = await apiService.verifyGoogleToken(idToken);
if (result.success) {
  const { email, userId } = result.data;
} else {
  console.error('Token invalid:', result.error);
}
```

### Task 3: Send Push Notification
```javascript
const apiService = require('../services/apiService');

await apiService.sendFCMNotification(deviceToken, {
  title: 'Hello',
  body: 'Hello message',
  data: { key: 'value' }
});
```

### Task 4: Send Telegram Message
```javascript
const apiService = require('../services/apiService');

await apiService.sendTelegramMessage(chatId, 'Your OTP is: 123456');
```

### Task 5: Run Multiple Operations in Order
```javascript
const apiService = require('../services/apiService');

const results = await apiService.executeSequential([
  {
    name: 'verify-token',
    fn: () => apiService.verifyGoogleToken(idToken)
  },
  {
    name: 'create-user',
    fn: () => User.create({ email })
  },
  {
    name: 'send-notification',
    fn: () => apiService.sendFCMNotification(token, { title })
  }
]);

if (results.hasErrors) {
  console.log('Some operations failed:', results.errors);
} else {
  console.log('All operations completed');
}
```

### Task 6: Check External Service Health
```javascript
const apiService = require('../services/apiService');

const health = await apiService.checkAllServicesHealth();
console.log(health);
// Output:
// {
//   timestamp: '2024-01-15T10:30:45.123Z',
//   totalServices: 4,
//   healthyServices: 3,
//   services: {
//     'health-google-oauth': { success: true, status: 'healthy' },
//     'health-fcm': { success: false, status: 'unhealthy', error: '...' },
//     ...
//   }
// }
```

### Task 7: Log Information
```javascript
const logger = require('../utils/logger');

logger.info('MyController', 'User logged in', { userId: 123 });
logger.warn('MyController', 'Unusual activity', { attempts: 5 });
logger.error('MyController', 'Database connection failed', error);
logger.debug('MyController', 'Debug info', { variable: value });
```

### Task 8: Handle Errors Consistently
```javascript
const errorHandler = require('../utils/errorHandler');

try {
  // operation
} catch (error) {
  const { statusCode, response } = errorHandler.handleError('MyContext', error);
  res.status(statusCode).json(response);
  // Automatically returns:
  // {
  //   success: false,
  //   error: {
  //     code: 'ERROR_CODE',
  //     message: 'User-friendly message'
  //   }
  // }
}
```

## Response Format

All error responses follow this format:
```javascript
{
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'User-friendly error message',
    // Details only in development
    details: { ... }
  }
}
```

Success responses:
```javascript
{
  success: true,
  data: { ... }
}
```

## Debugging

### Enable API Logging
```env
ENABLE_API_LOGGING=true
LOG_LEVEL=DEBUG
```

Then check logs:
```bash
tail -f logs/error.log
tail -f logs/warning.log
```

### Check Health of External Services
```bash
curl http://localhost:3000/api/health/services
```

Add this endpoint if it doesn't exist:
```javascript
app.get('/api/health/services', async (req, res) => {
  const apiService = require('./services/apiService');
  const health = await apiService.checkAllServicesHealth();
  res.json(health);
});
```

### Test Retry Logic
1. Break network connection
2. Make API call
3. Check logs - should see retry attempts
4. Restore connection
5. Verify success on retry

## Files Changed

- ✅ `src/utils/logger.js` - NEW
- ✅ `src/utils/errorHandler.js` - NEW
- ✅ `src/utils/httpClient.js` - NEW
- ✅ `src/services/apiService.js` - NEW
- ✅ `src/utils/pushNotifications.js` - MODERNIZED
- ✅ `src/controllers/usersController.js` - MODERNIZED
- ✅ `.env.example` - UPDATED

## Next Steps

1. Review `MODERNIZATION_GUIDE.md` for detailed documentation
2. Apply same patterns to other controllers:
   - `facilitiesController.js`
   - `chatController.js`
   - `adsController.js`
3. Add health check endpoint to your routes
4. Test with external services
5. Monitor logs in production

## Common Issues

**Q: API calls are slow**
- Normal for first attempt with retries
- Disable retries with `API_MAX_RETRIES=0` if not needed

**Q: Too many log files**
- Reduce `LOG_LEVEL` to `WARN` or `ERROR`

**Q: Want to test without external services**
- Mock the `apiService` in tests
- Or use `API_MAX_RETRIES=0` for instant failures

**Q: Need custom timeout for specific API**
```javascript
await httpClient.get(url, { timeout: 5000 }); // 5 seconds
```

## That's It!

You now have enterprise-grade error handling, logging, and API management. The patterns are consistent across all your code. 🎉
