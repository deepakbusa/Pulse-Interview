/**
 * Session Monitor - Auto-logout on admin session termination
 * Periodically checks if the session is still valid on the backend
 */

const https = require('https');
const http = require('http');

// Dashboard backend URL (different from AI backend)
const DASHBOARD_BACKEND_URL = 'https://backend-six-eta-75.vercel.app';

let monitorInterval = null;
let currentSessionId = null;
let onForceLogoutCallback = null;

const CHECK_INTERVAL = 30000; // 30 seconds
const REQUEST_TIMEOUT = 10000; // 10 seconds

/**
 * Start monitoring session validity
 * @param {string} sessionId - The session ID to monitor
 * @param {function} onForceLogout - Callback function to execute when session is invalidated
 */
function startSessionMonitoring(sessionId, onForceLogout) {
    if (!sessionId) {
        console.error('❌ Cannot start monitoring: No session ID provided');
        return;
    }
    
    console.log('🔍 Starting session monitoring for:', sessionId);
    console.log('📊 Previous session:', currentSessionId);
    console.log('📊 Interval active:', monitorInterval !== null);
    
    currentSessionId = sessionId;
    onForceLogoutCallback = onForceLogout;
    
    // Stop any existing monitoring (but don't clear sessionId yet)
    if (monitorInterval) {
        console.log('🔄 Clearing existing interval');
        clearInterval(monitorInterval);
        monitorInterval = null;
    }
    
    // Check immediately
    console.log('🚀 Starting immediate session check...');
    checkSessionStatus();
    
    // Then check every 30 seconds
    console.log('⏰ Setting up 30-second interval...');
    monitorInterval = setInterval(() => {
        console.log('⏰ Interval triggered - checking session...');
        checkSessionStatus();
    }, CHECK_INTERVAL);
    
    console.log('✅ Session monitoring initialized successfully');
    console.log('📊 Monitoring session:', currentSessionId);
    console.log('📊 Interval ID:', monitorInterval);
}

/**
 * Stop monitoring session
 */
function stopSessionMonitoring() {
    console.log('🛑 Stopping session monitoring');
    console.log('📊 Was monitoring session:', currentSessionId);
    console.log('📊 Stack trace:', new Error().stack);
    
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
        console.log('✅ Interval cleared');
    } else {
        console.log('⚠️ No interval to clear');
    }
    
    currentSessionId = null;
    onForceLogoutCallback = null;
}

/**
 * Check if current session is still valid
 */
async function checkSessionStatus() {
    if (!currentSessionId) {
        console.log('⚠️ No session to monitor');
        return;
    }
    
    try {
        console.log('🔍 Checking session status...');
        const isValid = await validateSession(currentSessionId);
        
        if (!isValid) {
            console.log('❌ Session is no longer valid - Triggering force logout');
            handleInvalidSession();
        } else {
            console.log('✅ Session is still valid');
        }
    } catch (error) {
        // Don't logout on network errors - only logout when server explicitly says invalid
        console.error('⚠️ Session check failed (not logging out):', error.message);
    }
}

/**
 * Validate session with backend API
 * @param {string} sessionId - Session ID to validate
 * @returns {Promise<boolean>} - True if session is valid, false if invalid
 */
function validateSession(sessionId) {
    return new Promise((resolve, reject) => {
        const url = `${DASHBOARD_BACKEND_URL}/api/sessions/validate/${sessionId}`;
        const protocol = url.startsWith('https') ? https : http;
        
        console.log('📡 Calling validation API:', url);
        
        // Set timeout
        const timeoutId = setTimeout(() => {
            reject(new Error('Session validation timeout'));
        }, REQUEST_TIMEOUT);
        
        const request = protocol.get(url, (res) => {
            clearTimeout(timeoutId);
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    // Handle non-200 responses (server errors)
                    if (res.statusCode !== 200) {
                        console.error('Session validation HTTP error:', res.statusCode);
                        // Don't logout on server errors - return true to keep session
                        resolve(true);
                        return;
                    }
                    
                    const response = JSON.parse(data);
                    console.log('📥 Session validation response:', response);
                    
                    // Session is valid only if response.valid === true
                    resolve(response.valid === true);
                    
                } catch (error) {
                    console.error('Error parsing session validation response:', error);
                    // Don't logout on parse errors
                    resolve(true);
                }
            });
        });
        
        request.on('error', (error) => {
            clearTimeout(timeoutId);
            reject(error);
        });
        
        request.setTimeout(REQUEST_TIMEOUT, () => {
            request.destroy();
            reject(new Error('Session validation request timeout'));
        });
    });
}

/**
 * Handle invalid session - trigger force logout
 */
function handleInvalidSession() {
    console.log('⚠️ Handling invalid session - forcing logout');
    console.log('📊 Callback exists:', typeof onForceLogoutCallback === 'function');
    console.log('📊 Callback value:', onForceLogoutCallback);
    
    // Save callback reference BEFORE stopping (which clears it)
    const callback = onForceLogoutCallback;
    
    // Stop monitoring (this will clear the callback reference)
    stopSessionMonitoring();
    
    // Trigger callback if it was provided
    if (callback && typeof callback === 'function') {
        console.log('✅ Triggering force logout callback...');
        try {
            callback({
                reason: 'Session ended by administrator',
                message: 'Your session has been ended by an administrator. Please login again.'
            });
            console.log('✅ Force logout callback executed successfully');
        } catch (error) {
            console.error('❌ Error executing force logout callback:', error);
        }
    } else {
        console.error('❌ No force logout callback available!');
    }
}

/**
 * Check if monitoring is active
 * @returns {boolean}
 */
function isMonitoring() {
    return monitorInterval !== null;
}

/**
 * Get current monitored session ID
 * @returns {string|null}
 */
function getCurrentMonitoredSession() {
    return currentSessionId;
}

module.exports = {
    startSessionMonitoring,
    stopSessionMonitoring,
    checkSessionStatus,
    isMonitoring,
    getCurrentMonitoredSession,
};
