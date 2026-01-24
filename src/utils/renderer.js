// renderer.js
const { ipcRenderer } = require('electron');

let mediaStream = null;
let screenshotInterval = null;
let audioContext = null;
let audioProcessor = null;
let micAudioProcessor = null;
let audioBuffer = [];
const SAMPLE_RATE = 24000;
const AUDIO_CHUNK_DURATION = 0.1; // seconds
const BUFFER_SIZE = 4096; // Increased buffer size for smoother audio

let hiddenVideo = null;
let offscreenCanvas = null;
let offscreenContext = null;
let currentImageQuality = 'medium'; // Store current image quality for manual screenshots

const isLinux = process.platform === 'linux';
const isMacOS = process.platform === 'darwin';

// ============ AZURE SPEECH RECOGNITION (RENDERER) ============
let azureSpeechRecognizer = null;
let isSpeechActive = false;
let SpeechSDK = null;
let isFirstAzureChunk = true; // Track if next chunk is first in new response
let isAzureActive = true; // Track if Azure session is active (default to true)

// Dynamically load Azure Speech SDK
async function loadAzureSpeechSDK() {
    if (SpeechSDK) return SpeechSDK;
    
    try {
        SpeechSDK = require('microsoft-cognitiveservices-speech-sdk');
        return SpeechSDK;
    } catch (error) {
        console.error('Failed to load Azure Speech SDK:', error);
        return null;
    }
}

// Create audio config from system audio (loopback)
async function createSystemAudioConfig(sdk) {
    try {
        console.log('🔊 Requesting system audio capture permission...');
        
        // Request system audio capture using getDisplayMedia
        // This will show a system dialog to select what to share
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                displaySurface: 'monitor',
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 1 }
            },
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                channelCount: 2,
                sampleRate: { ideal: 16000 }
            },
            preferCurrentTab: false,
            selfBrowserSurface: 'exclude',
            systemAudio: 'include'
        });

        if (!stream) {
            console.error('Failed to get system audio stream');
            throw new Error('No stream available');
        }

        // Check for audio tracks
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
            console.warn('⚠️ No audio track found in capture');
            // Stop video track if no audio
            stream.getVideoTracks().forEach(track => track.stop());
            throw new Error('No audio track available');
        }

        console.log('✅ System audio capture enabled:', audioTracks[0].label);
        
        // Stop video track as we only need audio
        stream.getVideoTracks().forEach(track => track.stop());

        // Create AudioStreamFormat for 16kHz mono (Azure Speech SDK requirement)
        const format = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
        
        // Create push stream
        const pushStream = sdk.AudioInputStream.createPushStream(format);
        
        // Set up Web Audio API to process the stream
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(stream);
        
        // Create a script processor or audio worklet
        const processor = audioContext.createScriptProcessor(4096, 2, 1);
        
        processor.onaudioprocess = (e) => {
            // Mix stereo to mono and get data
            const leftChannel = e.inputBuffer.getChannelData(0);
            const rightChannel = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : leftChannel;
            
            // Convert float32 to int16 PCM
            const int16Data = new Int16Array(leftChannel.length);
            for (let i = 0; i < leftChannel.length; i++) {
                // Mix stereo to mono
                const sample = (leftChannel[i] + rightChannel[i]) / 2;
                const s = Math.max(-1, Math.min(1, sample));
                int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Push to Azure Speech SDK
            pushStream.write(int16Data.buffer);
        };
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        
        // Store for cleanup
        window.systemAudioStream = stream;
        window.systemAudioContext = audioContext;
        window.systemAudioProcessor = processor;
        window.systemPushStream = pushStream;
        
        console.log('🎵 System audio pipeline configured');
        
        return sdk.AudioConfig.fromStreamInput(pushStream);
        
    } catch (error) {
        console.error('❌ Error setting up system audio capture:', error);
        console.log('ℹ️ Make sure to:');
        console.log('   1. Select "Entire screen" or a window in the system dialog');
        console.log('   2. Check "Share audio" checkbox in the dialog');
        console.log('   3. Grant permission when prompted');
        console.log('');
        console.log('⚠️ Falling back to microphone input');
        return sdk.AudioConfig.fromDefaultMicrophoneInput();
    }
}

async function initializeAzureSpeechRecognition() {
    const sdk = await loadAzureSpeechSDK();
    if (!sdk) {
        console.error('Azure Speech SDK not available');
        return null;
    }
    
    // Get Azure Speech credentials from environment
    const speechKey = process.env.REACT_APP_SPEECH_KEY;
    const speechRegion = process.env.REACT_APP_SPEECH_REGION;
    
    if (!speechKey || !speechRegion) {
        console.error('Azure Speech credentials not configured');
        return null;
    }
    
    const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
    speechConfig.speechRecognitionLanguage = 'en-US';
    
    // Capture system audio (loopback) instead of microphone
    const audioConfig = await createSystemAudioConfig(sdk);
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    
    // Interim results (while speaking)
    recognizer.recognizing = (s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizingSpeech && e.result.text) {
            const text = e.result.text;
            console.log('Azure Speech recognizing (interim):', text);
            
            // Send interim result to renderer for real-time display
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('azure:speech-recognizing', { text });
            }
        }
    };
    
    // Final recognition events
    recognizer.recognized = async (s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) {
            const text = e.result.text;
            console.log('Azure Speech recognized (final):', text);
            
            // ONLY send final result to renderer for display accumulation
            // NO AUTO-SEND - user must press Ctrl+D to send
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                
                // Test IPC first
                console.log('🧪 Testing IPC communication...');
                ipcRenderer.send('test-ipc', { test: 'data' });
                
                ipcRenderer.send('azure:speech-recognized', { text });
                
                // Log speech transcription request
                console.log('🎤 Sending speech request log to main process');
                ipcRenderer.send('azure:log-speech-request', { 
                    textLength: text.length,
                    timestamp: Date.now()
                });
                console.log('✅ Speech log IPC sent');
            }
            
            // DO NOT auto-send or process - wait for Ctrl+D
        }
    };
    
    recognizer.sessionStarted = (s, e) => {
        console.log('Azure Speech session started');
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('azure:speech-session-started');
        }
    };
    
    recognizer.canceled = (s, e) => {
        console.log('Azure Speech canceled:', e.reason);
        if (e.reason === sdk.CancellationReason.Error) {
            console.error('Azure Speech error:', e.errorDetails);
            cheatingDaddy.setStatus('Speech recognition error - Check microphone');
            stopAzureSpeechRecognition();
        }
    };
    
    recognizer.sessionStopped = (s, e) => {
        console.log('Azure Speech session stopped');
        isSpeechActive = false;
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('azure:speech-session-stopped');
        }
    };
    
    return recognizer;
}

async function startAzureSpeechRecognition() {
    // Stop any existing recognizer first
    if (azureSpeechRecognizer && isSpeechActive) {
        console.log('Stopping existing Azure Speech Recognition...');
        await new Promise((resolve) => {
            azureSpeechRecognizer.stopContinuousRecognitionAsync(
                () => {
                    console.log('Previous recognizer stopped');
                    resolve();
                },
                () => {
                    console.log('Error stopping previous recognizer, continuing anyway');
                    resolve();
                }
            );
        });
        isSpeechActive = false;
    }
    
    // Always create a fresh recognizer to ensure clean state
    console.log('🎤 Initializing new Azure Speech Recognition...');
    azureSpeechRecognizer = await initializeAzureSpeechRecognition();
    
    if (!azureSpeechRecognizer) {
        console.error('Could not initialize Azure Speech Recognition');
        cheatingDaddy.setStatus('Voice recognition unavailable');
        return;
    }

    try {
        await new Promise((resolve, reject) => {
            azureSpeechRecognizer.startContinuousRecognitionAsync(
                () => {
                    isSpeechActive = true;
                    console.log('✅ Azure Speech Recognition started successfully');
                    cheatingDaddy.setStatus('🎤 Listening... (Azure Speech Active)');
                    resolve();
                },
                (err) => {
                    console.error('❌ Failed to start Azure Speech recognition:', err);
                    cheatingDaddy.setStatus('Failed to start voice recognition');
                    reject(err);
                }
            );
        });
    } catch (error) {
        console.error('Exception starting speech recognition:', error);
    }
}

function stopAzureSpeechRecognition() {
    if (azureSpeechRecognizer && isSpeechActive) {
        console.log('🛑 Stopping Azure Speech Recognition...');
        azureSpeechRecognizer.stopContinuousRecognitionAsync(
            () => {
                isSpeechActive = false;
                console.log('✅ Azure Speech Recognition stopped');
                cheatingDaddy.setStatus('Voice recognition stopped');
                
                // Cleanup system audio resources
                cleanupSystemAudio();
                
                // Clear the recognizer to force fresh initialization next time
                azureSpeechRecognizer = null;
            },
            (err) => {
                console.error('❌ Error stopping Azure Speech recognition:', err);
                isSpeechActive = false;
                cleanupSystemAudio();
                azureSpeechRecognizer = null;
            }
        );
    } else {
        console.log('No active speech recognition to stop');
        // Clean up anyway
        cleanupSystemAudio();
        azureSpeechRecognizer = null;
        isSpeechActive = false;
    }
}

// Cleanup system audio capture resources
function cleanupSystemAudio() {
    if (window.systemAudioStream) {
        window.systemAudioStream.getTracks().forEach(track => track.stop());
        window.systemAudioStream = null;
        console.log('🛑 System audio stream stopped');
    }
    if (window.systemAudioProcessor) {
        window.systemAudioProcessor.disconnect();
        window.systemAudioProcessor = null;
    }
    if (window.systemPushStream) {
        try {
            window.systemPushStream.close();
        } catch (e) {}
        window.systemPushStream = null;
    }
    if (window.systemAudioContext) {
        window.systemAudioContext.close();
        window.systemAudioContext = null;
    }
}

// ============ STORAGE API ============
// Wrapper for IPC-based storage access
const storage = {
    // Config
    async getConfig() {
        const result = await ipcRenderer.invoke('storage:get-config');
        return result.success ? result.data : {};
    },
    async setConfig(config) {
        return ipcRenderer.invoke('storage:set-config', config);
    },
    async updateConfig(key, value) {
        return ipcRenderer.invoke('storage:update-config', key, value);
    },

    // Credentials
    async getCredentials() {
        const result = await ipcRenderer.invoke('storage:get-credentials');
        return result.success ? result.data : {};
    },
    async setCredentials(credentials) {
        return ipcRenderer.invoke('storage:set-credentials', credentials);
    },
    async getApiKey() {
        const result = await ipcRenderer.invoke('storage:get-api-key');
        return result.success ? result.data : '';
    },
    async setApiKey(apiKey) {
        return ipcRenderer.invoke('storage:set-api-key', apiKey);
    },

    // Pulse Credentials (Login)
    async getPulseCredentials() {
        const result = await ipcRenderer.invoke('storage:get-pulse-credentials');
        return result.success ? result.data : { userId: '', password: '' };
    },
    async setPulseCredentials(userId, password) {
        return ipcRenderer.invoke('storage:set-pulse-credentials', userId, password);
    },
    async verifyPulseCredentials(userId, password) {
        const result = await ipcRenderer.invoke('storage:verify-pulse-credentials', userId, password);
        return result.success ? result.data : false;
    },
    async hasPulseCredentials() {
        const result = await ipcRenderer.invoke('storage:has-pulse-credentials');
        return result.success ? result.data : false;
    },
    async getAllUsers() {
        const result = await ipcRenderer.invoke('storage:get-all-users');
        return result.success ? result.data : [];
    },

    // Preferences
    async getPreferences() {
        const result = await ipcRenderer.invoke('storage:get-preferences');
        return result.success ? result.data : {};
    },
    async setPreferences(preferences) {
        return ipcRenderer.invoke('storage:set-preferences', preferences);
    },
    async updatePreference(key, value) {
        return ipcRenderer.invoke('storage:update-preference', key, value);
    },

    // Keybinds
    async getKeybinds() {
        const result = await ipcRenderer.invoke('storage:get-keybinds');
        return result.success ? result.data : null;
    },
    async setKeybinds(keybinds) {
        return ipcRenderer.invoke('storage:set-keybinds', keybinds);
    },

    // Sessions (History)
    async getAllSessions() {
        const result = await ipcRenderer.invoke('storage:get-all-sessions');
        return result.success ? result.data : [];
    },
    async getSession(sessionId) {
        const result = await ipcRenderer.invoke('storage:get-session', sessionId);
        return result.success ? result.data : null;
    },
    async saveSession(sessionId, data) {
        return ipcRenderer.invoke('storage:save-session', sessionId, data);
    },
    async deleteSession(sessionId) {
        return ipcRenderer.invoke('storage:delete-session', sessionId);
    },
    async deleteAllSessions() {
        return ipcRenderer.invoke('storage:delete-all-sessions');
    },

    // Clear all
    async clearAll() {
        return ipcRenderer.invoke('storage:clear-all');
    },

    // Limits
    async getTodayLimits() {
        const result = await ipcRenderer.invoke('storage:get-today-limits');
        return result.success ? result.data : { flash: { count: 0 }, flashLite: { count: 0 } };
    }
};

// Cache for preferences to avoid async calls in hot paths
let preferencesCache = null;

async function loadPreferencesCache() {
    preferencesCache = await storage.getPreferences();
    return preferencesCache;
}

// Initialize preferences cache
loadPreferencesCache();

function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Improved scaling to prevent clipping
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function initializeGemini(profile = 'interview', language = 'en-US') {
    const apiKey = await storage.getApiKey();
    if (apiKey) {
        const prefs = await storage.getPreferences();
        const success = await ipcRenderer.invoke('initialize-gemini', apiKey, prefs.customPrompt || '', profile, language);
        if (success) {
            cheatingDaddy.setStatus('Live');
        } else {
            cheatingDaddy.setStatus('error');
        }
    }
}

// Listen for status updates
ipcRenderer.on('update-status', (event, status) => {
    console.log('Status update:', status);
    cheatingDaddy.setStatus(status);
});

async function startCapture(screenshotIntervalSeconds = 5, imageQuality = 'medium') {
    // Store the image quality for manual screenshots
    currentImageQuality = imageQuality;

    // Refresh preferences cache
    await loadPreferencesCache();
    const audioMode = preferencesCache.audioMode || 'speaker_only';

    try {
        if (isMacOS) {
            // On macOS, use SystemAudioDump for audio and getDisplayMedia for screen
            console.log('Starting macOS capture with SystemAudioDump...');

            // Start macOS audio capture
            const audioResult = await ipcRenderer.invoke('start-macos-audio');
            if (!audioResult.success) {
                throw new Error('Failed to start macOS audio capture: ' + audioResult.error);
            }

            // Get screen capture for screenshots
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false, // Don't use browser audio on macOS
            });

            console.log('macOS screen capture started - audio handled by SystemAudioDump');

            if (audioMode === 'mic_only' || audioMode === 'both') {
                let micStream = null;
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });
                    console.log('macOS microphone capture started');
                    setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on macOS:', micError);
                }
            }
        } else if (isLinux) {
            // Linux - use display media for screen capture and try to get system audio
            try {
                // First try to get system audio via getDisplayMedia (works on newer browsers)
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: false, // Don't cancel system audio
                        noiseSuppression: false,
                        autoGainControl: false,
                    },
                });

                console.log('Linux system audio capture via getDisplayMedia succeeded');

                // Setup audio processing for Linux system audio
                setupLinuxSystemAudioProcessing();
            } catch (systemAudioError) {
                console.warn('System audio via getDisplayMedia failed, trying screen-only capture:', systemAudioError);

                // Fallback to screen-only capture
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: false,
                });
            }

            // Additionally get microphone input for Linux based on audio mode
            if (audioMode === 'mic_only' || audioMode === 'both') {
                let micStream = null;
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });

                    console.log('Linux microphone capture started');

                    // Setup audio processing for microphone on Linux
                    setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on Linux:', micError);
                    // Continue without microphone if permission denied
                }
            }

            console.log('Linux capture started - system audio:', mediaStream.getAudioTracks().length > 0, 'microphone mode:', audioMode);
        } else {
            // Windows - use display media with loopback for system audio
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: {
                    sampleRate: SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            console.log('Windows capture started with loopback audio');

            // Setup audio processing for Windows loopback audio only
            setupWindowsLoopbackProcessing();

            if (audioMode === 'mic_only' || audioMode === 'both') {
                let micStream = null;
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });
                    console.log('Windows microphone capture started');
                    setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on Windows:', micError);
                }
            }
        }

        console.log('MediaStream obtained:', {
            hasVideo: mediaStream.getVideoTracks().length > 0,
            hasAudio: mediaStream.getAudioTracks().length > 0,
            videoTrack: mediaStream.getVideoTracks()[0]?.getSettings(),
        });

        // Manual mode only - screenshots captured on demand via shortcut
        console.log('Manual mode enabled - screenshots will be captured on demand only');
    } catch (err) {
        console.error('Error starting capture:', err);
        cheatingDaddy.setStatus('error');
    }
}

function setupLinuxMicProcessing(micStream) {
    // Setup microphone audio processing for Linux
    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-mic-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);

    // Store processor reference for cleanup
    micAudioProcessor = micProcessor;
}

function setupLinuxSystemAudioProcessing() {
    // Setup system audio processing for Linux (from getDisplayMedia)
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(mediaStream);
    audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    audioProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
}

function setupWindowsLoopbackProcessing() {
    // Setup audio processing for Windows loopback audio only
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(mediaStream);
    audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    audioProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
}

async function captureScreenshot(imageQuality = 'medium', isManual = false) {
    console.log(`Capturing ${isManual ? 'manual' : 'automated'} screenshot...`);
    if (!mediaStream) return;

    // Lazy init of video element
    if (!hiddenVideo) {
        hiddenVideo = document.createElement('video');
        hiddenVideo.srcObject = mediaStream;
        hiddenVideo.muted = true;
        hiddenVideo.playsInline = true;
        await hiddenVideo.play();

        await new Promise(resolve => {
            if (hiddenVideo.readyState >= 2) return resolve();
            hiddenVideo.onloadedmetadata = () => resolve();
        });

        // Lazy init of canvas based on video dimensions
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = hiddenVideo.videoWidth;
        offscreenCanvas.height = hiddenVideo.videoHeight;
        offscreenContext = offscreenCanvas.getContext('2d');
    }

    // Check if video is ready
    if (hiddenVideo.readyState < 2) {
        console.warn('Video not ready yet, skipping screenshot');
        return;
    }

    offscreenContext.drawImage(hiddenVideo, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Check if image was drawn properly by sampling a pixel
    const imageData = offscreenContext.getImageData(0, 0, 1, 1);
    const isBlank = imageData.data.every((value, index) => {
        // Check if all pixels are black (0,0,0) or transparent
        return index === 3 ? true : value === 0;
    });

    if (isBlank) {
        console.warn('Screenshot appears to be blank/black');
    }

    let qualityValue;
    switch (imageQuality) {
        case 'high':
            qualityValue = 0.9;
            break;
        case 'medium':
            qualityValue = 0.7;
            break;
        case 'low':
            qualityValue = 0.5;
            break;
        default:
            qualityValue = 0.7; // Default to medium
    }

    offscreenCanvas.toBlob(
        async blob => {
            if (!blob) {
                console.error('Failed to create blob from canvas');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64data = reader.result.split(',')[1];

                // Validate base64 data
                if (!base64data || base64data.length < 100) {
                    console.error('Invalid base64 data generated');
                    return;
                }

                // Send image to Azure OpenAI Vision for automatic analysis
                const result = await ipcRenderer.invoke('azure:analyze-screenshot', {
                    base64Image: base64data,
                    prompt: 'Analyze this screenshot and provide context about what is happening on the screen.'
                });

                if (result.success) {
                    console.log(`✅ Azure Vision auto-analysis completed (${offscreenCanvas.width}x${offscreenCanvas.height})`);
                } else {
                    console.error('❌ Failed automatic screenshot analysis:', result.error);
                }
            };
            reader.readAsDataURL(blob);
        },
        'image/jpeg',
        qualityValue
    );
}

const MANUAL_SCREENSHOT_PROMPT = `Help me on this page, give me the answer no bs, complete answer.
So if its a code question, give me the approach in few bullet points, then the entire code. Also if theres anything else i need to know, tell me.
If its a question about the website, give me the answer no bs, complete answer.
If its a mcq question, give me the answer no bs, complete answer.`;

async function captureManualScreenshot(imageQuality = null) {
    console.log('Manual screenshot triggered');
    const quality = imageQuality || currentImageQuality;

    if (!mediaStream) {
        console.error('No media stream available');
        return;
    }

    // Lazy init of video element
    if (!hiddenVideo) {
        hiddenVideo = document.createElement('video');
        hiddenVideo.srcObject = mediaStream;
        hiddenVideo.muted = true;
        hiddenVideo.playsInline = true;
        await hiddenVideo.play();

        await new Promise(resolve => {
            if (hiddenVideo.readyState >= 2) return resolve();
            hiddenVideo.onloadedmetadata = () => resolve();
        });

        // Lazy init of canvas based on video dimensions
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = hiddenVideo.videoWidth;
        offscreenCanvas.height = hiddenVideo.videoHeight;
        offscreenContext = offscreenCanvas.getContext('2d');
    }

    // Check if video is ready
    if (hiddenVideo.readyState < 2) {
        console.warn('Video not ready yet, skipping screenshot');
        return;
    }

    offscreenContext.drawImage(hiddenVideo, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

    let qualityValue;
    switch (quality) {
        case 'high':
            qualityValue = 0.9;
            break;
        case 'medium':
            qualityValue = 0.7;
            break;
        case 'low':
            qualityValue = 0.5;
            break;
        default:
            qualityValue = 0.7;
    }

    offscreenCanvas.toBlob(
        async blob => {
            if (!blob) {
                console.error('Failed to create blob from canvas');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64data = reader.result.split(',')[1];

                if (!base64data || base64data.length < 100) {
                    console.error('Invalid base64 data generated');
                    return;
                }

                // Send image to Azure OpenAI Vision
                console.log('📸 Sending screenshot to Azure Vision for analysis...');
                
                const result = await ipcRenderer.invoke('azure:analyze-screenshot', {
                    base64Image: base64data,
                    prompt: MANUAL_SCREENSHOT_PROMPT || 'Analyze this screenshot and provide helpful insights.'
                });

                if (result.success) {
                    console.log('✅ Azure Vision analysis completed');
                    // Add the analysis as a new response
                    cheatingDaddy.addNewResponse(result.analysis);
                } else {
                    console.error('❌ Failed to analyze screenshot:', result.error);
                    cheatingDaddy.addNewResponse(`Error analyzing screenshot: ${result.error}`);
                }
            };
            reader.readAsDataURL(blob);
        },
        'image/jpeg',
        qualityValue
    );
}

// Expose functions to global scope for external access
window.captureManualScreenshot = captureManualScreenshot;

function stopCapture() {
    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
    }

    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }

    // Clean up microphone audio processor (Linux only)
    if (micAudioProcessor) {
        micAudioProcessor.disconnect();
        micAudioProcessor = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    // Stop macOS audio capture if running
    if (isMacOS) {
        ipcRenderer.invoke('stop-macos-audio').catch(err => {
            console.error('Error stopping macOS audio:', err);
        });
    }

    // Clean up hidden elements
    if (hiddenVideo) {
        hiddenVideo.pause();
        hiddenVideo.srcObject = null;
        hiddenVideo = null;
    }
    offscreenCanvas = null;
    offscreenContext = null;
}

// Send text message to active AI provider (Azure or Gemini)
async function sendTextMessage(text) {
    if (!text || text.trim().length === 0) {
        console.warn('Cannot send empty text message');
        return { success: false, error: 'Empty message' };
    }

    try {
        // Check if Azure is active
        if (isAzureActive) {
            console.log('Sending text message to Azure OpenAI:', text);
            
            // Reset the first chunk flag for new message
            isFirstAzureChunk = true;
            
            const result = await ipcRenderer.invoke('azure:send-message', { 
                message: text,
                context: null 
            });
            if (result.success) {
                console.log('Azure text message sent successfully');
            } else {
                console.error('Failed to send Azure text message:', result.error);
            }
            return result;
        } else {
            // Fall back to Gemini
            const result = await ipcRenderer.invoke('send-text-message', text);
            if (result.success) {
                console.log('Text message sent successfully to Gemini');
            } else {
                console.error('Failed to send text message to Gemini:', result.error);
            }
            return result;
        }
    } catch (error) {
        console.error('Error sending text message:', error);
        return { success: false, error: error.message };
    }
}

// Listen for conversation data from main process and save to storage
ipcRenderer.on('save-conversation-turn', async (event, data) => {
    try {
        await storage.saveSession(data.sessionId, { conversationHistory: data.fullHistory });
        console.log('Conversation session saved:', data.sessionId);
    } catch (error) {
        console.error('Error saving conversation session:', error);
    }
});

// Listen for session context (profile info) when session starts
ipcRenderer.on('save-session-context', async (event, data) => {
    try {
        await storage.saveSession(data.sessionId, {
            profile: data.profile,
            customPrompt: data.customPrompt
        });
        console.log('Session context saved:', data.sessionId, 'profile:', data.profile);
    } catch (error) {
        console.error('Error saving session context:', error);
    }
});

// Listen for screen analysis responses (from ctrl+enter)
ipcRenderer.on('save-screen-analysis', async (event, data) => {
    try {
        await storage.saveSession(data.sessionId, {
            screenAnalysisHistory: data.fullHistory,
            profile: data.profile,
            customPrompt: data.customPrompt
        });
        console.log('Screen analysis saved:', data.sessionId);
    } catch (error) {
        console.error('Error saving screen analysis:', error);
    }
});

// Listen for emergency erase command from main process
ipcRenderer.on('clear-sensitive-data', async () => {
    console.log('Clearing all data...');
    await storage.clearAll();
});

// ============ AZURE IPC LISTENERS ============
ipcRenderer.on('azure:message-chunk', (event, { chunk }) => {
    console.log('Azure chunk received:', chunk);
    
    // If this is the first chunk of a new response, create a new response entry
    if (isFirstAzureChunk) {
        cheatingDaddy.addNewResponse(chunk);
        isFirstAzureChunk = false;
    } else {
        // Otherwise, append to the current response
        const currentResponse = cheatingDaddy.e()?.responses?.[cheatingDaddy.e()?.currentResponseIndex] || '';
        cheatingDaddy.updateCurrentResponse(currentResponse + chunk);
    }
});

ipcRenderer.on('azure:message-complete', (event, { response }) => {
    console.log('Azure response complete');
    cheatingDaddy.setStatus('Ready - Listening for questions...');
    // Reset for next message
    isFirstAzureChunk = true;
});

ipcRenderer.on('azure:message-error', (event, { error }) => {
    console.error('Azure error:', error);
    cheatingDaddy.addNewResponse(`Error: ${error}`);
    cheatingDaddy.setStatus('Error - Please try again');
});

ipcRenderer.on('azure:speech-result', (event, { text }) => {
    console.log('Speech recognized:', text);
    cheatingDaddy.setStatus(`Heard: "${text}" - Processing...`);
    cheatingDaddy.addNewResponse(''); // Prepare for response
});

ipcRenderer.on('azure:speech-error', (event, { error }) => {
    console.error('Speech error:', error);
    cheatingDaddy.setStatus('Speech recognition error');
});

ipcRenderer.on('session-started', (event, { provider, model }) => {
    console.log(`Session started with ${provider} (${model})`);
    cheatingDaddy.setStatus(`Connected to ${provider} - ${model}`);
});

ipcRenderer.on('session-stopped', (event) => {
    console.log('Session stopped');
    cheatingDaddy.setStatus('Session ended');
});

// Handle shortcuts based on current view
function handleShortcut(shortcutKey) {
    const currentView = cheatingDaddy.getCurrentView();

    if (shortcutKey === 'ctrl+enter' || shortcutKey === 'cmd+enter') {
        if (currentView === 'main') {
            cheatingDaddy.element().handleStart();
        } else {
            captureManualScreenshot();
        }
    }
}

// Create reference to the main app element
const pulseApp = document.querySelector('pulse-app');

// ============ THEME SYSTEM ============
const theme = {
    themes: {
        dark: {
            background: '#1e1e1e',
            text: '#e0e0e0', textSecondary: '#a0a0a0', textMuted: '#6b6b6b',
            border: '#333333', accent: '#ffffff',
            btnPrimaryBg: '#ffffff', btnPrimaryText: '#000000', btnPrimaryHover: '#e0e0e0',
            tooltipBg: '#1a1a1a', tooltipText: '#ffffff',
            keyBg: 'rgba(255,255,255,0.1)'
        },
        light: {
            background: '#ffffff',
            text: '#1a1a1a', textSecondary: '#555555', textMuted: '#888888',
            border: '#e0e0e0', accent: '#000000',
            btnPrimaryBg: '#1a1a1a', btnPrimaryText: '#ffffff', btnPrimaryHover: '#333333',
            tooltipBg: '#1a1a1a', tooltipText: '#ffffff',
            keyBg: 'rgba(0,0,0,0.1)'
        },
        midnight: {
            background: '#0d1117',
            text: '#c9d1d9', textSecondary: '#8b949e', textMuted: '#6e7681',
            border: '#30363d', accent: '#58a6ff',
            btnPrimaryBg: '#58a6ff', btnPrimaryText: '#0d1117', btnPrimaryHover: '#79b8ff',
            tooltipBg: '#161b22', tooltipText: '#c9d1d9',
            keyBg: 'rgba(88,166,255,0.15)'
        },
        sepia: {
            background: '#f4ecd8',
            text: '#5c4b37', textSecondary: '#7a6a56', textMuted: '#998875',
            border: '#d4c8b0', accent: '#8b4513',
            btnPrimaryBg: '#5c4b37', btnPrimaryText: '#f4ecd8', btnPrimaryHover: '#7a6a56',
            tooltipBg: '#5c4b37', tooltipText: '#f4ecd8',
            keyBg: 'rgba(92,75,55,0.15)'
        },
        nord: {
            background: '#2e3440',
            text: '#eceff4', textSecondary: '#d8dee9', textMuted: '#4c566a',
            border: '#3b4252', accent: '#88c0d0',
            btnPrimaryBg: '#88c0d0', btnPrimaryText: '#2e3440', btnPrimaryHover: '#8fbcbb',
            tooltipBg: '#3b4252', tooltipText: '#eceff4',
            keyBg: 'rgba(136,192,208,0.15)'
        },
        dracula: {
            background: '#282a36',
            text: '#f8f8f2', textSecondary: '#bd93f9', textMuted: '#6272a4',
            border: '#44475a', accent: '#ff79c6',
            btnPrimaryBg: '#ff79c6', btnPrimaryText: '#282a36', btnPrimaryHover: '#ff92d0',
            tooltipBg: '#44475a', tooltipText: '#f8f8f2',
            keyBg: 'rgba(255,121,198,0.15)'
        },
        abyss: {
            background: '#0a0a0a',
            text: '#d4d4d4', textSecondary: '#808080', textMuted: '#505050',
            border: '#1a1a1a', accent: '#ffffff',
            btnPrimaryBg: '#ffffff', btnPrimaryText: '#0a0a0a', btnPrimaryHover: '#d4d4d4',
            tooltipBg: '#141414', tooltipText: '#d4d4d4',
            keyBg: 'rgba(255,255,255,0.08)'
        }
    },

    current: 'dark',

    get(name) {
        return this.themes[name] || this.themes.dark;
    },

    getAll() {
        const names = {
            dark: 'Dark',
            light: 'Light',
            midnight: 'Midnight Blue',
            sepia: 'Sepia',
            nord: 'Nord',
            dracula: 'Dracula',
            abyss: 'Abyss'
        };
        return Object.keys(this.themes).map(key => ({
            value: key,
            name: names[key] || key,
            colors: this.themes[key]
        }));
    },

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 30, g: 30, b: 30 };
    },

    lightenColor(rgb, amount) {
        return {
            r: Math.min(255, rgb.r + amount),
            g: Math.min(255, rgb.g + amount),
            b: Math.min(255, rgb.b + amount)
        };
    },

    darkenColor(rgb, amount) {
        return {
            r: Math.max(0, rgb.r - amount),
            g: Math.max(0, rgb.g - amount),
            b: Math.max(0, rgb.b - amount)
        };
    },

    applyBackgrounds(backgroundColor, alpha = 0.8) {
        const root = document.documentElement;
        const baseRgb = this.hexToRgb(backgroundColor);

        // For light themes, darken; for dark themes, lighten
        const isLight = (baseRgb.r + baseRgb.g + baseRgb.b) / 3 > 128;
        const adjust = isLight ? this.darkenColor.bind(this) : this.lightenColor.bind(this);

        const secondary = adjust(baseRgb, 7);
        const tertiary = adjust(baseRgb, 15);
        const hover = adjust(baseRgb, 20);

        root.style.setProperty('--header-background', `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${alpha})`);
        root.style.setProperty('--main-content-background', `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${alpha})`);
        root.style.setProperty('--bg-primary', `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${alpha})`);
        root.style.setProperty('--bg-secondary', `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, ${alpha})`);
        root.style.setProperty('--bg-tertiary', `rgba(${tertiary.r}, ${tertiary.g}, ${tertiary.b}, ${alpha})`);
        root.style.setProperty('--bg-hover', `rgba(${hover.r}, ${hover.g}, ${hover.b}, ${alpha})`);
        root.style.setProperty('--input-background', `rgba(${tertiary.r}, ${tertiary.g}, ${tertiary.b}, ${alpha})`);
        root.style.setProperty('--input-focus-background', `rgba(${tertiary.r}, ${tertiary.g}, ${tertiary.b}, ${alpha})`);
        root.style.setProperty('--hover-background', `rgba(${hover.r}, ${hover.g}, ${hover.b}, ${alpha})`);
        root.style.setProperty('--scrollbar-background', `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${alpha})`);
    },

    apply(themeName, alpha = 0.8) {
        const colors = this.get(themeName);
        this.current = themeName;
        const root = document.documentElement;

        // Text colors
        root.style.setProperty('--text-color', colors.text);
        root.style.setProperty('--text-secondary', colors.textSecondary);
        root.style.setProperty('--text-muted', colors.textMuted);
        // Border colors
        root.style.setProperty('--border-color', colors.border);
        root.style.setProperty('--border-default', colors.accent);
        // Misc
        root.style.setProperty('--placeholder-color', colors.textMuted);
        root.style.setProperty('--scrollbar-thumb', colors.border);
        root.style.setProperty('--scrollbar-thumb-hover', colors.textMuted);
        root.style.setProperty('--key-background', colors.keyBg);
        // Primary button
        root.style.setProperty('--btn-primary-bg', colors.btnPrimaryBg);
        root.style.setProperty('--btn-primary-text', colors.btnPrimaryText);
        root.style.setProperty('--btn-primary-hover', colors.btnPrimaryHover);
        // Start button (same as primary)
        root.style.setProperty('--start-button-background', colors.btnPrimaryBg);
        root.style.setProperty('--start-button-color', colors.btnPrimaryText);
        root.style.setProperty('--start-button-hover-background', colors.btnPrimaryHover);
        // Tooltip
        root.style.setProperty('--tooltip-bg', colors.tooltipBg);
        root.style.setProperty('--tooltip-text', colors.tooltipText);
        // Error color (stays constant)
        root.style.setProperty('--error-color', '#f14c4c');
        root.style.setProperty('--success-color', '#4caf50');

        // Also apply background colors from theme
        this.applyBackgrounds(colors.background, alpha);
    },

    async load() {
        try {
            const prefs = await storage.getPreferences();
            const themeName = prefs.theme || 'dark';
            const alpha = prefs.backgroundTransparency ?? 0.8;
            this.apply(themeName, alpha);
            return themeName;
        } catch (err) {
            this.apply('dark');
            return 'dark';
        }
    },

    async save(themeName) {
        await storage.updatePreference('theme', themeName);
        this.apply(themeName);
    }
};

// Consolidated pulse object - all functions in one place
const pulse = {
    // App version
    getVersion: async () => ipcRenderer.invoke('get-app-version'),

    // Element access
    element: () => pulseApp,
    e: () => pulseApp,

    // App state functions - access properties directly from the app element
    getCurrentView: () => pulseApp.currentView,
    getLayoutMode: () => pulseApp.layoutMode,

    // Status and response functions
    setStatus: text => pulseApp.setStatus(text),
    addNewResponse: response => pulseApp.addNewResponse(response),
    updateCurrentResponse: response => pulseApp.updateCurrentResponse(response),

    // Core functionality
    initializeGemini,
    startCapture,
    stopCapture,
    sendTextMessage,
    handleShortcut,

    // Azure Speech API
    startWebSpeech: startAzureSpeechRecognition,
    stopWebSpeech: stopAzureSpeechRecognition,

    // Azure functionality
    isAzureConfigured: async () => {
        const result = await ipcRenderer.invoke('azure:is-configured');
        return result.configured;
    },
    
    startAzureSession: async (profile, language) => {
        return ipcRenderer.invoke('azure:start-session', {
            profile: profile || 'interview',
            customPrompt: '',
            language: language || 'en-US'
        });
    },
    
    stopAzureSession: async () => {
        return ipcRenderer.invoke('azure:stop-session');
    },
    
    sendAzureMessage: async (message) => {
        return ipcRenderer.invoke('azure:send-message', { message });
    },
    
    analyzeScreenshotAzure: async (base64Image, prompt) => {
        return ipcRenderer.invoke('azure:analyze-screenshot', { base64Image, prompt });
    },

    // Storage API
    storage,

    // Theme API
    theme,

    // Refresh preferences cache (call after updating preferences)
    refreshPreferencesCache: loadPreferencesCache,

    // Platform detection
    isLinux: isLinux,
    isMacOS: isMacOS,
};

// Make it globally available
window.pulse = pulse;
// Keep cheatingDaddy as alias for backward compatibility
window.cheatingDaddy = pulse;

// Load theme after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => theme.load());
} else {
    theme.load();
}
