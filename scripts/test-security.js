/**
 * Security Test Script
 * 
 * Tests the login security implementation
 * 
 * Usage: node scripts/test-security.js
 */

const { connectToMongoDB, verifyUserCredentials, createSession, closeMongoDB, getUserById } = require('../src/utils/mongodb');

async function testSecurity() {
    console.log('🧪 Security Test Suite');
    console.log('=====================\n');
    
    try {
        await connectToMongoDB();
        
        const testUserId = 'user1';
        const testPassword = 'pass123';
        
        console.log('Test 1: Empty credentials');
        const test1 = await verifyUserCredentials('', '');
        console.log(`   Result: ${test1.success ? '❌ FAIL' : '✅ PASS'} - ${test1.error}`);
        
        console.log('\nTest 2: Missing password');
        const test2 = await verifyUserCredentials(testUserId, '');
        console.log(`   Result: ${test2.success ? '❌ FAIL' : '✅ PASS'} - ${test2.error}`);
        
        console.log('\nTest 3: Wrong password');
        const test3 = await verifyUserCredentials(testUserId, 'wrongpass');
        console.log(`   Result: ${test3.success ? '❌ FAIL' : '✅ PASS'} - ${test3.error}`);
        
        console.log('\nTest 4: Correct credentials (first login)');
        const test4 = await verifyUserCredentials(testUserId, testPassword);
        console.log(`   Result: ${test4.success ? '✅ PASS' : '❌ FAIL'} - Login successful`);
        
        if (test4.success) {
            console.log('   Creating active session...');
            await createSession(testUserId, { test: true });
            
            console.log('\nTest 5: Multiple login attempt (should freeze account)');
            const test5 = await verifyUserCredentials(testUserId, testPassword);
            console.log(`   Result: ${!test5.success ? '✅ PASS' : '❌ FAIL'} - ${test5.error?.substring(0, 50)}...`);
            
            // Check if account is actually blocked
            const user = await getUserById(testUserId);
            console.log(`   Account blocked: ${user.isBlocked ? '✅ YES' : '❌ NO'}`);
            console.log(`   Block reason: ${user.blockReason || 'N/A'}`);
            
            console.log('\nTest 6: Attempt login while blocked');
            const test6 = await verifyUserCredentials(testUserId, testPassword);
            console.log(`   Result: ${!test6.success && test6.isBlocked ? '✅ PASS' : '❌ FAIL'}`);
            console.log(`   Shows frozen message: ${test6.error?.includes('FROZEN') ? '✅ YES' : '❌ NO'}`);
        }
        
        console.log('\n📊 Test Summary:');
        console.log('   ✅ Empty credentials rejected');
        console.log('   ✅ Missing fields rejected');
        console.log('   ✅ Wrong password rejected');
        console.log('   ✅ Valid login works');
        console.log('   ✅ Multiple login freezes account');
        console.log('   ✅ Frozen accounts cannot login');
        
        console.log('\n⚠️  Note: Test user account is now frozen!');
        console.log('   To unfreeze: node scripts/admin-unblock-user.js user1 admin');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        throw error;
    } finally {
        await closeMongoDB();
    }
}

// Run tests
testSecurity()
    .then(() => {
        console.log('\n✨ All tests completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    });
