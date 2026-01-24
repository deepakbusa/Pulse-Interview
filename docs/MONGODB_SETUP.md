# MongoDB Integration Guide

## Overview

The application now uses MongoDB Atlas for comprehensive data storage and analytics. All user authentication, session management, API logging, and chat history are stored in MongoDB.

## Database Structure

### Collections

1. **users** - User accounts and profiles
   - userId, password, email, fullName, role, plan
   - Preferences (profile, language, theme)
   - Metadata (signup source, country, timezone)

2. **sessions** - Active login sessions
   - sessionId, userId, isActive
   - loginAt, lastActivityAt, expiresAt
   - deviceInfo (platform, arch, versions)

3. **api_requests** - API request logs (Azure OpenAI, Speech, Vision)
   - userId, sessionId, service, operation
   - status, duration, timestamp
   - Metadata (model, tokens, etc.)

4. **chat_history** - All chat conversations
   - userId, sessionId, role (user/assistant)
   - message, profile, timestamp
   - Metadata (model, tokens, processing time)

5. **usage_statistics** - Daily usage metrics per user
   - userId, date
   - totalRequests, apiCalls, chatMessages
   - screenshotsAnalyzed, transcriptionMinutes

6. **audit_logs** - User actions and security events
   - userId, action, status
   - ipAddress, userAgent, timestamp
   - Metadata (details, errors)

## Connection Details

**MongoDB URI**: `mongodb+srv://deepakbussa_db_user:jjouhWx8uYnDMRDn@cluster0.rjcpj3y.mongodb.net/?appName=Cluster0`

**Database Name**: `pulse_crackmate`

## Sample Users

The database is populated with 10 test users:

| User ID | Password | Role | Plan |
|---------|----------|------|------|
| admin | admin789 | admin | enterprise |
| demo | demo123 | demo | trial |
| user1 | pass123 | user | premium |
| user2 | pass123 | user | free |
| user3 | pass123 | user | premium |
| user4 | pass123 | user | free |
| user5 | pass123 | user | premium |
| test | test123 | tester | free |
| premium1 | prem123 | user | premium |
| deactivated | deact123 | user (inactive) | free |

## Population Script

To populate the database with sample data:

```bash
node scripts/populate-mongodb.js
```

This creates:
- 10 users with varied profiles
- 20-50 active sessions
- 500-2000 API request logs (30 days history)
- 400-1600 chat messages
- 30 days of usage statistics per user
- 500-1000 audit logs

## Performance Considerations

### Non-Blocking Design

All logging operations are **async and non-blocking** to ensure zero impact on user experience:

```javascript
// Example: Background logging (fire and forget)
logAPIRequestAsync({
    service: 'azure-openai',
    operation: 'chat-completion',
    duration: 2500,
    status: 'success',
});
```

Key features:
- Uses `setImmediate()` for async execution
- Logging happens AFTER response is shown to user
- No `await` on logging operations in critical paths
- Session heartbeat updates every 5 minutes (background)

### Response Flow

```
User Request → API Call → Get Response → Show to User
                                ↓
                         (Background logging starts here)
                                ↓
                         Log to MongoDB async
```

## Background Logger

Located in `src/utils/backgroundLogger.js`:

### Available Functions

1. **logAPIRequestAsync(requestData)** - Log API calls
2. **logChatMessageAsync(messageData)** - Log chat messages
3. **logScreenshotAnalysisAsync(analysisData)** - Log screenshot analysis
4. **logTranscriptionAsync(transcriptionData)** - Log transcription sessions
5. **logUserActionAsync(action, metadata)** - Log user actions
6. **logErrorAsync(action, error, metadata)** - Log errors

### Wrapper Functions

For automatic logging:

```javascript
// Wrap API calls
const response = await withAPILogging(
    () => azureOpenAI.sendMessage(message),
    { service: 'azure-openai', operation: 'chat-completion' }
);

// Wrap chat operations
const aiResponse = await withChatLogging(
    () => getChatResponse(userMessage),
    userMessage,
    { profile: 'interview', model: 'gpt-4o' }
);
```

## Dashboard Analytics

Get comprehensive analytics:

```javascript
const { getDashboardAnalytics } = require('./utils/mongodb');

// Overall analytics
const stats = await getDashboardAnalytics();

// User-specific analytics
const userStats = await getDashboardAnalytics('user1');
```

Returns:
- Total users count
- Active sessions today
- API requests today
- Chat messages today
- Top 5 most used services

## Session Management

### Login Flow

```javascript
// Verify credentials and create session
const isValid = await storage.verifyPulseCredentials(userId, password);
// → Creates MongoDB session
// → Logs audit event
// → Returns session ID
```

### Session Lifecycle

1. **Login** - `createSession()` creates new session
2. **Activity** - `updateSessionActivity()` every 5 minutes
3. **Logout** - `endSession()` marks session inactive
4. **Expiry** - MongoDB TTL index auto-deletes after 24 hours

## Usage Statistics

Track user activity:

```javascript
await updateUsageStats(userId, {
    totalRequests: 1,
    apiCalls: 1,
    chatMessages: 1,
    screenshotsAnalyzed: 1,
    transcriptionMinutes: 5,
});
```

Statistics aggregate daily and reset at midnight.

## Indexes

All collections have optimized indexes for query performance:

- **users**: userId (unique), email
- **sessions**: userId, sessionId (unique), expiresAt (TTL), isActive+userId
- **api_requests**: userId+timestamp, service+timestamp, timestamp
- **chat_history**: userId+timestamp, sessionId+timestamp, timestamp
- **usage_statistics**: userId+date, date
- **audit_logs**: userId+timestamp, action+timestamp, timestamp

## Migration from Firebase

Previous Firebase storage has been replaced:
- ✅ User authentication → MongoDB
- ✅ Session management → MongoDB with TTL
- ✅ All user data → MongoDB collections
- ❌ Firebase SDK removed
- ❌ .env Firebase variables no longer needed

## Environment Variables

No MongoDB credentials needed in .env - connection string is embedded in code.

Only Azure credentials required:
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`

## Monitoring

### Check Connection

```javascript
const { connectToMongoDB } = require('./utils/mongodb');
await connectToMongoDB(); // Logs connection status
```

### View Logs

All MongoDB operations log to console:
- ✅ Connection success/failure
- ✅ Index creation
- ❌ Query errors

## Security

- Connection uses MongoDB Atlas with SSL/TLS
- User passwords stored in plain text (for demo purposes)
- Session expiry handled by MongoDB TTL indexes
- Audit logs track all security-relevant events

## Future Enhancements

Potential improvements:
1. Password hashing (bcrypt)
2. JWT tokens for session authentication
3. Rate limiting per user/plan
4. Real-time dashboard with WebSockets
5. Export analytics to CSV/Excel
6. Email notifications for important events
7. Multi-factor authentication
8. IP whitelisting/blacklisting

## Troubleshooting

### Connection Failed

Check:
1. Internet connectivity
2. MongoDB Atlas cluster status
3. IP whitelist (should be 0.0.0.0/0 for dev)
4. Username/password correct

### Slow Performance

- Indexes are created automatically on first connection
- Use `explain()` to analyze slow queries
- Consider adding compound indexes for complex filters
- Monitor Atlas performance metrics

### Data Not Appearing

- Check `getCurrentSession()` returns valid userId
- Verify `connectToMongoDB()` succeeded
- Look for errors in console logs
- Use MongoDB Compass to inspect collections directly

## Tools

### MongoDB Compass

Download: https://www.mongodb.com/products/compass

Connect using the URI to browse/edit data visually.

### Mongoose (Optional)

For schema validation and ODM features:

```bash
npm install mongoose
```

## Support

For MongoDB Atlas support: https://support.mongodb.com/

For application issues: Check console logs and audit_logs collection
