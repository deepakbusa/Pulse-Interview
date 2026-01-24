// Quick script to check database contents
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkDatabase() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db('pulse_crackmate');
        
        // Check api_requests collection
        const requestsCount = await db.collection('api_requests').countDocuments();
        console.log('\n📊 Total api_requests:', requestsCount);
        
        // Get recent requests
        const recentRequests = await db.collection('api_requests')
            .find({})
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();
        
        console.log('\n📝 Recent 10 requests:');
        recentRequests.forEach((req, i) => {
            console.log(`${i + 1}. Service: ${req.service}, Model: ${req.model}, User: ${req.userId}, Time: ${req.timestamp}`);
        });
        
        // Group by model
        const byModel = await db.collection('api_requests').aggregate([
            { $group: { _id: '$model', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();
        
        console.log('\n📈 Requests by model:');
        byModel.forEach(m => {
            console.log(`  ${m._id}: ${m.count}`);
        });
        
        // Check sessions
        const activeSessions = await db.collection('sessions').countDocuments({ status: 'active' });
        const allSessions = await db.collection('sessions').countDocuments();
        console.log(`\n🔐 Sessions: ${activeSessions} active, ${allSessions} total`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

checkDatabase();
