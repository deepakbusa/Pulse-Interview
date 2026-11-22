// Backend Configuration
const BACKEND_URL = 'https://pulse-backend-1xa3.onrender.com';

/**
 * Ping backend to wake it up if it's sleeping (Render free tier cold start prevention)
 */
async function pingBackend() {
    const https = require('https');
    return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 5000);
        https.get(`${BACKEND_URL}/health`, (res) => {
            clearTimeout(timeout);
            resolve(res.statusCode === 200);
        }).on('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });
    });
}

module.exports = { BACKEND_URL, pingBackend };
