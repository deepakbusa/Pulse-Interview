const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

// MongoDB connection URI from environment variables - NO HARDCODED FALLBACK
const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'pulse_crackmate';

// Validate required environment variables
if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is required!');
    console.error('Please set MONGODB_URI in your .env file');
    throw new Error('Missing required environment variable: MONGODB_URI');
}

let client = null;
let db = null;

/**
 * Connect to MongoDB
 */
async function connectToMongoDB() {
    if (db) {
        return db;
    }

    try {
        console.log('Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI, {
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 60000,
        });

        await client.connect();
        db = client.db(DATABASE_NAME);
        console.log('✅ Connected to MongoDB successfully');

        // Create indexes for performance
        await createIndexes();

        return db;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

/**
 * Create database indexes for performance
 */
async function createIndexes() {
    try {
        const db = await connectToMongoDB();

        // Users collection indexes
        await db.collection('users').createIndex({ userId: 1 }, { unique: true });
        await db.collection('users').createIndex({ email: 1 }, { sparse: true });
        await db.collection('users').createIndex({ isBlocked: 1, userId: 1 });

        // Sessions collection indexes
        await db.collection('sessions').createIndex({ userId: 1 });
        await db.collection('sessions').createIndex({ sessionId: 1 }, { unique: true });
        await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        await db.collection('sessions').createIndex({ isActive: 1, userId: 1 });

        // API requests collection indexes (lightweight - no message content)
        await db.collection('api_requests').createIndex({ userId: 1, timestamp: -1 });
        await db.collection('api_requests').createIndex({ service: 1, timestamp: -1 });
        await db.collection('api_requests').createIndex({ timestamp: -1 });

        // Usage statistics collection indexes
        await db.collection('usage_statistics').createIndex({ userId: 1, date: -1 });
        await db.collection('usage_statistics').createIndex({ date: -1 });

        // Audit logs collection indexes
        await db.collection('audit_logs').createIndex({ userId: 1, timestamp: -1 });
        await db.collection('audit_logs').createIndex({ action: 1, timestamp: -1 });
        await db.collection('audit_logs').createIndex({ timestamp: -1 });

        console.log('✅ Database indexes created successfully');
    } catch (error) {
        console.error('❌ Error creating indexes:', error);
    }
}

/**
 * Get database instance
 */
function getDatabase() {
    if (!db) {
        throw new Error('Database not connected. Call connectToMongoDB() first.');
    }
    return db;
}

/**
 * Close MongoDB connection
 */
async function closeMongoDB() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        console.log('MongoDB connection closed');
    }
}

// ==================== USER OPERATIONS ====================

/**
 * Verify user credentials with security checks
 * Returns: { success: boolean, error?: string, shouldBlock?: boolean }
 */
async function verifyUserCredentials(userId, password) {
    try {
        const db = await connectToMongoDB();
        
        // SECURITY: Require both userId and password
        if (!userId || !password) {
            return { success: false, error: 'Missing credentials' };
        }
        
        // Find user
        const user = await db.collection('users').findOne({ userId });
        
        // User doesn't exist
        if (!user) {
            return { success: false, error: 'Invalid credentials' };
        }
        
        // SECURITY CHECK 1: Account is blocked/frozen
        if (user.isBlocked) {
            return { 
                success: false, 
                error: '🚫 ACCOUNT FROZEN\n\nYour account has been blocked due to multiple login attempts while already logged in.\n\nPlease contact Admin to unfreeze your account.',
                isBlocked: true
            };
        }
        
        // SECURITY CHECK 2: Check password
        if (user.password !== password) {
            return { success: false, error: 'Invalid credentials' };
        }
        
        // SECURITY CHECK 3: Check for active sessions (multiple login attempt)
        // First, clean up expired sessions (older than 24 hours)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await db.collection('sessions').updateMany(
            { 
                userId, 
                isActive: true,
                loginAt: { $lt: twentyFourHoursAgo }
            },
            { 
                $set: { 
                    isActive: false,
                    logoutAt: new Date(),
                    autoLogoutReason: 'Session expired (24 hours)'
                } 
            }
        );
        
        // Now check for genuinely active sessions
        const activeSessions = await db.collection('sessions')
            .find({ 
                userId, 
                isActive: true,
                loginAt: { $gt: twentyFourHoursAgo }
            })
            .toArray();
        
        if (activeSessions.length > 0) {
            // User is ACTUALLY logged in somewhere else - FREEZE THE ACCOUNT
            await db.collection('users').updateOne(
                { userId },
                { 
                    $set: { 
                        isBlocked: true, 
                        blockedAt: new Date(),
                        blockReason: 'Multiple concurrent login attempts'
                    } 
                }
            );
            
            // Log security event
            await db.collection('audit_logs').insertOne({
                userId,
                action: 'security.multiple_login_attempt',
                status: 'blocked',
                metadata: {
                    activeSessionCount: activeSessions.length,
                    sessionIds: activeSessions.map(s => s.sessionId),
                    blockedAt: new Date()
                },
                timestamp: new Date()
            });
            
            return { 
                success: false, 
                error: 'SECURITY ALERT: ACCOUNT FROZEN\n\nYou attempted to login while already having an active session.\n\nFor security reasons, your account has been blocked.\n\nPlease contact Admin to unfreeze your account.',
                shouldBlock: true
            };
        }
        
        // All checks passed
        return { success: true, user };
        
    } catch (error) {
        console.error('Error verifying credentials:', error);
        return { success: false, error: 'Login verification failed' };
    }
}

/**
 * Get user by userId
 */
async function getUserById(userId) {
    try {
        const db = await connectToMongoDB();
        return await db.collection('users').findOne({ userId });
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

/**
 * Get all users
 */
async function getAllUsers() {
    try {
        const db = await connectToMongoDB();
        return await db.collection('users').find({}).toArray();
    } catch (error) {
        console.error('Error getting all users:', error);
        return [];
    }
}

/**
 * Create new user
 */
async function createUser(userData) {
    try {
        const db = await connectToMongoDB();
        const result = await db.collection('users').insertOne({
            ...userData,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        return result.insertedId;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

/**
 * Update user data
 */
async function updateUser(userId, updateData) {
    try {
        const db = await connectToMongoDB();
        await db.collection('users').updateOne(
            { userId },
            { 
                $set: { 
                    ...updateData, 
                    updatedAt: new Date() 
                } 
            }
        );
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}

/**
 * Unblock/unfreeze user account (Admin function)
 */
async function unblockUser(userId, adminUserId) {
    try {
        const db = await connectToMongoDB();
        
        // Unblock the user
        await db.collection('users').updateOne(
            { userId },
            { 
                $set: { 
                    isBlocked: false,
                    unblockedAt: new Date(),
                    unblockedBy: adminUserId
                },
                $unset: {
                    blockedAt: '',
                    blockReason: ''
                }
            }
        );
        
        // Log admin action
        await db.collection('audit_logs').insertOne({
            userId: adminUserId,
            action: 'admin.unblock_user',
            status: 'success',
            metadata: {
                unblockedUserId: userId,
                timestamp: new Date()
            },
            timestamp: new Date()
        });
        
        return true;
    } catch (error) {
        console.error('Error unblocking user:', error);
        return false;
    }
}

// ==================== SESSION OPERATIONS ====================

/**
 * Create login session
 */
async function createSession(userId, deviceInfo = {}) {
    try {
        const db = await connectToMongoDB();
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const session = {
            sessionId,
            userId,
            isActive: true,
            loginAt: new Date(),
            lastActivityAt: new Date(),
            expiresAt,
            deviceInfo: {
                platform: deviceInfo.platform || process.platform,
                arch: deviceInfo.arch || process.arch,
                nodeVersion: process.version,
                electronVersion: deviceInfo.electronVersion || '',
                ...deviceInfo,
            },
        };

        await db.collection('sessions').insertOne(session);
        return sessionId;
    } catch (error) {
        console.error('Error creating session:', error);
        throw error;
    }
}

/**
 * Update session activity
 */
async function updateSessionActivity(sessionId) {
    try {
        const db = await connectToMongoDB();
        await db.collection('sessions').updateOne(
            { sessionId },
            { $set: { lastActivityAt: new Date() } }
        );
    } catch (error) {
        console.error('Error updating session activity:', error);
    }
}

/**
 * End session
 */
async function endSession(sessionId) {
    try {
        // Check if client is still available before attempting operation
        if (!client) {
            console.log('⚠️ MongoDB already closed, skipping session end');
            return;
        }
        const db = await connectToMongoDB();
        await db.collection('sessions').updateOne(
            { sessionId },
            { 
                $set: { 
                    isActive: false, 
                    logoutAt: new Date() 
                } 
            }
        );
    } catch (error) {
        // Silently handle if MongoDB is already closed
        if (error.name === 'MongoClientClosedError') {
            console.log('⚠️ MongoDB already closed during session end');
        } else {
            console.error('Error ending session:', error);
        }
    }
}

/**
 * Get active sessions for user
 */
async function getActiveSessions(userId) {
    try {
        const db = await connectToMongoDB();
        return await db.collection('sessions')
            .find({ userId, isActive: true })
            .sort({ loginAt: -1 })
            .toArray();
    } catch (error) {
        console.error('Error getting active sessions:', error);
        return [];
    }
}

// ==================== API REQUEST LOGGING ====================

/**
 * Log API request (async, non-blocking)
 */
async function logAPIRequest(requestData) {
    // Don't await - fire and forget for performance
    setImmediate(async () => {
        try {
            const db = await connectToMongoDB();
            await db.collection('api_requests').insertOne({
                ...requestData,
                timestamp: new Date(),
            });
        } catch (error) {
            console.error('Error logging API request:', error);
        }
    });
}

/**
 * Get API requests for user
 */
async function getAPIRequests(userId, limit = 100) {
    try {
        const db = await connectToMongoDB();
        return await db.collection('api_requests')
            .find({ userId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();
    } catch (error) {
        console.error('Error getting API requests:', error);
        return [];
    }
}

// ==================== CHAT MESSAGE COUNTING (NO STORAGE) ====================

/**
 * Count chat message without storing content (async, non-blocking)
 * Only increments counters to save storage space
 */
async function saveChatMessage(messageData) {
    // Don't await - fire and forget for performance
    setImmediate(async () => {
        try {
            const db = await connectToMongoDB();
            // Only store metadata without actual message content
            await db.collection('api_requests').insertOne({
                userId: messageData.userId,
                sessionId: messageData.sessionId,
                service: 'chat',
                model: messageData.model || 'openai_gpt',
                inputMethod: messageData.inputMethod || 'text',
                latencyMs: messageData.latencyMs || 0,
                timestamp: new Date(),
                // NO MESSAGE CONTENT STORED
            });
        } catch (error) {
            console.error('Error counting chat message:', error);
        }
    });
}

/**
 * Get chat message count for user (no actual messages)
 */
async function getChatHistory(userId, limit = 100) {
    try {
        const db = await connectToMongoDB();
        return await db.collection('api_requests')
            .find({ userId, service: 'chat' })
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();
    } catch (error) {
        console.error('Error getting chat count:', error);
        return [];
    }
}

/**
 * Get chat history by session
 */
async function getChatHistoryBySession(sessionId) {
    try {
        const db = await connectToMongoDB();
        return await db.collection('chat_history')
            .find({ sessionId })
            .sort({ timestamp: 1 })
            .toArray();
    } catch (error) {
        console.error('Error getting chat history by session:', error);
        return [];
    }
}

// ==================== USAGE STATISTICS ====================

/**
 * Update usage statistics (async, non-blocking)
 */
async function updateUsageStats(userId, statsData) {
    setImmediate(async () => {
        try {
            const db = await connectToMongoDB();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            await db.collection('usage_statistics').updateOne(
                { userId, date: today },
                {
                    $inc: {
                        totalRequests: statsData.totalRequests || 0,
                        apiCalls: statsData.apiCalls || 0,
                        chatMessages: statsData.chatMessages || 0,
                        screenshotsAnalyzed: statsData.screenshotsAnalyzed || 0,
                        transcriptionMinutes: statsData.transcriptionMinutes || 0,
                    },
                    $set: { updatedAt: new Date() },
                    $setOnInsert: { date: today, userId, createdAt: new Date() },
                },
                { upsert: true }
            );
        } catch (error) {
            console.error('Error updating usage stats:', error);
        }
    });
}

/**
 * Get usage statistics for user
 */
async function getUserUsageStats(userId, days = 30) {
    try {
        const db = await connectToMongoDB();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return await db.collection('usage_statistics')
            .find({ 
                userId, 
                date: { $gte: startDate } 
            })
            .sort({ date: -1 })
            .toArray();
    } catch (error) {
        console.error('Error getting usage stats:', error);
        return [];
    }
}

// ==================== AUDIT LOGS ====================

/**
 * Log audit event (async, non-blocking)
 */
async function logAuditEvent(eventData) {
    setImmediate(async () => {
        try {
            // Check if client exists and is connected before logging
            if (!client) {
                console.log('MongoDB not connected, skipping audit log');
                return;
            }
            const database = await connectToMongoDB();
            await database.collection('audit_logs').insertOne({
                ...eventData,
                timestamp: new Date(),
            });
        } catch (error) {
            // Silently ignore if MongoDB is closing/closed
            if (error.name === 'MongoClientClosedError' || error.message?.includes('client was closed')) {
                console.log('MongoDB not connected, skipping audit log');
                return;
            }
            console.error('Error logging audit event:', error);
        }
    });
}

/**
 * Get audit logs for user
 */
async function getAuditLogs(userId, limit = 100) {
    try {
        const db = await connectToMongoDB();
        return await db.collection('audit_logs')
            .find({ userId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();
    } catch (error) {
        console.error('Error getting audit logs:', error);
        return [];
    }
}

// ==================== DASHBOARD ANALYTICS ====================

/**
 * Get dashboard analytics
 */
async function getDashboardAnalytics(userId = null) {
    try {
        const db = await connectToMongoDB();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const matchQuery = userId ? { userId } : {};

        // Total users
        const totalUsers = await db.collection('users').countDocuments();

        // Active sessions today
        const activeSessions = await db.collection('sessions').countDocuments({
            ...matchQuery,
            isActive: true,
            loginAt: { $gte: today },
        });

        // API requests today
        const apiRequestsToday = await db.collection('api_requests').countDocuments({
            ...matchQuery,
            timestamp: { $gte: today },
        });

        // Chat messages today
        const chatMessagesToday = await db.collection('chat_history').countDocuments({
            ...matchQuery,
            timestamp: { $gte: today },
        });

        // Most used services
        const topServices = await db.collection('api_requests').aggregate([
            { $match: { timestamp: { $gte: today }, ...matchQuery } },
            { $group: { _id: '$service', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
        ]).toArray();

        return {
            totalUsers,
            activeSessions,
            apiRequestsToday,
            chatMessagesToday,
            topServices,
            generatedAt: new Date(),
        };
    } catch (error) {
        console.error('Error getting dashboard analytics:', error);
        return null;
    }
}

module.exports = {
    connectToMongoDB,
    closeMongoDB,
    getDatabase,
    
    // User operations
    verifyUserCredentials,
    getUserById,
    getAllUsers,
    createUser,
    updateUser,
    unblockUser,
    
    // Session operations
    createSession,
    updateSessionActivity,
    endSession,
    getActiveSessions,
    
    // API request logging
    logAPIRequest,
    getAPIRequests,
    
    // Chat history
    saveChatMessage,
    getChatHistory,
    getChatHistoryBySession,
    
    // Usage statistics
    updateUsageStats,
    getUserUsageStats,
    
    // Audit logs
    logAuditEvent,
    getAuditLogs,
    
    // Dashboard analytics
    getDashboardAnalytics,
    
    // Utilities
    ObjectId,
};
