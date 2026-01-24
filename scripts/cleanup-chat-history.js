/**
 * Cleanup Script: Remove chat_history collection to save storage
 * 
 * This script drops the chat_history collection which stores full message content.
 * The app now only stores request counts, not message content, to save storage space.
 */

const { connectToMongoDB, closeMongoDB } = require('../src/utils/mongodb');

async function cleanupChatHistory() {
    console.log('🧹 Starting chat history cleanup...');
    
    try {
        const db = await connectToMongoDB();
        
        // Check if chat_history collection exists
        const collections = await db.listCollections({ name: 'chat_history' }).toArray();
        
        if (collections.length === 0) {
            console.log('✅ No chat_history collection found - nothing to clean up');
            return;
        }
        
        // Get collection stats before deletion
        const stats = await db.collection('chat_history').stats();
        const messageCount = stats.count;
        const storageSize = (stats.storageSize / 1024 / 1024).toFixed(2); // Convert to MB
        
        console.log(`📊 Found ${messageCount} messages using ${storageSize} MB`);
        console.log('🗑️  Dropping chat_history collection...');
        
        // Drop the collection
        await db.collection('chat_history').drop();
        
        console.log(`✅ Successfully deleted chat_history collection!`);
        console.log(`💾 Freed up approximately ${storageSize} MB of storage`);
        console.log('');
        console.log('ℹ️  The app will now only store:');
        console.log('   - Request counts (how many chats)');
        console.log('   - Metadata (timestamp, model, latency)');
        console.log('   - NO message content');
        
    } catch (error) {
        console.error('❌ Error cleaning up chat history:', error);
        throw error;
    } finally {
        await closeMongoDB();
        console.log('🔌 Database connection closed');
    }
}

// Run cleanup
cleanupChatHistory()
    .then(() => {
        console.log('\n✨ Cleanup complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Cleanup failed:', error);
        process.exit(1);
    });
