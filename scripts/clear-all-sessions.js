/**
 * Clear All Active Sessions
 * 
 * Ends all active sessions in the database.
 * Run this to start with a clean state.
 * 
 * Usage: node scripts/clear-all-sessions.js
 */

const { connectToMongoDB, closeMongoDB, getDatabase } = require('../src/utils/mongodb');

async function clearAllSessions() {
    console.log('🗑️  Clear All Active Sessions');
    console.log('============================\n');
    
    try {
        const db = await connectToMongoDB();
        
        // Find all active sessions
        const activeSessions = await db.collection('sessions')
            .find({ isActive: true })
            .toArray();
        
        console.log(`Found ${activeSessions.length} active session(s)\n`);
        
        if (activeSessions.length === 0) {
            console.log('✅ No active sessions to clear');
            return;
        }
        
        // End all active sessions
        const result = await db.collection('sessions').updateMany(
            { isActive: true },
            { 
                $set: { 
                    isActive: false,
                    logoutAt: new Date(),
                    logoutReason: 'Manual cleanup - clear all sessions'
                } 
            }
        );
        
        console.log(`✅ Cleared ${result.modifiedCount} active session(s)`);
        
        // Show which users were logged out
        const userIds = [...new Set(activeSessions.map(s => s.userId))];
        console.log('\n📋 Users logged out:');
        userIds.forEach(userId => {
            console.log(`   - ${userId}`);
        });
        
    } catch (error) {
        console.error('❌ Error clearing sessions:', error.message);
        throw error;
    } finally {
        await closeMongoDB();
        console.log('\n🔌 Database connection closed');
    }
}

// Run cleanup
clearAllSessions()
    .then(() => {
        console.log('\n✨ All sessions cleared successfully!');
        console.log('ℹ️  All users will need to login again');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Failed to clear sessions:', error);
        process.exit(1);
    });
