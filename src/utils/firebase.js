// Firebase configuration and authentication
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, child } = require('firebase/database');

let firebaseApp = null;
let database = null;

// Initialize Firebase with credentials from environment variables
function initializeFirebase() {
    if (firebaseApp) return firebaseApp;

    const firebaseConfig = {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.REACT_APP_FIREBASE_APP_ID
    };

    // Verify all required config values are present
    const missingConfig = Object.entries(firebaseConfig)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

    if (missingConfig.length > 0) {
        console.error('Missing Firebase configuration:', missingConfig.join(', '));
        return null;
    }

    try {
        firebaseApp = initializeApp(firebaseConfig);
        database = getDatabase(firebaseApp);
        console.log('Firebase initialized successfully');
        return firebaseApp;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        return null;
    }
}

// Verify user credentials against Firebase database
async function verifyPulseCredentials(userId, password) {
    try {
        if (!database) {
            initializeFirebase();
        }

        if (!database) {
            console.error('Firebase database not initialized');
            return false;
        }

        // Fetch credentials from pulse-credentials path
        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, `pulse-credentials/${userId}`));

        if (snapshot.exists()) {
            const userData = snapshot.val();
            // Verify password matches
            return userData.password === password;
        } else {
            console.log('User not found:', userId);
            return false;
        }
    } catch (error) {
        console.error('Error verifying credentials:', error);
        return false;
    }
}

// Check if Firebase is configured
function isFirebaseConfigured() {
    return !!(
        process.env.REACT_APP_FIREBASE_API_KEY &&
        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN &&
        process.env.REACT_APP_FIREBASE_DATABASE_URL &&
        process.env.REACT_APP_FIREBASE_PROJECT_ID
    );
}

// Get all users from Firebase (for admin purposes - optional)
async function getAllUsers() {
    try {
        if (!database) {
            initializeFirebase();
        }

        if (!database) {
            return [];
        }

        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, 'pulse-credentials'));

        if (snapshot.exists()) {
            return Object.keys(snapshot.val());
        }
        return [];
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
}

module.exports = {
    initializeFirebase,
    verifyPulseCredentials,
    isFirebaseConfigured,
    getAllUsers
};
