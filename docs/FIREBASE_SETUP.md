# Firebase Authentication Setup

This guide explains how to set up Firebase authentication for Pulse.

## Prerequisites

- Firebase account (create at https://console.firebase.google.com/)
- Node.js installed
- Pulse app project

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard (you can disable Google Analytics if not needed)

## Step 2: Enable Realtime Database

1. In Firebase Console, go to **Build > Realtime Database**
2. Click **Create Database**
3. Choose a location (e.g., `us-central1`)
4. Start in **Test mode** for now (we'll secure it later)

## Step 3: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll to **Your apps** section
3. Click on the **Web app** icon (`</>`) to register a web app
4. Give it a name (e.g., "Pulse App")
5. Copy the `firebaseConfig` object values

## Step 4: Configure Environment Variables

1. Open your `.env` file (create one if it doesn't exist)
2. Add the following Firebase configuration:

```env
# Firebase Configuration
FIREBASE_API_KEY=AIzaSyXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxX
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

3. Replace the values with your actual Firebase config from Step 3

## Step 5: Populate Database with Users

We've provided a script to easily populate your Firebase database with sample users.

### Method 1: Using the Population Script (Recommended)

```bash
# Run the population script
node scripts/populate-firebase.js
```

This will create 10 sample users in your Firebase database:

| User ID | Password   |
|---------|------------|
| user1   | pass123    |
| user2   | demo456    |
| admin   | admin789   |
| test    | test123    |
| demo    | demo123    |
| john    | john2024   |
| jane    | jane2024   |
| pulse1  | pulse1234  |
| pulse2  | pulse5678  |
| guest   | guest999   |

### Method 2: Manual Entry via Firebase Console

1. Go to **Realtime Database** in Firebase Console
2. Click the **+** icon next to the database URL
3. Create a new key: `pulse-credentials`
4. Add child nodes for each user:

```
pulse-credentials/
  user1/
    password: "pass123"
    createdAt: "2024-01-01T00:00:00.000Z"
  user2/
    password: "demo456"
    createdAt: "2024-01-01T00:00:00.000Z"
```

## Step 6: Test the Setup

1. Start your Pulse app:
   ```bash
   npm start
   ```

2. After the onboarding screen, you'll see the login screen

3. Try logging in with one of the sample users (e.g., `user1` / `pass123`)

4. If successful, you'll be taken to the main app screen

## Database Security Rules

For production, update your Firebase Realtime Database security rules:

```json
{
  "rules": {
    "pulse-credentials": {
      ".read": "auth != null",
      ".write": false,
      "$userId": {
        ".read": "auth != null",
        ".write": false
      }
    }
  }
}
```

This ensures:
- Only authenticated requests can read credentials
- No one can write to the credentials (prevents unauthorized user creation)

For development/testing, you can use test mode:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

⚠️ **Warning:** Test mode allows anyone to read/write your database. Only use it for development!

## Adding New Users

### Via Population Script
Edit `scripts/populate-firebase.js` and add new users to the `sampleUsers` array:

```javascript
const sampleUsers = [
    // ... existing users ...
    { userId: 'newuser', password: 'newpass123' }
];
```

Then run: `node scripts/populate-firebase.js`

### Via Firebase Console
1. Go to **Realtime Database**
2. Navigate to `pulse-credentials`
3. Click **+** to add a new child node
4. Enter the user ID as the key
5. Add `password` field with the password value

## Troubleshooting

### "Firebase not configured" warning
- Check that all FIREBASE_* variables are set in your `.env` file
- Ensure there are no typos in the variable names
- Restart the app after updating `.env`

### "Login verification failed"
- Verify Firebase configuration is correct
- Check that Realtime Database is enabled
- Ensure the `pulse-credentials` node exists in your database
- Check database security rules allow read access

### Connection errors
- Verify your internet connection
- Check Firebase project is active (not deleted)
- Ensure FIREBASE_DATABASE_URL is correct
- Check if Firebase has any service outages

### User not found
- Verify the user exists in `pulse-credentials` node
- Check spelling of userId (case-sensitive)
- Ensure database structure matches: `pulse-credentials/<userId>/password`

## Advanced: Firebase Authentication (Optional)

For enhanced security, you can integrate Firebase Authentication:

1. Enable Authentication in Firebase Console
2. Add authentication logic to verify tokens
3. Use Firebase Auth to manage user sessions
4. Implement password reset functionality

This is optional - the current implementation works directly with Realtime Database for simplicity.

## Support

If you encounter issues:
1. Check the console for error messages
2. Verify all environment variables are set correctly
3. Ensure Firebase services are enabled
4. Review Firebase Console for any alerts or issues
