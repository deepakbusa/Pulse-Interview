if (require('electron-squirrel-startup')) {
    process.exit(0);
}

// Load environment variables
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Determine the correct path for .env file
// In production (packaged), extraResources are in process.resourcesPath
// In development, they're in the project root
const envPath = app.isPackaged 
    ? path.join(process.resourcesPath, '.env')
    : path.join(__dirname, '..', '.env');

console.log('Loading .env from:', envPath);
console.log('.env file exists:', fs.existsSync(envPath));

require('dotenv').config({ path: envPath });

// Verify critical environment variables are loaded
const requiredVars = [
    'REACT_APP_API_KEY',
    'REACT_APP_API_URL',
    'REACT_APP_DEPLOYMENT_ID',
    'REACT_APP_SPEECH_KEY',
    'REACT_APP_SPEECH_REGION',
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_DATABASE_URL'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
} else {
    console.log('✅ All required environment variables loaded');
}

const { BrowserWindow, shell, ipcMain } = require('electron');
const { createWindow, updateGlobalShortcuts } = require('./utils/window');
const { setupGeminiIpcHandlers, stopMacOSAudioCapture, sendToRenderer } = require('./utils/gemini');
const { setupAzureIpcHandlers, stopAzureSpeechRecognition } = require('./utils/azureHandlers');
const storage = require('./storage');
const { initializeFirebase, verifyPulseCredentials, isFirebaseConfigured } = require('./utils/firebase');

const geminiSessionRef = { current: null };
let mainWindow = null;

function createMainWindow() {
    mainWindow = createWindow(sendToRenderer, geminiSessionRef);
    return mainWindow;
}

app.whenReady().then(async () => {
    // Initialize storage (checks version, resets if needed)
    storage.initializeStorage();

    // Initialize Firebase
    if (isFirebaseConfigured()) {
        initializeFirebase();
    } else {
        console.warn('Firebase not configured - add credentials to .env file');
    }

    createMainWindow();
    setupGeminiIpcHandlers(geminiSessionRef);
    setupAzureIpcHandlers(geminiSessionRef);
    setupStorageIpcHandlers();
    setupGeneralIpcHandlers();
});

app.on('window-all-closed', () => {
    stopMacOSAudioCapture();
    stopAzureSpeechRecognition();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopMacOSAudioCapture();
    stopAzureSpeechRecognition();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

function setupStorageIpcHandlers() {
    // ============ CONFIG ============
    ipcMain.handle('storage:get-config', async () => {
        try {
            return { success: true, data: storage.getConfig() };
        } catch (error) {
            console.error('Error getting config:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-config', async (event, config) => {
        try {
            storage.setConfig(config);
            return { success: true };
        } catch (error) {
            console.error('Error setting config:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:update-config', async (event, key, value) => {
        try {
            storage.updateConfig(key, value);
            return { success: true };
        } catch (error) {
            console.error('Error updating config:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ CREDENTIALS ============
    ipcMain.handle('storage:get-credentials', async () => {
        try {
            return { success: true, data: storage.getCredentials() };
        } catch (error) {
            console.error('Error getting credentials:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-credentials', async (event, credentials) => {
        try {
            storage.setCredentials(credentials);
            return { success: true };
        } catch (error) {
            console.error('Error setting credentials:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:get-api-key', async () => {
        try {
            return { success: true, data: storage.getApiKey() };
        } catch (error) {
            console.error('Error getting API key:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-api-key', async (event, apiKey) => {
        try {
            storage.setApiKey(apiKey);
            return { success: true };
        } catch (error) {
            console.error('Error setting API key:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ PULSE CREDENTIALS (Login) ============
    ipcMain.handle('storage:get-pulse-credentials', async () => {
        try {
            return { success: true, data: storage.getPulseCredentials() };
        } catch (error) {
            console.error('Error getting pulse credentials:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-pulse-credentials', async (event, userId, password) => {
        try {
            storage.setPulseCredentials(userId, password);
            return { success: true };
        } catch (error) {
            console.error('Error setting pulse credentials:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:verify-pulse-credentials', async (event, userId, password) => {
        try {
            // Try Firebase first if configured
            if (isFirebaseConfigured()) {
                const isValid = await verifyPulseCredentials(userId, password);
                return { success: true, data: isValid };
            }
            // Fallback to local storage if Firebase not configured
            const isValid = storage.verifyPulseCredentials(userId, password);
            return { success: true, data: isValid };
        } catch (error) {
            console.error('Error verifying pulse credentials:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:has-pulse-credentials', async () => {
        try {
            // If Firebase is configured, always return false (no local setup needed)
            if (isFirebaseConfigured()) {
                return { success: true, data: false };
            }
            // Otherwise check local storage
            const hasCredentials = storage.hasPulseCredentials();
            return { success: true, data: hasCredentials };
        } catch (error) {
            console.error('Error checking pulse credentials:', error);
            return { success: false, error: error.message };
        }
    });

    // New handler to check if Firebase is configured
    ipcMain.handle('storage:is-firebase-configured', async () => {
        try {
            return { success: true, data: isFirebaseConfigured() };
        } catch (error) {
            console.error('Error checking Firebase configuration:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ PREFERENCES ============
    ipcMain.handle('storage:get-preferences', async () => {
        try {
            return { success: true, data: storage.getPreferences() };
        } catch (error) {
            console.error('Error getting preferences:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-preferences', async (event, preferences) => {
        try {
            storage.setPreferences(preferences);
            return { success: true };
        } catch (error) {
            console.error('Error setting preferences:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:update-preference', async (event, key, value) => {
        try {
            storage.updatePreference(key, value);
            return { success: true };
        } catch (error) {
            console.error('Error updating preference:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ KEYBINDS ============
    ipcMain.handle('storage:get-keybinds', async () => {
        try {
            return { success: true, data: storage.getKeybinds() };
        } catch (error) {
            console.error('Error getting keybinds:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-keybinds', async (event, keybinds) => {
        try {
            storage.setKeybinds(keybinds);
            return { success: true };
        } catch (error) {
            console.error('Error setting keybinds:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ HISTORY ============
    ipcMain.handle('storage:get-all-sessions', async () => {
        try {
            return { success: true, data: storage.getAllSessions() };
        } catch (error) {
            console.error('Error getting sessions:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:get-session', async (event, sessionId) => {
        try {
            return { success: true, data: storage.getSession(sessionId) };
        } catch (error) {
            console.error('Error getting session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:save-session', async (event, sessionId, data) => {
        try {
            storage.saveSession(sessionId, data);
            return { success: true };
        } catch (error) {
            console.error('Error saving session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:delete-session', async (event, sessionId) => {
        try {
            storage.deleteSession(sessionId);
            return { success: true };
        } catch (error) {
            console.error('Error deleting session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:delete-all-sessions', async () => {
        try {
            storage.deleteAllSessions();
            return { success: true };
        } catch (error) {
            console.error('Error deleting all sessions:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ LIMITS ============
    ipcMain.handle('storage:get-today-limits', async () => {
        try {
            return { success: true, data: storage.getTodayLimits() };
        } catch (error) {
            console.error('Error getting today limits:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ CLEAR ALL ============
    ipcMain.handle('storage:clear-all', async () => {
        try {
            storage.clearAllData();
            return { success: true };
        } catch (error) {
            console.error('Error clearing all data:', error);
            return { success: false, error: error.message };
        }
    });
}

function setupGeneralIpcHandlers() {
    ipcMain.handle('get-app-version', async () => {
        return app.getVersion();
    });

    ipcMain.handle('quit-application', async event => {
        try {
            stopMacOSAudioCapture();
            app.quit();
            return { success: true };
        } catch (error) {
            console.error('Error quitting application:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('open-external', async (event, url) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (error) {
            console.error('Error opening external URL:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        if (mainWindow) {
            // Also save to storage
            storage.setKeybinds(newKeybinds);
            updateGlobalShortcuts(newKeybinds, mainWindow, sendToRenderer, geminiSessionRef);
        }
    });

    // Debug logging from renderer
    ipcMain.on('log-message', (event, msg) => {
        console.log(msg);
    });
}
