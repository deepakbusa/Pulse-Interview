/**
 * Background Logger for Analytics
 * 
 * This module provides non-blocking logging for API requests, chat messages,
 * and usage statistics. All logging is done asynchronously using setImmediate
 * to ensure it doesn't impact real-time response performance.
 */

const {
    logAPIRequest,
    saveChatMessage,
    updateUsageStats,
    logAuditEvent,
} = require('./mongodb');

const storage = require('../storage');

/**
 * Log API request in background (fire and forget)
 * @param {Object} requestData - API request data
 */
function logAPIRequestAsync(requestData) {
    setImmediate(async () => {
        try {
            const session = storage.getCurrentSession();
            await logAPIRequest({
                ...requestData,
                userId: session.userId,
                sessionId: session.sessionId,
                timestamp: new Date(),
            });

            // Also update usage stats
            await updateUsageStats(session.userId, {
                apiCalls: 1,
                totalRequests: 1,
            });
        } catch (error) {
            console.error('[Background Logger] Error logging API request:', error);
        }
    });
}

/**
 * Count chat message in background without storing content (fire and forget)
 * @param {Object} messageData - Chat message metadata (no content stored)
 */
function logChatMessageAsync(messageData) {
    setImmediate(async () => {
        try {
            const session = storage.getCurrentSession();
            await saveChatMessage({
                ...messageData,
                userId: session.userId,
                sessionId: session.sessionId,
                timestamp: new Date(),
            });

            // Update usage stats
            await updateUsageStats(session.userId, {
                chatMessages: 1,
                totalRequests: 1,
            });
        } catch (error) {
            console.error('[Background Logger] Error logging chat message:', error);
        }
    });
}

/**
 * Log screenshot analysis in background
 * @param {Object} analysisData - Screenshot analysis data
 */
function logScreenshotAnalysisAsync(analysisData) {
    setImmediate(async () => {
        try {
            const session = storage.getCurrentSession();
            
            // Log as API request
            await logAPIRequest({
                service: 'azure-vision',
                operation: 'screenshot-analysis',
                ...analysisData,
                userId: session.userId,
                sessionId: session.sessionId,
                timestamp: new Date(),
            });

            // Update usage stats
            await updateUsageStats(session.userId, {
                screenshotsAnalyzed: 1,
                apiCalls: 1,
                totalRequests: 1,
            });
        } catch (error) {
            console.error('[Background Logger] Error logging screenshot analysis:', error);
        }
    });
}

/**
 * Log transcription session in background
 * @param {Object} transcriptionData - Transcription data
 */
function logTranscriptionAsync(transcriptionData) {
    setImmediate(async () => {
        try {
            const session = storage.getCurrentSession();
            
            // Log as API request
            await logAPIRequest({
                service: 'azure-speech',
                operation: 'transcription',
                ...transcriptionData,
                userId: session.userId,
                sessionId: session.sessionId,
                timestamp: new Date(),
            });

            // Update usage stats
            await updateUsageStats(session.userId, {
                transcriptionMinutes: transcriptionData.durationMinutes || 0,
                apiCalls: 1,
                totalRequests: 1,
            });
        } catch (error) {
            console.error('[Background Logger] Error logging transcription:', error);
        }
    });
}

/**
 * Log user action in background
 * @param {string} action - Action name
 * @param {Object} metadata - Additional metadata
 */
function logUserActionAsync(action, metadata = {}) {
    setImmediate(async () => {
        try {
            const session = storage.getCurrentSession();
            await logAuditEvent({
                userId: session.userId,
                action,
                status: 'success',
                metadata: {
                    ...metadata,
                    sessionId: session.sessionId,
                },
                timestamp: new Date(),
            });
        } catch (error) {
            console.error('[Background Logger] Error logging user action:', error);
        }
    });
}

/**
 * Log error in background
 * @param {string} action - Action that failed
 * @param {Error} error - Error object
 * @param {Object} metadata - Additional metadata
 */
function logErrorAsync(action, error, metadata = {}) {
    setImmediate(async () => {
        try {
            const session = storage.getCurrentSession();
            await logAuditEvent({
                userId: session.userId,
                action,
                status: 'failure',
                metadata: {
                    ...metadata,
                    error: error.message,
                    stack: error.stack,
                    sessionId: session.sessionId,
                },
                timestamp: new Date(),
            });
        } catch (err) {
            console.error('[Background Logger] Error logging error:', err);
        }
    });
}

/**
 * Wrapper for Azure OpenAI API calls with automatic logging
 * @param {Function} apiCall - The API call function
 * @param {Object} metadata - Request metadata
 * @returns {Promise} - API response
 */
async function withAPILogging(apiCall, metadata = {}) {
    const startTime = Date.now();
    
    try {
        // Execute the API call (blocking - this is user-facing)
        const response = await apiCall();
        
        // Log after response is ready (non-blocking)
        const duration = Date.now() - startTime;
        logAPIRequestAsync({
            ...metadata,
            status: 'success',
            duration,
        });
        
        return response;
    } catch (error) {
        // Log error (non-blocking)
        const duration = Date.now() - startTime;
        logAPIRequestAsync({
            ...metadata,
            status: 'error',
            duration,
            error: error.message,
        });
        
        logErrorAsync(metadata.operation || 'api-call', error, metadata);
        
        throw error; // Re-throw to maintain error handling
    }
}

/**
 * Wrapper for chat operations with automatic counting (no content storage)
 * @param {Function} chatCall - The chat function
 * @param {Object} metadata - Chat metadata (no message content)
 * @returns {Promise} - Chat response
 */
async function withChatLogging(chatCall, metadata = {}) {
    const startTime = Date.now();
    
    try {
        // Execute chat call (blocking - this is user-facing)
        const aiResponse = await chatCall();
        
        // Count chat after response (non-blocking, no content stored)
        const processingTime = Date.now() - startTime;
        logChatMessageAsync({
            profile: metadata.profile,
            model: metadata.model || 'openai_gpt',
            latencyMs: processingTime,
        });
        
        return aiResponse;
    } catch (error) {
        logErrorAsync('chat-call', error, metadata);
        throw error;
    }
}

module.exports = {
    // Direct logging functions (fire and forget)
    logAPIRequestAsync,
    logChatMessageAsync,
    logScreenshotAnalysisAsync,
    logTranscriptionAsync,
    logUserActionAsync,
    logErrorAsync,
    
    // Wrapper functions (wait for response, then log)
    withAPILogging,
    withChatLogging,
};
