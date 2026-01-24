# Security Quick Reference

## 🔐 Login Security Summary

### User Account Frozen?
```bash
# List all blocked users
node scripts/admin-list-blocked-users.js

# Unblock specific user
node scripts/admin-unblock-user.js <userId> <adminUserId>
```

### Security Features
✅ **No bypass** - Login required every startup  
✅ **Single session** - Only one active login per user  
✅ **Auto-freeze** - Multiple login attempts → Account blocked  
✅ **Admin control** - Only admins can unfreeze accounts  
✅ **Audit logging** - All security events tracked  

### Warning Messages

**Multiple Login Attempt:**
```
⚠️ SECURITY ALERT: ACCOUNT FROZEN

You attempted to login while already having an active session.

For security reasons, your account has been blocked.

Please contact Admin to unfreeze your account.
```

**Already Blocked:**
```
🚫 ACCOUNT FROZEN

Your account has been blocked due to multiple login 
attempts while already logged in.

Please contact Admin to unfreeze your account.
```

### Quick Troubleshooting

**Q: User says "my account is frozen"**  
A: Run: `node scripts/admin-list-blocked-users.js` to verify, then unblock with admin credentials

**Q: How to prevent account freeze?**  
A: Always logout before closing app, only login from one device

**Q: Can user have multiple sessions?**  
A: No - attempting multiple logins triggers account freeze

**Q: How long is account blocked?**  
A: Until admin manually unblocks it

**Q: Where are security events logged?**  
A: MongoDB `audit_logs` collection

### Security Checks (Technical)
1. ✅ Empty credentials → Rejected
2. ✅ Whitespace-only → Rejected  
3. ✅ Wrong password → Rejected
4. ✅ Account blocked → Rejected with freeze message
5. ✅ Active session exists → Freeze account + Reject
6. ✅ Unauthenticated view access → Redirect to login

### Database Fields
```javascript
user.isBlocked       // true if frozen
user.blockedAt       // timestamp
user.blockReason     // why frozen
user.unblockedBy     // admin who unfroze
```

### Admin Actions Logged
- `admin.unblock_user` - When admin unfreezes account
- `security.multiple_login_attempt` - When freeze triggered
- `user.login` - Successful login
- `user.login_failed` - Failed login attempt
- `user.logout` - User logged out
