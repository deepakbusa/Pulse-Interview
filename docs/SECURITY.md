# Login Security Implementation

## Overview
Strict login security system with account freezing for multiple concurrent login attempts.

## Security Features

### 1. **No Bypass Prevention**
- ✅ Both User ID and Password are **required**
- ✅ Empty or whitespace-only inputs are **rejected**
- ✅ No credential caching - must login every startup
- ✅ All view navigation requires authentication
- ✅ Direct URL/view access blocked without auth

### 2. **Multiple Login Detection**
When a user attempts to login while already having an active session:
- 🚨 Account is **immediately frozen**
- 🚫 Login is **rejected**
- 📝 Security event is **logged to audit_logs**
- ⚠️ User sees detailed warning message

### 3. **Account Freezing**
User accounts are frozen when:
- Attempting to login with active session
- Multiple concurrent login attempts detected

Frozen accounts:
- ❌ Cannot login until unfrozen by admin
- 📅 Store `blockedAt` timestamp
- 📝 Store `blockReason` details
- 🔐 Require admin intervention

### 4. **Warning Message**
```
⚠️ SECURITY ALERT: ACCOUNT FROZEN

You attempted to login while already having an active session.

For security reasons, your account has been blocked.

Please contact Admin to unfreeze your account.
```

### 5. **Session Management**
- One active session per user maximum
- Sessions tracked in MongoDB `sessions` collection
- Auto-logout on app quit
- Session heartbeat every 5 minutes
- 24-hour session expiry

## Database Schema

### Users Collection
```javascript
{
  userId: String,
  password: String,
  isBlocked: Boolean,        // Account freeze status
  blockedAt: Date,           // When account was frozen
  blockReason: String,       // Why account was frozen
  unblockedAt: Date,         // When admin unfroze
  unblockedBy: String,       // Admin who unfroze
  // ... other fields
}
```

### Sessions Collection
```javascript
{
  sessionId: String,
  userId: String,
  isActive: Boolean,         // Track active sessions
  loginAt: Date,
  logoutAt: Date,
  expiresAt: Date,           // 24-hour expiry
  // ... other fields
}
```

### Audit Logs Collection
```javascript
{
  userId: String,
  action: String,            // e.g., "user.login_failed", "security.multiple_login_attempt"
  status: String,            // "success", "failure", "blocked"
  metadata: Object,          // Additional details
  timestamp: Date
}
```

## Admin Tools

### 1. View Blocked Users
```bash
node scripts/admin-list-blocked-users.js
```

Shows all frozen accounts with:
- User ID
- Name
- Email
- Blocked timestamp
- Block reason

### 2. Unblock User Account
```bash
node scripts/admin-unblock-user.js <userId> <adminUserId>
```

Example:
```bash
node scripts/admin-unblock-user.js user1 admin
```

This will:
- ✅ Remove block flag
- ✅ Clear block timestamp and reason
- ✅ Log admin action in audit_logs
- ✅ Allow user to login again

## Security Flow

### Normal Login Flow
```
1. User enters credentials
2. Check if credentials are empty → REJECT
3. Find user in database
4. Check if user.isBlocked → REJECT with frozen message
5. Check if password matches → REJECT if wrong
6. Check for active sessions → If found, FREEZE account
7. All checks passed → Create session, allow login
```

### Multiple Login Attempt Flow
```
1. User tries to login (already has active session)
2. System detects active session
3. IMMEDIATELY freeze account (isBlocked = true)
4. Log security event to audit_logs
5. REJECT login with security alert
6. User must contact admin
```

### Account Unfreeze Flow
```
1. Admin runs unblock script
2. Script verifies user exists and is blocked
3. Set isBlocked = false
4. Clear blockedAt and blockReason
5. Record unblockedAt and unblockedBy
6. Log admin action
7. User can login again
```

## Code Locations

### Authentication Logic
- `src/utils/mongodb.js` - `verifyUserCredentials()` - Main security checks
- `src/storage.js` - `verifyPulseCredentials()` - Credential verification wrapper
- `src/components/views/LoginView.js` - Login UI and input validation

### Session Management
- `src/utils/mongodb.js` - `createSession()`, `endSession()`, `getActiveSessions()`
- `src/storage.js` - `logoutCurrentSession()`, `updateSessionHeartbeat()`

### Admin Tools
- `scripts/admin-list-blocked-users.js` - View all frozen accounts
- `scripts/admin-unblock-user.js` - Unfreeze user accounts

### Security Guards
- `src/components/app/CheatingDaddyApp.js` - View navigation guards

## Best Practices

### For Users
1. Always logout when done (app auto-logs out on quit)
2. Only login from one device at a time
3. Don't try to bypass login screens
4. Contact admin if account frozen

### For Admins
1. Investigate why user had multiple login attempts before unfreezing
2. Check audit_logs for security events
3. Verify user's identity before unfreezing
4. Monitor for repeated freezing patterns

### For Developers
1. Never add credential caching
2. Always validate authentication before view changes
3. Log all security events to audit_logs
4. Use fire-and-forget logging to not impact UX
5. Keep security checks in main process, not renderer

## Testing Security

### Test Account Freeze
1. Login with user credentials
2. Without logging out, try to login again from another window
3. Should see: "SECURITY ALERT: ACCOUNT FROZEN" message
4. Account should be blocked in database
5. Cannot login again until admin unfreezes

### Test Bypass Prevention
1. Try to access main view without logging in
2. Try empty credentials
3. Try whitespace-only credentials
4. Should all redirect to login screen

### Test Admin Tools
```bash
# List blocked users
node scripts/admin-list-blocked-users.js

# Unblock a user
node scripts/admin-unblock-user.js user1 admin

# Verify user can login again
```

## Security Audit Checklist

- [x] No credential bypass possible
- [x] Empty/whitespace inputs rejected
- [x] Multiple login detection working
- [x] Account freeze on multiple login
- [x] Proper error messages shown
- [x] Admin unblock tool working
- [x] All security events logged
- [x] Session management robust
- [x] View navigation guarded
- [x] One session per user enforced

## Future Enhancements

Consider adding:
- Rate limiting on login attempts
- IP-based blocking for brute force
- Two-factor authentication (2FA)
- Password strength requirements
- Password reset functionality
- Email notifications on freeze
- Admin dashboard for security monitoring
- Failed login attempt counter
- Temporary lockout before permanent freeze
