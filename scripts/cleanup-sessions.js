/**
 * Cleanup Script: Fix Inactive Sessions and Wrongly Frozen Accounts
 * 
 * This script:
 * 1. Ends all expired/inactive sessions (older than 24 hours)
 * 2. Unfreezes accounts that have no active sessions
 * 
 * Usage: node scripts/cleanup-sessions.js
 */

const { connectToMongoDB, closeMongoDB, getDatabase } = require('../src/utils/mongodb');

async function cleanupSessions() {
    console.log('🧹 Session Cleanup & Account Recovery');
    console.log('====================================\n');
    
    try {
        const db = await connectToMongoDB();
        
        // Step 1: End expired sessions (older than 24 hours)
        console.log('Step 1: Cleaning up expired sessions...');
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const expiredResult = await db.collection('sessions').updateMany(
            { 
                isActive: true,
                loginAt: { $lt: twentyFourHoursAgo }
            },
            { 
                $set: { 
                    isActive: false,
                    logoutAt: new Date(),
                    autoLogoutReason: 'Auto-cleanup: Session expired (24 hours)'
                } 
            }
        );
        
        console.log(`   ✅ Cleaned ${expiredResult.modifiedCount} expired sessions\n`);
        
        // Step 2: Find blocked users
        console.log('Step 2: Checking blocked users...');
        const blockedUsers = await db.collection('users')
            .find({ isBlocked: true })
            .toArray();
        
        console.log(`   Found ${blockedUsers.length} blocked user(s)\n`);
        
        if (blockedUsers.length === 0) {
            console.log('✅ No blocked users to process');
            return;
        }
        
        // Step 3: Check each blocked user for active sessions
        console.log('Step 3: Checking active sessions for blocked users...');
        let unfrozenCount = 0;
        
        for (const user of blockedUsers) {
            const activeSessions = await db.collection('sessions')
                .find({ 
                    userId: user.userId, 
                    isActive: true,
                    loginAt: { $gt: twentyFourHoursAgo }
                })
                .toArray();
            
            if (activeSessions.length === 0) {
                // No active sessions - safe to unfreeze
                console.log(`   🔓 Unfreezing ${user.userId} (no active sessions)`);
                
                await db.collection('users').updateOne(
                    { userId: user.userId },
                    { 
                        $set: { 
                            isBlocked: false,
                            unblockedAt: new Date(),
                            unblockedBy: 'auto-cleanup-script'
                        },
                        $unset: {
                            blockedAt: '',
                            blockReason: ''
                        }
                    }
                );
                
                // Log cleanup action
                await db.collection('audit_logs').insertOne({
                    userId: user.userId,
                    action: 'system.auto_unblock',
                    status: 'success',
                    metadata: {
                        reason: 'No active sessions found',
                        cleanupTimestamp: new Date()
                    },
                    timestamp: new Date()
                });
                
                unfrozenCount++;
            } else {
                console.log(`   ⚠️  ${user.userId} still has ${activeSessions.length} active session(s) - keeping frozen`);
            }
        }
        
        console.log(`\n📊 Cleanup Summary:`);
        console.log(`   🗑️  Expired sessions ended: ${expiredResult.modifiedCount}`);
        console.log(`   🔓 Accounts unfrozen: ${unfrozenCount}`);
        console.log(`   🔒 Accounts still frozen: ${blockedUsers.length - unfrozenCount}`);
        
        if (unfrozenCount > 0) {
            console.log('\n✅ Successfully recovered wrongly frozen accounts!');
        }
        
    } catch (error) {
        console.error('❌ Cleanup error:', error.message);
        throw error;
    } finally {
        await closeMongoDB();
        console.log('\n🔌 Database connection closed');
    }
}

// Run cleanup
cleanupSessions()
    .then(() => {
        console.log('\n✨ Cleanup complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Cleanup failed:', error);
        process.exit(1);
    });
