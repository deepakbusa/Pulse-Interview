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
    'MONGODB_URI'
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
const { connectToMongoDB, closeMongoDB } = require('./utils/mongodb');

const geminiSessionRef = { current: null };
let mainWindow = null;

function createMainWindow() {
    mainWindow = createWindow(sendToRenderer, geminiSessionRef);
    return mainWindow;
}

app.whenReady().then(async () => {
    // Initialize storage (checks version, resets if needed)
    storage.initializeStorage();

    // Initialize MongoDB connection
    try {
        await connectToMongoDB();
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        // Continue anyway - app can still work with local storage
    }

    createMainWindow();
    setupGeminiIpcHandlers(geminiSessionRef);
    setupAzureIpcHandlers(geminiSessionRef);
    setupStorageIpcHandlers();
    setupGeneralIpcHandlers();
    
    // Handle renderer process crashes - logout session
    mainWindow.webContents.on('render-process-gone', async (event, details) => {
        console.error('❌ Renderer process crashed:', details.reason);
        try {
            await storage.logoutCurrentSession();
            console.log('✅ Session logged out after crash');
        } catch (error) {
            console.error('Error logging out session after crash:', error);
        }
    });
    
    // Handle unresponsive renderer - logout and reload
    mainWindow.webContents.on('unresponsive', async () => {
        console.warn('⚠️ Renderer became unresponsive');
        try {
            await storage.logoutCurrentSession();
            console.log('✅ Session logged out due to unresponsiveness');
        } catch (error) {
            console.error('Error logging out session:', error);
        }
    });
});

app.on('window-all-closed', async () => {
    stopMacOSAudioCapture();
    stopAzureSpeechRecognition();
    
    // Logout current session before closing MongoDB
    try {
        await storage.logoutCurrentSession();
        console.log('✅ Session logged out');
    } catch (error) {
        console.error('Error logging out session:', error);
    }
    
    // Close MongoDB connection after session cleanup
    try {
        await closeMongoDB();
    } catch (error) {
        console.error('Error closing MongoDB:', error);
    }
    
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async () => {
    stopMacOSAudioCapture();
    stopAzureSpeechRecognition();
    
    // Logout current session
    try {
        await storage.logoutCurrentSession();
    } catch (error) {
        console.error('Error logging out session:', error);
    }
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
            // Use MongoDB for authentication
            const isValid = await storage.verifyPulseCredentials(userId, password);
            return { success: true, data: isValid };
        } catch (error) {
            console.error('Error verifying pulse credentials:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:has-pulse-credentials', async () => {
        try {
            // Check if user is logged in
            const hasCredentials = storage.hasPulseCredentials();
            return { success: true, data: hasCredentials };
        } catch (error) {
            console.error('Error checking pulse credentials:', error);
            return { success: false, error: error.message };
        }
    });

    // New handler to get all users (for debugging/testing)
    ipcMain.handle('storage:get-all-users', async () => {
        try {
            const users = await storage.getAllUsers();
            return { success: true, data: users };
        } catch (error) {
            console.error('Error getting all users:', error);
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

    ipcMain.handle('update-undetectability-setting', async (event, enabled) => {
        try {
            console.log(`Updating undetectability setting: ${enabled}`);
            // When enabled (true), window is undetectable (hidden from screen share)
            // When disabled (false), window is visible in screen shares
            if (mainWindow) {
                // setContentProtection makes window invisible in screen captures when true
                mainWindow.setContentProtection(enabled);
                console.log(`✅ Content protection ${enabled ? 'enabled' : 'disabled'}`);
            }
            return { success: true };
        } catch (error) {
            console.error('Error updating undetectability:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('reload-application', async () => {
        try {
            console.log('Application reload requested, logging out session...');
            await storage.logoutCurrentSession();
            console.log('✅ Session logged out, reloading...');
            
            if (mainWindow) {
                mainWindow.reload();
            }
            return { success: true };
        } catch (error) {
            console.error('Error reloading application:', error);
            return { success: false, error: error.message };
        }
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
