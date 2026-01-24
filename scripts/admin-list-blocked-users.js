/**
 * Admin Utility: List All Blocked Users
 * 
 * Shows all user accounts that are currently frozen/blocked
 * 
 * Usage: node scripts/admin-list-blocked-users.js
 */

const { connectToMongoDB, closeMongoDB, getDatabase } = require('../src/utils/mongodb');

async function listBlockedUsers() {
    console.log('🔒 Blocked Users Report');
    console.log('======================\n');
    
    try {
        const db = await connectToMongoDB();
        
        // Find all blocked users
        const blockedUsers = await db.collection('users')
            .find({ isBlocked: true })
            .toArray();
        
        if (blockedUsers.length === 0) {
            console.log('✅ No blocked users found');
            return;
        }
        
        console.log(`Found ${blockedUsers.length} blocked user(s):\n`);
        
        blockedUsers.forEach((user, index) => {
            console.log(`${index + 1}. User ID: ${user.userId}`);
            console.log(`   Name: ${user.fullName || 'N/A'}`);
            console.log(`   Email: ${user.email || 'N/A'}`);
            console.log(`   Blocked At: ${user.blockedAt ? new Date(user.blockedAt).toLocaleString() : 'N/A'}`);
            console.log(`   Reason: ${user.blockReason || 'N/A'}`);
            console.log('');
        });
        
        console.log('💡 To unblock a user, run:');
        console.log('   node scripts/admin-unblock-user.js <userId> <adminUserId>');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await closeMongoDB();
    }
}

// Run report
listBlockedUsers()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Failed to generate report:', error);
        process.exit(1);
    });
