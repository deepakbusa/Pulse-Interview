const { BACKEND_URL } = require('../config/backend');
const https = require('https');
const http = require('http');

/**
 * Sanitize error messages to remove URLs and sensitive information
 */
function sanitizeError(error) {
    let message = error.message || String(error);
    
    // Log for debugging
    console.log('Sanitizing error:', message);
    
    // Check for specific error codes first (before URL removal)
    if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
        console.log('Returning: No internet connection message');
        return 'No internet connection. Please check your network and try again.';
    }
    if (message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
        return 'Unable to connect to AI service. Please check your internet connection.';
    }
    if (message.includes('socket hang up') || message.includes('ECONNRESET')) {
        return 'Connection interrupted. Please try again.';
    }
    if (message.includes('timeout') || message.includes('TIMEOUT')) {
        return 'Request timed out. Please try again.';
    }
    
    // Remove URLs (http://, https://)
    message = message.replace(/https?:\/\/[^\s]+/g, '[server]');
    
    // Remove domain names (e.g., pulse-backend-1xa3.onrender.com)
    message = message.replace(/[a-z0-9-]+\.[a-z0-9-]+\.[a-z]{2,}/gi, '[server]');
    
    // Remove IP addresses
    message = message.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[server]');
    
    // Remove port numbers
    message = message.replace(/:\d{2,5}/g, '');
    
    console.log('Sanitized message:', message);
    return message || 'An unexpected error occurred. Please try again.';
}

// Backend will handle Azure credentials
let SPEECH_KEY = null;
let SPEECH_REGION = null;

// Fetch speech credentials from backend on startup
async function fetchSpeechCredentials() {
    try {
        const url = `${BACKEND_URL}/config/speech`;
        const protocol = url.startsWith('https') ? https : http;
        
        return new Promise((resolve, reject) => {
            protocol.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const config = JSON.parse(data);
                    SPEECH_KEY = config.key;
                    SPEECH_REGION = config.region;
                    console.log('Azure credentials fetched:', {
                        key: SPEECH_KEY ? 'Present' : 'Missing',
                        region: SPEECH_REGION || 'Missing'
                    });
                    resolve({ key: SPEECH_KEY, region: SPEECH_REGION });
                });
            }).on('error', reject);
        });
    } catch (error) {
        console.error('Failed to fetch speech credentials:', error);
        throw error;
    }
}

// Getter functions to access current values
function getSpeechCredentials() {
    return {
        key: SPEECH_KEY,
        region: SPEECH_REGION
    };
}

// Speech recognition is handled in renderer process using Web Speech API
// These are placeholder functions for main process compatibility
function startSpeechRecognition(onResult, onError) {
    console.log('Speech recognition should be started from renderer process');
    return true;
}

function stopSpeechRecognition() {
    console.log('Speech recognition should be stopped from renderer process');
    return true;
}

/**
 * Send message to Azure OpenAI via backend with streaming
 */
async function sendMessageToAzure(messages, onChunk, onComplete, onError) {
    try {
        const url = `${BACKEND_URL}/ai/chat`;
        const protocol = url.startsWith('https') ? https : http;
        
        const postData = JSON.stringify({
            messages: messages,
            stream: true
        });

        return new Promise((resolve, reject) => {
            const req = protocol.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let fullResponse = '';
                let buffer = ''; // Buffer for incomplete lines
                
                res.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    
                    // Keep the last incomplete line in the buffer
                    buffer = lines.pop() || '';
                    
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim();
                            if (data === '[DONE]') continue;
                            
                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices[0]?.delta?.content || '';
                                if (content) {
                                    fullResponse += content;
                                    if (onChunk) onChunk(content);
                                }
                            } catch (e) {
                                console.error('Failed to parse SSE data:', data, e);
                            }
                        }
                    }
                });

                res.on('end', () => {
                    if (onComplete) onComplete(fullResponse);
                    resolve(fullResponse);
                });
            });

            req.on('error', (error) => {
                console.error('Backend API error:', error);
                const sanitizedError = new Error(sanitizeError(error));
                if (onError) onError(sanitizedError);
                reject(sanitizedError);
            });

            req.write(postData);
            req.end();
        });
    } catch (error) {
        console.error('Azure OpenAI error:', error);
        const sanitizedError = new Error(sanitizeError(error));
        if (onError) onError(sanitizedError);
        throw sanitizedError;
    }
}

/**
 * Analyze image with Azure OpenAI Vision via backend
 */
async function analyzeImageWithAzure(base64Image, prompt, onComplete, onError) {
    try {
        const url = `${BACKEND_URL}/ai/vision`;
        const protocol = url.startsWith('https') ? https : http;
        
        const postData = JSON.stringify({
            imageBase64: base64Image,
            prompt: prompt
        });

        return new Promise((resolve, reject) => {
            const req = protocol.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        const result = response.analysis || response.result || '';
                        if (onComplete) onComplete(result);
                        resolve(result);
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Backend API error:', error);
                const sanitizedError = new Error(sanitizeError(error));
                if (onError) onError(sanitizedError);
                reject(sanitizedError);
            });

            req.write(postData);
            req.end();
        });
    } catch (error) {
        console.error('Azure Vision error:', error);
        const sanitizedError = new Error(sanitizeError(error));
        if (onError) onError(sanitizedError);
        throw sanitizedError;
    }
}

/**
 * Check if Azure services are configured
 */
function isAzureConfigured() {
    return !!(SPEECH_KEY && SPEECH_REGION);
}

module.exports = {
    sendMessageToAzure,
    analyzeImageWithAzure,
    startSpeechRecognition,
    stopSpeechRecognition,
    isAzureConfigured,
    fetchSpeechCredentials,
    getSpeechCredentials
};
