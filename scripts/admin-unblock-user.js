/**
 * Admin Utility: Unblock/Unfreeze User Account
 * 
 * This script allows administrators to unblock user accounts that were
 * frozen due to multiple concurrent login attempts.
 * 
 * Usage: node scripts/admin-unblock-user.js <userId> <adminUserId>
 */

const { connectToMongoDB, unblockUser, closeMongoDB, getUserById } = require('../src/utils/mongodb');

async function unblockUserAccount(userId, adminUserId) {
    console.log('🔓 Admin Unblock User Utility');
    console.log('==============================\n');
    
    try {
        // Connect to database
        await connectToMongoDB();
        
        // Check if user exists
        const user = await getUserById(userId);
        
        if (!user) {
            console.error(`❌ User "${userId}" not found`);
            process.exit(1);
        }
        
        // Check if user is blocked
        if (!user.isBlocked) {
            console.log(`✅ User "${userId}" is not blocked`);
            console.log('No action needed.');
            return;
        }
        
        // Show user info
        console.log('📋 User Information:');
        console.log(`   User ID: ${user.userId}`);
        console.log(`   Name: ${user.fullName || 'N/A'}`);
        console.log(`   Email: ${user.email || 'N/A'}`);
        console.log(`   Blocked: ${user.isBlocked ? 'YES' : 'NO'}`);
        console.log(`   Blocked At: ${user.blockedAt || 'N/A'}`);
        console.log(`   Block Reason: ${user.blockReason || 'N/A'}`);
        console.log('');
        
        // Unblock the user
        console.log(`🔓 Unblocking user "${userId}"...`);
        const success = await unblockUser(userId, adminUserId);
        
        if (success) {
            console.log('✅ User account successfully unblocked!');
            console.log('');
            console.log('ℹ️  The user can now login again.');
            console.log('⚠️  Remind the user to logout from all devices before logging in again.');
        } else {
            console.error('❌ Failed to unblock user account');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await closeMongoDB();
    }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('❌ Usage: node scripts/admin-unblock-user.js <userId> <adminUserId>');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/admin-unblock-user.js user1 admin');
    console.log('');
    process.exit(1);
}

const [userId, adminUserId] = args;

// Run unblock
unblockUserAccount(userId, adminUserId)
    .then(() => {
        console.log('\n✨ Operation complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Operation failed:', error);
        process.exit(1);
    });
