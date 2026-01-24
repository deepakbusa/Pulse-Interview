// Firebase Database Population Script
// This script helps you populate the Firebase Realtime Database with sample users
// Run with: node scripts/populate-firebase.js

require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set } = require('firebase/database');

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Sample users to populate
const sampleUsers = [
    { userId: 'user1', password: 'pass123' },
    { userId: 'user2', password: 'demo456' },
    { userId: 'admin', password: 'admin789' },
    { userId: 'test', password: 'test123' },
    { userId: 'demo', password: 'demo123' },
    { userId: 'john', password: 'john2024' },
    { userId: 'jane', password: 'jane2024' },
    { userId: 'pulse1', password: 'pulse1234' },
    { userId: 'pulse2', password: 'pulse5678' },
    { userId: 'guest', password: 'guest999' }
];

async function populateFirebase() {
    try {
        // Verify all required config values
        const missingConfig = Object.entries(firebaseConfig)
            .filter(([key, value]) => !value)
            .map(([key]) => key);

        if (missingConfig.length > 0) {
            console.error('❌ Missing Firebase configuration:');
            console.error('   ' + missingConfig.join(', '));
            console.error('\n📝 Please add these values to your .env file');
            console.error('   See .env.example for reference');
            process.exit(1);
        }

        console.log('🔥 Initializing Firebase...');
        const app = initializeApp(firebaseConfig);
        const database = getDatabase(app);

        console.log('✅ Firebase connected successfully\n');
        console.log('📝 Populating pulse-credentials with sample users...\n');

        // Populate each user
        for (const user of sampleUsers) {
            const userRef = ref(database, `pulse-credentials/${user.userId}`);
            await set(userRef, {
                password: user.password,
                createdAt: new Date().toISOString(),
                createdBy: 'populate-script'
            });
            console.log(`   ✓ Added user: ${user.userId} (password: ${user.password})`);
        }

        console.log('\n✅ Successfully populated Firebase with ' + sampleUsers.length + ' users!');
        console.log('\n📋 User Credentials Summary:');
        console.log('━'.repeat(50));
        sampleUsers.forEach(user => {
            console.log(`   User ID: ${user.userId.padEnd(15)} | Password: ${user.password}`);
        });
        console.log('━'.repeat(50));
        console.log('\n💡 You can now login to Pulse with any of these credentials');
        console.log('🔧 To add more users, edit this script and run it again');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error populating Firebase:', error.message);
        console.error('\nTroubleshooting:');
        console.error('1. Check your Firebase configuration in .env file');
        console.error('2. Ensure Realtime Database is enabled in Firebase Console');
        console.error('3. Check database security rules allow write access');
        process.exit(1);
    }
}

// Run the population script
console.log('🚀 Firebase Database Population Script');
console.log('━'.repeat(50));
populateFirebase();
