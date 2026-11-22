if (require('electron-squirrel-startup')) {
    process.exit(0);
}

// All environment variables are now fetched from the backend
// No local .env file needed - everything comes from https://pulse-backend-1xa3.onrender.com
const path = require('path');
const { app } = require('electron');

console.log('Backend URL configured - all secrets will be fetched from backend');

const { BrowserWindow, shell, ipcMain, globalShortcut } = require('electron');
const { createWindow, updateGlobalShortcuts } = require('./utils/window');
const { setupAzureIpcHandlers, stopAzureSpeechRecognition } = require('./utils/azureHandlers');
const storage = require('./storage');
const { connectToMongoDB, closeMongoDB } = require('./utils/mongodb');
const azureUtils = require('./utils/azure');
const { pingBackend } = require('./config/backend');
const sessionMonitor = require('./utils/sessionMonitor');

let mainWindow = null;

// Ping backend every 10 minutes to prevent cold starts
setInterval(() => {
    pingBackend().then(success => {
        if (success) console.log('Backend keepalive ping successful');
    });
}, 10 * 60 * 1000); // 10 minutes

function sendToRenderer(channel, data) {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send(channel, data);
    }
}

/**
 * Handle force logout when admin ends session
 */
async function handleForceLogout(reason) {
    console.log('🔴 Force logout triggered:', reason);
    
    try {
        // Stop session monitoring
        sessionMonitor.stopSessionMonitoring();
        
        // Logout current session from storage
        console.log('📤 Logging out session from storage...');
        await storage.logoutCurrentSession();
        console.log('✅ Session cleared from storage');
        
        // Reload window immediately - will show login screen since session is cleared
        console.log('🔄 Reloading window to show login screen...');
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.reload();
            console.log('✅ Window reloaded');
        }
    } catch (error) {
        console.error('❌ Error during force logout:', error);
        // Still reload even if logout fails
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.reload();
        }
    }
}

function createMainWindow() {
    mainWindow = createWindow(sendToRenderer);
    return mainWindow;
}

app.whenReady().then(async () => {
    // Initialize storage (checks version, resets if needed)
    storage.initializeStorage();

    // Ping backend immediately to wake it up
    console.log('Waking up backend...');
    await pingBackend();

    // Fetch credentials from backend
    try {
        await azureUtils.fetchSpeechCredentials();
        console.log('Speech credentials fetched from backend');
    } catch (error) {
        console.error('Failed to fetch speech credentials:', error);
    }

    // Initialize MongoDB connection
    try {
        await connectToMongoDB();
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        // Continue anyway - app can still work with local storage
    }

    createMainWindow();
    setupAzureIpcHandlers();
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
    stopAzureSpeechRecognition();
    
    // Unregister all global shortcuts to prevent conflicts
    globalShortcut.unregisterAll();
    console.log('All global shortcuts unregistered');
    
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
            
            // If login successful, start session monitoring
            if (isValid && isValid.success) {
                const session = storage.getCurrentSession();
                if (session && session.sessionId) {
                    console.log('🔍 Starting session monitoring for:', session.sessionId);
                    sessionMonitor.startSessionMonitoring(session.sessionId, handleForceLogout);
                }
            }
            
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

    // Logout handler - stops session monitoring
    ipcMain.handle('storage:logout', async () => {
        try {
            // Stop session monitoring first
            console.log('🚫Stopping session monitoring...');
            sessionMonitor.stopSessionMonitoring();
            
            // Then logout
            await storage.logoutCurrentSession();
            return { success: true };
        } catch (error) {
            console.error('Error logging out:', error);
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
    // Get speech credentials from backend
    ipcMain.handle('get-speech-credentials', async () => {
        try {
            console.log('IPC: get-speech-credentials called');
            
            // Check if credentials are already loaded
            let credentials = azureUtils.getSpeechCredentials();
            
            if (!credentials.key || !credentials.region) {
                console.log('Credentials not loaded, fetching from backend...');
                credentials = await azureUtils.fetchSpeechCredentials();
                console.log('Credentials fetched:', {
                    key: credentials.key ? 'Present' : 'Missing',
                    region: credentials.region || 'Missing'
                });
            } else {
                console.log('Using cached credentials');
            }
            
            return credentials;
        } catch (error) {
            console.error('Failed to get speech credentials:', error);
            throw error;
        }
    });

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
            updateGlobalShortcuts(newKeybinds, mainWindow, sendToRenderer);
        }
    });

    // Debug logging from renderer
    ipcMain.on('log-message', (event, msg) => {
        console.log(msg);
    });
}
