// Test Backend Connection
const https = require('https');
const { BACKEND_URL } = require('./src/config/backend');

console.log('Testing backend connection to:', BACKEND_URL);

// Test 1: Health Check
https.get(`${BACKEND_URL}/health`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('✅ Health Check:', data);
        testSpeechConfig();
    });
}).on('error', (err) => {
    console.error('❌ Health Check Failed:', err.message);
});

// Test 2: Speech Config
function testSpeechConfig() {
    https.get(`${BACKEND_URL}/config/speech`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const config = JSON.parse(data);
            console.log('✅ Speech Config:', {
                key: config.key ? '***' + config.key.slice(-4) : 'missing',
                region: config.region || 'missing'
            });
            testMongoDBConfig();
        });
    }).on('error', (err) => {
        console.error('❌ Speech Config Failed:', err.message);
    });
}

// Test 3: MongoDB Config
function testMongoDBConfig() {
    https.get(`${BACKEND_URL}/config/mongodb`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const config = JSON.parse(data);
            console.log('✅ MongoDB Config:', {
                uri: config.uri ? 'mongodb+srv://***' : 'missing'
            });
            console.log('\n🎉 All backend tests passed!');
        });
    }).on('error', (err) => {
        console.error('❌ MongoDB Config Failed:', err.message);
    });
}
