/**
 * INTEGRATION EXAMPLE: Background Logging
 * 
 * This file shows how to integrate background logging into
 * Azure API calls without impacting performance.
 */

const {
    logAPIRequestAsync,
    logChatMessageAsync,
    logScreenshotAnalysisAsync,
    logTranscriptionAsync,
    withAPILogging,
    withChatLogging,
} = require('../utils/backgroundLogger');

// ==================== METHOD 1: Manual Logging ====================
// Use after getting the response, before returning to user

async function sendMessageToAI_Manual(userMessage) {
    const startTime = Date.now();
    
    try {
        // Make the API call (blocking - user waits for this)
        const response = await azureOpenAI.chat({
            messages: [{ role: 'user', content: userMessage }],
        });
        
        // Calculate duration
        const duration = Date.now() - startTime;
        
        // Log in background (non-blocking - fire and forget)
        logAPIRequestAsync({
            service: 'azure-openai',
            operation: 'chat-completion',
            status: 'success',
            duration,
            metadata: {
                model: 'gpt-4o',
                tokensUsed: response.usage?.total_tokens,
            },
        });
        
        // Log chat message
        logChatMessageAsync({
            role: 'user',
            message: userMessage,
            profile: 'interview',
        });
        
        logChatMessageAsync({
            role: 'assistant',
            message: response.content,
            profile: 'interview',
            metadata: {
                model: 'gpt-4o',
                tokensUsed: response.usage?.total_tokens,
                processingTime: duration,
            },
        });
        
        // Return response immediately (logging happens in background)
        return response.content;
        
    } catch (error) {
        const duration = Date.now() - startTime;
        
        // Log error in background
        logAPIRequestAsync({
            service: 'azure-openai',
            operation: 'chat-completion',
            status: 'error',
            duration,
            error: error.message,
        });
        
        throw error;
    }
}

// ==================== METHOD 2: Wrapper Logging ====================
// Cleaner - automatic logging with wrapper function

async function sendMessageToAI_Wrapper(userMessage) {
    // Wrapper handles all logging automatically
    return await withChatLogging(
        // The actual API call
        async () => {
            const response = await azureOpenAI.chat({
                messages: [{ role: 'user', content: userMessage }],
            });
            return response.content;
        },
        // User message
        userMessage,
        // Metadata
        {
            profile: 'interview',
            model: 'gpt-4o',
        }
    );
}

// ==================== SCREENSHOT ANALYSIS ====================

async function analyzeScreenshot(base64Image) {
    const startTime = Date.now();
    
    try {
        // Call Azure Vision API (blocking - user waits)
        const result = await azureVision.analyzeImage(base64Image);
        
        // Return result to user immediately
        const response = {
            description: result.description,
            objects: result.objects,
            text: result.text,
        };
        
        // Log in background AFTER showing result to user
        logScreenshotAnalysisAsync({
            status: 'success',
            duration: Date.now() - startTime,
            metadata: {
                objectsFound: result.objects?.length || 0,
                textDetected: !!result.text,
            },
        });
        
        return response;
        
    } catch (error) {
        logScreenshotAnalysisAsync({
            status: 'error',
            duration: Date.now() - startTime,
            error: error.message,
        });
        
        throw error;
    }
}

// ==================== TRANSCRIPTION ====================

async function startTranscription() {
    const startTime = Date.now();
    let transcribedText = '';
    
    // Start Azure Speech recognition (non-blocking streaming)
    const recognizer = createAzureSpeechRecognizer();
    
    recognizer.recognized = (s, e) => {
        if (e.result.text) {
            transcribedText += e.result.text + ' ';
        }
    };
    
    recognizer.sessionStopped = (s, e) => {
        const durationMs = Date.now() - startTime;
        const durationMinutes = Math.round(durationMs / 60000);
        
        // Log after session ends (non-blocking)
        logTranscriptionAsync({
            status: 'success',
            duration: durationMs,
            durationMinutes,
            metadata: {
                textLength: transcribedText.length,
                wordCount: transcribedText.split(' ').length,
            },
        });
    };
    
    await recognizer.startContinuousRecognitionAsync();
    
    return recognizer;
}

// ==================== INTEGRATION IN RENDERER ====================

// In src/utils/renderer.js or azureHandlers.js:

/*
// Import background logger
const {
    logAPIRequestAsync,
    logChatMessageAsync,
    logScreenshotAnalysisAsync,
} = require('./backgroundLogger');

// Modify existing captureManualScreenshot function:
async function captureManualScreenshot(imageQuality = null) {
    const startTime = Date.now();
    
    try {
        // ... existing screenshot capture code ...
        
        const result = await ipcRenderer.invoke('azure:analyze-screenshot', {
            base64Image,
            prompt: MANUAL_SCREENSHOT_PROMPT || 'Analyze this screenshot'
        });
        
        if (result.success) {
            // Show result to user first
            console.log('✅ Screenshot analyzed:', result.analysis);
            
            // THEN log in background (fire and forget)
            logScreenshotAnalysisAsync({
                status: 'success',
                duration: Date.now() - startTime,
                metadata: {
                    quality: imageQuality,
                    responseLength: result.analysis?.length,
                },
            });
            
            return result;
        }
        
    } catch (error) {
        console.error('❌ Screenshot analysis failed:', error);
        
        // Log error (fire and forget)
        logScreenshotAnalysisAsync({
            status: 'error',
            duration: Date.now() - startTime,
            error: error.message,
        });
        
        throw error;
    }
}

// Modify existing Azure Speech handlers:
ipcRenderer.on('azure:speech-recognized', (event, data) => {
    // Show transcription to user immediately
    transcriptionText += data.text + ' ';
    updateUI();
    
    // THEN log in background (fire and forget)
    logAPIRequestAsync({
        service: 'azure-speech',
        operation: 'speech-to-text',
        status: 'success',
        duration: 1000, // estimated
        metadata: {
            textLength: data.text.length,
        },
    });
});

// Modify message sending to AI:
async function sendMessageToAI(message) {
    const startTime = Date.now();
    
    // Log user message immediately (fire and forget)
    logChatMessageAsync({
        role: 'user',
        message,
        profile: selectedProfile,
    });
    
    try {
        // Send to AI (blocking - user waits)
        const response = await fetch('azure-openai-endpoint', {
            method: 'POST',
            body: JSON.stringify({ messages: [{ role: 'user', content: message }] }),
        });
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        // Show to user first
        displayAIResponse(aiResponse);
        
        // THEN log in background (fire and forget)
        const duration = Date.now() - startTime;
        
        logAPIRequestAsync({
            service: 'azure-openai',
            operation: 'chat-completion',
            status: 'success',
            duration,
            metadata: {
                model: 'gpt-4o',
                tokensUsed: data.usage?.total_tokens,
            },
        });
        
        logChatMessageAsync({
            role: 'assistant',
            message: aiResponse,
            profile: selectedProfile,
            metadata: {
                model: 'gpt-4o',
                processingTime: duration,
            },
        });
        
        return aiResponse;
        
    } catch (error) {
        // Log error (fire and forget)
        logAPIRequestAsync({
            service: 'azure-openai',
            operation: 'chat-completion',
            status: 'error',
            duration: Date.now() - startTime,
            error: error.message,
        });
        
        throw error;
    }
}
*/

// ==================== KEY PRINCIPLES ====================

/*
1. NEVER await logging calls in critical paths
2. Use setImmediate() or fire-and-forget pattern
3. Log AFTER showing response to user, not before
4. Keep session info in storage.getCurrentSession()
5. Catch and suppress logging errors silently
6. Use async/await only when necessary

PERFORMANCE IMPACT: ZERO
- Logging runs in separate event loop tick
- No blocking operations
- User sees response immediately
- MongoDB writes happen in background
*/

module.exports = {
    sendMessageToAI_Manual,
    sendMessageToAI_Wrapper,
    analyzeScreenshot,
    startTranscription,
};
