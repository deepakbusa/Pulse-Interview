const { ipcMain, BrowserWindow } = require('electron');
const {
    sendMessageToAzure,
    analyzeImageWithAzure,
    startSpeechRecognition,
    stopSpeechRecognition,
    isAzureConfigured
} = require('./azure');
const { getSystemPrompt } = require('./prompts');
const {
    logAPIRequestAsync,
    logScreenshotAnalysisAsync,
} = require('./backgroundLogger');

let currentConversationHistory = [];
let currentProfile = 'interview';
let currentCustomPrompt = '';
let isSessionActive = false;

function sendToRenderer(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
    }
}

function setupAzureIpcHandlers() {
    console.log('[INIT] Setting up Azure IPC handlers...');
    
    // Check if Azure is configured
    ipcMain.handle('azure:is-configured', async () => {
        return { success: true, configured: isAzureConfigured() };
    });

    // Start Azure session
    ipcMain.handle('azure:start-session', async (event, { profile, customPrompt, language }) => {
        try {
            console.log('Starting Azure session with profile:', profile);
            
            currentProfile = profile || 'interview';
            currentCustomPrompt = customPrompt || '';
            currentConversationHistory = [];
            isSessionActive = true;

            // Initialize with system prompt
            const systemPrompt = getSystemPrompt(currentProfile, currentCustomPrompt, language || 'en-US');
            currentConversationHistory.push({
                role: 'system',
                content: systemPrompt
            });

            sendToRenderer('session-started', { 
                success: true, 
                provider: 'azure',
                model: 'gpt-4o'
            });

            return { success: true, message: 'Azure session started successfully' };
        } catch (error) {
            console.error('Error starting Azure session:', error);
            return { success: false, error: error.message };
        }
    });

    // Stop Azure session
    ipcMain.handle('azure:stop-session', async () => {
        try {
            console.log('Stopping Azure session');
            isSessionActive = false;
            currentConversationHistory = [];
            stopSpeechRecognition();
            
            sendToRenderer('session-stopped', { success: true });
            return { success: true };
        } catch (error) {
            console.error('Error stopping Azure session:', error);
            return { success: false, error: error.message };
        }
    });

    // Send text message
    ipcMain.handle('azure:send-message', async (event, { message, context }) => {
        try {
            console.log('Sending message to Azure:', message);

            // Add user message to history
            currentConversationHistory.push({
                role: 'user',
                content: message
            });

            let fullResponse = '';
            const startTime = Date.now();

            await sendMessageToAzure(
                currentConversationHistory,
                (chunk) => {
                    // Stream chunks to renderer
                    sendToRenderer('azure:message-chunk', { chunk });
                },
                (response) => {
                    fullResponse = response;
                    const latencyMs = Date.now() - startTime;
                    
                    // Add assistant response to history
                    currentConversationHistory.push({
                        role: 'assistant',
                        content: response
                    });

                    sendToRenderer('azure:message-complete', { response });
                    
                    // Log API request (fire-and-forget, never blocks response)
                    setImmediate(() => {
                        logAPIRequestAsync({
                            service: 'azure_openai',
                            model: 'openai_gpt',
                            endpoint: '/chat/completions',
                            latencyMs,
                            statusCode: 200,
                            success: true,
                        });
                    });
                },
                (error) => {
                    console.error('Azure message error:', error);
                    sendToRenderer('azure:message-error', { error: error.message });
                }
            );

            return { success: true, response: fullResponse };
        } catch (error) {
            console.error('Error sending message:', error);
            return { success: false, error: error.message };
        }
    });

    // Analyze screenshot
    ipcMain.handle('azure:analyze-screenshot', async (event, { base64Image, prompt }) => {
        try {
            console.log('Analyzing screenshot with Azure Vision');
            const startTime = Date.now();

            const fullPrompt = prompt || `Based on what you see in this screenshot, provide helpful context or suggestions relevant to ${currentProfile} scenario.`;

            const response = await analyzeImageWithAzure(
                base64Image,
                fullPrompt,
                (result) => {
                    const latencyMs = Date.now() - startTime;
                    
                    sendToRenderer('azure:analysis-complete', { result });
                    
                    // Log after response is shown (fire-and-forget, never blocks)
                    setImmediate(() => {
                        logScreenshotAnalysisAsync({
                            prompt: fullPrompt,
                            response: result,
                            model: 'gpt-4o-vision',
                            latencyMs,
                        });
                        
                        logAPIRequestAsync({
                            service: 'azure_vision',
                            model: 'gpt-4o-vision',
                            endpoint: '/vision/analyze',
                            latencyMs,
                            statusCode: 200,
                            success: true,
                        });
                    });
                },
                (error) => {
                    console.error('Azure vision error:', error);
                    sendToRenderer('azure:analysis-error', { error: error.message });
                }
            );

            return { success: true, analysis: response };
        } catch (error) {
            console.error('Error analyzing screenshot:', error);
            return { success: false, error: error.message };
        }
    });

    // Handle recognized speech from renderer
    ipcMain.handle('azure:speech-recognized', async (event, { text }) => {
        try {
            if (isSessionActive && text.trim()) {
                console.log('Processing recognized speech:', text);
                const startTime = Date.now();
                
                // Add to conversation and get response
                currentConversationHistory.push({
                    role: 'user',
                    content: text
                });

                await sendMessageToAzure(
                    currentConversationHistory,
                    (chunk) => {
                        sendToRenderer('azure:message-chunk', { chunk });
                    },
                    (response) => {
                        const latencyMs = Date.now() - startTime;
                        
                        currentConversationHistory.push({
                            role: 'assistant',
                            content: response
                        });
                        sendToRenderer('azure:message-complete', { response });
                        
                        // Log API request (fire-and-forget, never blocks response)
                        setImmediate(() => {
                            logAPIRequestAsync({
                                service: 'azure_openai',
                                model: 'openai_gpt',
                                endpoint: '/chat/completions',
                                latencyMs,
                                statusCode: 200,
                                success: true,
                            });
                        });
                    },
                    (error) => {
                        console.error('Azure message error:', error);
                        sendToRenderer('azure:message-error', { error: error.message });
                    }
                );
            }
            return { success: true };
        } catch (error) {
            console.error('Error processing speech:', error);
            return { success: false, error: error.message };
        }
    });

    // Get conversation history
    ipcMain.handle('azure:get-history', async () => {
        return { success: true, history: currentConversationHistory };
    });

    // Clear conversation history
    ipcMain.handle('azure:clear-history', async () => {
        const systemPrompt = currentConversationHistory[0]; // Keep system prompt
        currentConversationHistory = systemPrompt ? [systemPrompt] : [];
        return { success: true };
    });

    // Relay speech events from renderer to all windows
    ipcMain.on('azure:speech-recognizing', (event, data) => {
        sendToRenderer('azure:speech-recognizing', data);
    });

    ipcMain.on('azure:speech-recognized', (event, data) => {
        sendToRenderer('azure:speech-recognized', data);
    });

    ipcMain.on('azure:speech-session-started', (event, data) => {
        sendToRenderer('azure:speech-session-started', data);
    });

    ipcMain.on('azure:speech-session-stopped', (event, data) => {
        sendToRenderer('azure:speech-session-stopped', data);
    });

    // Log speech transcription requests
    console.log('✅ [MAIN PROCESS] Registering azure:log-speech-request handler');
    console.error('✅ [MAIN PROCESS - STDERR] Registering azure:log-speech-request handler'); // stderr always shows
    ipcMain.on('azure:log-speech-request', (event, data) => {
        console.log('🎤 [Main Process] Received speech log request:', data);
        console.error('🎤 [Main Process - STDERR] Received speech log request:', data); // stderr always shows
        
        // Fire and forget - don't block main process
        setImmediate(() => {
            try {
                const storage = require('../storage'); // Fixed: correct relative path
                const session = storage.getCurrentSession();
                console.log('📝 [Main Process] Current session:', session?.userId || 'NO SESSION');
                
                if (session && session.userId) {
                    // logAPIRequestAsync is already non-blocking (uses setImmediate internally)
                    logAPIRequestAsync({
                        service: 'azure_speech',
                        model: 'azure_speech',
                        endpoint: '/speech/recognize',
                        latencyMs: 0,
                        statusCode: 200,
                        success: true,
                    });
                    console.log('✅ [Main Process] Speech request logged (async)');
                } else {
                    console.warn('⚠️ [Main Process] No active session, speech request NOT logged');
                }
            } catch (error) {
                console.error('❌ [Main Process] Error logging speech request:', error);
            }
        });
    });
}

function stopAzureSpeechRecognition() {
    stopSpeechRecognition();
}

module.exports = {
    setupAzureIpcHandlers,
    stopAzureSpeechRecognition
};
