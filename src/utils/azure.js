const { OpenAI } = require('openai');
require('dotenv').config();

// Azure OpenAI Configuration
const AZURE_API_KEY = process.env.REACT_APP_API_KEY;
const AZURE_ENDPOINT = process.env.REACT_APP_API_URL;
const AZURE_DEPLOYMENT = process.env.REACT_APP_DEPLOYMENT_ID;

// Azure Speech Configuration (for renderer process)
const SPEECH_KEY = process.env.REACT_APP_SPEECH_KEY;
const SPEECH_REGION = process.env.REACT_APP_SPEECH_REGION;

// Initialize Azure OpenAI client
const openai = new OpenAI({
    apiKey: AZURE_API_KEY,
    baseURL: `${AZURE_ENDPOINT}openai/deployments/${AZURE_DEPLOYMENT}`,
    defaultQuery: { 'api-version': '2024-08-01-preview' },
    defaultHeaders: { 'api-key': AZURE_API_KEY }
});

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
 * Send message to Azure OpenAI with streaming
 */
async function sendMessageToAzure(messages, onChunk, onComplete, onError) {
    try {
        const stream = await openai.chat.completions.create({
            model: AZURE_DEPLOYMENT,
            messages: messages,
            stream: true,
            temperature: 0.7,
            max_tokens: 2000,
            top_p: 0.95,
            frequency_penalty: 0,
            presence_penalty: 0
        });

        let fullResponse = '';
        
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullResponse += content;
                if (onChunk) onChunk(content);
            }
        }

        if (onComplete) onComplete(fullResponse);
        return fullResponse;
    } catch (error) {
        console.error('Azure OpenAI error:', error);
        if (onError) onError(error);
        throw error;
    }
}

/**
 * Analyze image with Azure OpenAI Vision
 */
async function analyzeImageWithAzure(base64Image, prompt, onComplete, onError) {
    try {
        const messages = [
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`
                        }
                    }
                ]
            }
        ];

        const response = await openai.chat.completions.create({
            model: AZURE_DEPLOYMENT,
            messages: messages,
            max_tokens: 1000,
            temperature: 0.7
        });

        const result = response.choices[0]?.message?.content || '';
        if (onComplete) onComplete(result);
        return result;
    } catch (error) {
        console.error('Azure Vision error:', error);
        if (onError) onError(error);
        throw error;
    }
}

/**
 * Check if Azure services are configured
 */
function isAzureConfigured() {
    return !!(AZURE_API_KEY && AZURE_ENDPOINT && AZURE_DEPLOYMENT && SPEECH_KEY && SPEECH_REGION);
}

module.exports = {
    sendMessageToAzure,
    analyzeImageWithAzure,
    startSpeechRecognition,
    stopSpeechRecognition,
    isAzureConfigured,
    AZURE_API_KEY,
    AZURE_ENDPOINT,
    AZURE_DEPLOYMENT,
    SPEECH_KEY,
    SPEECH_REGION
};
