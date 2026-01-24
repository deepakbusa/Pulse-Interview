const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'pulse_crackmate';

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is required!');
    process.exit(1);
}

let client = null;
let db = null;

async function connectToMongoDB() {
    if (db) {
        return db;
    }

    try {
        console.log('🔌 Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI, {
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 60000,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        await client.connect();
        db = client.db(DATABASE_NAME);
        console.log('✅ Connected to MongoDB successfully');

        // Monitor connection health
        client.on('serverHeartbeatFailed', (event) => {
            console.error('❌ MongoDB heartbeat failed:', event);
        });

        client.on('topologyClosed', () => {
            console.warn('⚠️ MongoDB topology closed, will reconnect on next request');
            db = null;
            client = null;
        });

        client.on('error', (error) => {
            console.error('❌ MongoDB connection error:', error);
        });

        return db;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

function getDatabase() {
    if (!db) {
        throw new Error('Database not connected. Call connectToMongoDB() first.');
    }
    return db;
}

async function closeMongoDB() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        console.log('🔌 MongoDB connection closed');
    }
}

module.exports = {
    connectToMongoDB,
    getDatabase,
    closeMongoDB,
    ObjectId
};
