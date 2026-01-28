import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { AppHeader } from './AppHeader.js';
import { MainView } from '../views/MainView.js';
import { CustomizeView } from '../views/CustomizeView.js';
import { HelpView } from '../views/HelpView.js';
import { HistoryView } from '../views/HistoryView.js';
import { AssistantView } from '../views/AssistantView.js';
import { LoginView } from '../views/LoginView.js';

export class PulseApp extends LitElement {
    static styles = css`
        * {
            box-sizing: border-box;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            margin: 0px;
            padding: 0px;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            width: 100%;
            height: 100vh;
            background-color: var(--background-transparent);
            color: var(--text-color);
        }

        .window-container {
            height: 100vh;
            overflow: hidden;
            background: var(--bg-primary);
        }

        .container {
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        .main-content {
            flex: 1;
            padding: var(--main-content-padding);
            overflow-y: auto;
            background: var(--main-content-background);
        }

        .main-content.with-border {
            border-top: none;
        }

        .main-content.assistant-view {
            padding: 12px;
        }

        .main-content.settings-view,
        .main-content.help-view,
        .main-content.history-view {
            padding: 0;
        }

        .view-container {
            opacity: 1;
            height: 100%;
        }

        .view-container.entering {
            opacity: 0;
        }

        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        ::-webkit-scrollbar-track {
            background: transparent;
        }

        ::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        /* Interview Setup Modal Styles */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .interview-setup-modal {
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            width: 90%;
            max-width: 480px;
            max-height: 90vh;
            overflow-y: auto;
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .interview-setup-modal h2 {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 20px;
        }

        .form-group {
            margin-bottom: 18px;
        }

        .form-group label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: var(--text-color);
            margin-bottom: 8px;
        }

        .form-group .required {
            color: var(--error-color);
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 10px 12px;
            background: var(--input-background);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            font-size: 13px;
            color: var(--text-color);
            transition: border-color 0.2s ease;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--border-default);
        }

        .form-group textarea {
            resize: vertical;
            font-family: inherit;
        }

        .form-group input.error-shake {
            animation: shake 0.6s ease;
            border-color: var(--error-color);
        }

        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }

        .form-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 24px;
        }

        .btn-cancel,
        .btn-submit {
            padding: 10px 20px;
            font-size: 13px;
            font-weight: 500;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .btn-cancel {
            background: var(--input-background);
            color: var(--text-color);
            border: 1px solid var(--border-color);
        }

        .btn-cancel:hover {
            background: var(--hover-background);
        }

        .btn-submit {
            background: var(--start-button-background);
            color: var(--start-button-color);
        }

        .btn-submit:hover {
            opacity: 0.9;
        }

        /* Radio and Checkbox Styles */
        .radio-group,
        .checkbox-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 8px;
        }

        .checkbox-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 10px;
        }

        .radio-label,
        .checkbox-label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            padding: 8px 12px;
            background: var(--input-background);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            transition: all 0.2s ease;
        }

        .radio-label:hover,
        .checkbox-label:hover {
            border-color: var(--border-default);
            background: var(--hover-background);
        }

        .radio-label input[type="radio"],
        .checkbox-label input[type="checkbox"] {
            margin: 0;
            cursor: pointer;
            width: 16px;
            height: 16px;
        }

        .radio-label span,
        .checkbox-label span {
            font-size: 13px;
            color: var(--text-color);
            user-select: none;
        }

        .radio-label input[type="radio"]:checked + span,
        .checkbox-label input[type="checkbox"]:checked + span {
            font-weight: 500;
        }
    `;

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        isRecording: { type: Boolean },
        sessionActive: { type: Boolean },
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        layoutMode: { type: String },
        showInterviewSetup: { type: Boolean },
        interviewCompany: { type: String },
        interviewType: { type: String },
        interviewLanguages: { type: Array },
        interviewJobDescription: { type: String },
        _viewInstances: { type: Object, state: true },
        _isClickThrough: { state: true },
        _awaitingNewResponse: { state: true },
        shouldAnimateResponse: { type: Boolean },
        _storageLoaded: { state: true },
        isAuthenticated: { type: Boolean },
        isLoading: { type: Boolean },
    };

    constructor() {
        super();
        // Set defaults - will be overwritten by storage
        this.currentView = 'main'; // Will check onboarding and auth after storage loads
        this.statusText = '';
        this.startTime = null;
        this.isRecording = false;
        this.sessionActive = false;
        this.selectedProfile = 'interview';
        this.selectedLanguage = 'en-US';
        this.selectedScreenshotInterval = '5';
        this.selectedImageQuality = 'medium';
        this.layoutMode = 'normal';
        this.responses = [];
        this.currentResponseIndex = -1;
        this.isAuthenticated = false;
        this._viewInstances = new Map();
        this._isClickThrough = false;
        this._awaitingNewResponse = false;
        this._currentResponseIsComplete = true;
        this.shouldAnimateResponse = false;
        this._storageLoaded = false;
        this.isLoading = false;
        this.showInterviewSetup = false;
        this.interviewCompany = '';
        this.interviewType = 'technical';
        this.interviewLanguages = [];
        this.interviewJobDescription = '';

        // Load from storage
        this._loadFromStorage();
    }

    async _loadFromStorage() {
        try {
            const [config, prefs] = await Promise.all([
                cheatingDaddy.storage.getConfig(),
                cheatingDaddy.storage.getPreferences()
            ]);

            // SECURITY: Always require login on startup - no bypass
            // Even if credentials exist locally, user must authenticate every time
            this.currentView = 'login';
            this.isAuthenticated = false;

            // Apply background appearance (color + transparency)
            this.applyBackgroundAppearance(
                prefs.backgroundColor ?? '#1e1e1e',
                prefs.backgroundTransparency ?? 0.8
            );

            // Load preferences
            this.selectedProfile = prefs.selectedProfile || 'interview';
            this.selectedLanguage = prefs.selectedLanguage || 'en-US';
            this.selectedScreenshotInterval = prefs.selectedScreenshotInterval || '5';
            this.selectedImageQuality = prefs.selectedImageQuality || 'medium';
            this.layoutMode = config.layout || 'normal';

            this._storageLoaded = true;
            this.updateLayoutMode();
            this.requestUpdate();
        } catch (error) {
            console.error('Error loading from storage:', error);
            this._storageLoaded = true;
            this.requestUpdate();
        }
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 30, g: 30, b: 30 };
    }

    lightenColor(rgb, amount) {
        return {
            r: Math.min(255, rgb.r + amount),
            g: Math.min(255, rgb.g + amount),
            b: Math.min(255, rgb.b + amount)
        };
    }

    applyBackgroundAppearance(backgroundColor, alpha) {
        const root = document.documentElement;
        const baseRgb = this.hexToRgb(backgroundColor);

        // Generate color variants based on the base color
        const secondary = this.lightenColor(baseRgb, 7);
        const tertiary = this.lightenColor(baseRgb, 15);
        const hover = this.lightenColor(baseRgb, 20);

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
    }

    // Keep old function name for backwards compatibility
    applyBackgroundTransparency(alpha) {
        this.applyBackgroundAppearance('#1e1e1e', alpha);
    }

    connectedCallback() {
        super.connectedCallback();

        // Apply layout mode to document root
        this.updateLayoutMode();

        // Set up IPC listeners if needed
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('new-response', (_, response) => {
                this.addNewResponse(response);
            });
            ipcRenderer.on('update-response', (_, response) => {
                this.updateCurrentResponse(response);
            });
            ipcRenderer.on('update-status', (_, status) => {
                this.setStatus(status);
            });
            ipcRenderer.on('click-through-toggled', (_, isEnabled) => {
                this._isClickThrough = isEnabled;
            });
            ipcRenderer.on('reconnect-failed', (_, data) => {
                this.addNewResponse(data.message);
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeAllListeners('new-response');
            ipcRenderer.removeAllListeners('update-response');
            ipcRenderer.removeAllListeners('update-status');
            ipcRenderer.removeAllListeners('click-through-toggled');
            ipcRenderer.removeAllListeners('reconnect-failed');
        }
    }

    setStatus(text) {
        this.statusText = text;

        // Mark response as complete when we get certain status messages
        if (text.includes('Ready') || text.includes('Listening') || text.includes('Error')) {
            this._currentResponseIsComplete = true;
            console.log('[setStatus] Marked current response as complete');
        }
    }

    addNewResponse(response) {
        // Add a new response entry (first word of a new AI response)
        this.responses = [...this.responses, response];
        this.currentResponseIndex = this.responses.length - 1;
        this._awaitingNewResponse = false;
        this.isLoading = false; // Hide loading immediately when first chunk arrives
        console.log('[addNewResponse] Added:', response);
        this.requestUpdate();
    }

    updateCurrentResponse(response) {
        // Update the current response in place (streaming subsequent words)
        if (this.responses.length > 0) {
            this.responses = [...this.responses.slice(0, -1), response];
            console.log('[updateCurrentResponse] Updated to:', response);
        } else {
            // Fallback: if no responses exist, add as new
            this.addNewResponse(response);
        }
        this.requestUpdate();
    }

    // Header event handlers
    handleCustomizeClick() {
        // SECURITY: Require authentication
        if (!this.isAuthenticated) {
            console.warn('Unauthorized access attempt to customize view');
            this.currentView = 'login';
            return;
        }
        this.currentView = 'customize';
        this.requestUpdate();
    }

    handleHelpClick() {
        // SECURITY: Require authentication
        if (!this.isAuthenticated) {
            console.warn('Unauthorized access attempt to help view');
            this.currentView = 'login';
            return;
        }
        this.currentView = 'help';
        this.requestUpdate();
    }

    handleHistoryClick() {
        // SECURITY: Require authentication
        if (!this.isAuthenticated) {
            console.warn('Unauthorized access attempt to history view');
            this.currentView = 'login';
            return;
        }
        this.currentView = 'history';
        this.requestUpdate();
    }

        async handleClose() {
        if (this.currentView === 'customize' || this.currentView === 'help' || this.currentView === 'history') {
            this.currentView = 'main';
        } else if (this.currentView === 'assistant') {
            cheatingDaddy.stopCapture();

            // Stop Web Speech Recognition
            if (window.cheatingDaddy?.stopWebSpeech) {
                window.cheatingDaddy.stopWebSpeech();
            }

            // Close the Azure session
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('azure:stop-session');
            }
            this.sessionActive = false;
            this.currentView = 'main';
            console.log('Session closed');
        } else {
            // Quit the entire application
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('quit-application');
            }
        }
    }

    async handleHideToggle() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('toggle-window-visibility');
        }
    }

    // Main view event handlers
    async handleStart() {
        // Show interview setup form first
        this.showInterviewSetup = true;
        this.requestUpdate();
    }

    async handleInterviewSetupSubmit(company, interviewType, languages, jobDescription) {
        this.interviewCompany = company;
        this.interviewType = interviewType;
        this.interviewLanguages = languages;
        this.interviewJobDescription = jobDescription || '';
        this.showInterviewSetup = false;
        
        // Check if Azure is configured first
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            const azureResult = await ipcRenderer.invoke('azure:is-configured');
            
            if (azureResult.configured) {
                console.log('Using Azure OpenAI (auto-configured from .env)');
                
                // Build custom prompt with interview details
                let setupPrompt = `You are helping me answer for a ${interviewType} interview questions at ${this.interviewCompany}.`;
                
                if (this.interviewJobDescription) {
                    setupPrompt += ` Job Description: ${this.interviewJobDescription}.`;
                }
                
                if (interviewType === 'technical' && languages.length > 0) {
                    setupPrompt += ` Focus on ${languages.join(', ')} programming language${languages.length > 1 ? 's' : ''}.`;
                }
                
                setupPrompt += ' Help me answer interview questions by providing personalized, ready-to-read responses in 5th grade english during live interviews when relevant.';
                
                // Start Azure session
                await ipcRenderer.invoke('azure:start-session', {
                    profile: this.selectedProfile,
                    customPrompt: setupPrompt,
                    language: this.interviewLanguage
                });
                
                // Switch to assistant view first
                this.startTime = Date.now();
                this.currentView = 'assistant';
                this.sessionActive = true;
                this.requestUpdate();
                
                // Start Web Speech Recognition in renderer FIRST
                if (window.cheatingDaddy?.startWebSpeech) {
                    window.cheatingDaddy.startWebSpeech();
                }
                
                // Start screen capture
                cheatingDaddy.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality);
                
                // Initialize responses array
                this.responses = [];
                this.currentResponseIndex = -1;
                this.isLoading = true;
                
                // Wait a bit for speech recognition to fully initialize
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Send initial setup message to AI (response will appear in assistant view)
                await ipcRenderer.invoke('azure:send-message', {
                    message: setupPrompt,
                    context: null
                });
                
                return;
            }
        }
        
        // Fallback to Gemini if Azure not configured
        const apiKey = await cheatingDaddy.storage.getApiKey();
        if (!apiKey || apiKey === '') {
            // Trigger the red blink animation on the API key input
            const mainView = this.shadowRoot.querySelector('main-view');
            if (mainView && mainView.triggerApiKeyError) {
                mainView.triggerApiKeyError();
            }
            return;
        }

        await cheatingDaddy.initializeGemini(this.selectedProfile, this.selectedLanguage);
        // Pass the screenshot interval as string (including 'manual' option)
        cheatingDaddy.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality);
        this.responses = [];
        this.currentResponseIndex = -1;
        this.startTime = Date.now();
        this.currentView = 'assistant';
    }

    async handleAPIKeyHelp() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', 'https://cheatingdaddy.com/help/api-key');
        }
    }

    // Customize view event handlers
    async handleProfileChange(profile) {
        this.selectedProfile = profile;
        await cheatingDaddy.storage.updatePreference('selectedProfile', profile);
    }

    async handleLanguageChange(language) {
        this.selectedLanguage = language;
        await cheatingDaddy.storage.updatePreference('selectedLanguage', language);
    }

    async handleScreenshotIntervalChange(interval) {
        this.selectedScreenshotInterval = interval;
        await cheatingDaddy.storage.updatePreference('selectedScreenshotInterval', interval);
    }

    async handleImageQualityChange(quality) {
        this.selectedImageQuality = quality;
        await cheatingDaddy.storage.updatePreference('selectedImageQuality', quality);
    }

    handleBackClick() {
        this.currentView = 'main';
        this.requestUpdate();
    }

    // Help view event handlers
    async handleExternalLinkClick(url) {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', url);
        }
    }

    // Assistant view event handlers
    async handleSendText(message) {
        this.isLoading = true; // Show loading before sending
        const result = await window.cheatingDaddy.sendTextMessage(message);

        if (!result.success) {
            console.error('Failed to send message:', result.error);
            this.setStatus('Error sending message: ' + result.error);
            this.isLoading = false; // Hide loading on error
        } else {
            this.setStatus('Message sent...');
            this._awaitingNewResponse = true;
            // isLoading will be set to false in addNewResponse when first chunk arrives
        }
    }

    handleResponseIndexChanged(e) {
        this.currentResponseIndex = e.detail.index;
        this.shouldAnimateResponse = false;
        this.requestUpdate();
    }

    // Onboarding event handlers
    handleOnboardingComplete() {
        // After onboarding, show login screen
        this.currentView = 'login';
    }

    // Login event handlers
    handleLoginSuccess() {
        this.isAuthenticated = true;
        this.currentView = 'main';
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        // Only notify main process of view change if the view actually changed
        if (changedProperties.has('currentView') && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('view-changed', this.currentView);

            // Add a small delay to smooth out the transition
            const viewContainer = this.shadowRoot?.querySelector('.view-container');
            if (viewContainer) {
                viewContainer.classList.add('entering');
                requestAnimationFrame(() => {
                    viewContainer.classList.remove('entering');
                });
            }
        }

        if (changedProperties.has('layoutMode')) {
            this.updateLayoutMode();
        }
    }

    renderInterviewSetup() {
        return html`
            <div class="modal-overlay">
                <div class="interview-setup-modal">
                    <h2>Interview Setup</h2>
                    <form @submit=${(e) => {
                        e.preventDefault();
                        const company = e.target.company.value.trim();
                        if (!company) {
                            e.target.company.classList.add('error-shake');
                            setTimeout(() => e.target.company.classList.remove('error-shake'), 600);
                            return;
                        }
                        
                        const interviewType = e.target.querySelector('input[name="interviewType"]:checked')?.value || 'technical';
                        const jobDescription = e.target.jobDescription.value.trim();
                        
                        // Get selected programming languages (only for technical interviews)
                        let languages = [];
                        if (interviewType === 'technical') {
                            const checkedLangs = e.target.querySelectorAll('input[name="languages"]:checked');
                            languages = Array.from(checkedLangs).map(cb => cb.value);
                        }
                        
                        this.handleInterviewSetupSubmit(company, interviewType, languages, jobDescription);
                    }}>
                        <div class="form-group">
                            <label for="company">Company <span class="required">*</span></label>
                            <input 
                                type="text" 
                                id="company" 
                                name="company" 
                                placeholder="e.g., Google, Microsoft, Amazon..."
                                required
                            />
                        </div>
                        
                        <div class="form-group">
                            <label>Interview Type <span class="required">*</span></label>
                            <div class="radio-group">
                                <label class="radio-label">
                                    <input 
                                        type="radio" 
                                        name="interviewType" 
                                        value="technical" 
                                        checked
                                        @change=${(e) => {
                                            this.interviewType = e.target.value;
                                            this.requestUpdate();
                                        }}
                                    />
                                    <span>Technical</span>
                                </label>
                                <label class="radio-label">
                                    <input 
                                        type="radio" 
                                        name="interviewType" 
                                        value="behavioral"
                                        @change=${(e) => {
                                            this.interviewType = e.target.value;
                                            this.requestUpdate();
                                        }}
                                    />
                                    <span>Behavioral</span>
                                </label>
                                <label class="radio-label">
                                    <input 
                                        type="radio" 
                                        name="interviewType" 
                                        value="hr"
                                        @change=${(e) => {
                                            this.interviewType = e.target.value;
                                            this.requestUpdate();
                                        }}
                                    />
                                    <span>HR</span>
                                </label>
                                <label class="radio-label">
                                    <input 
                                        type="radio" 
                                        name="interviewType" 
                                        value="system-design"
                                        @change=${(e) => {
                                            this.interviewType = e.target.value;
                                            this.requestUpdate();
                                        }}
                                    />
                                    <span>System Design</span>
                                </label>
                            </div>
                        </div>
                        
                        ${this.interviewType === 'technical' ? html`
                            <div class="form-group">
                                <label>Preferred Programming Languages</label>
                                <div class="checkbox-grid">
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="languages" value="JavaScript" />
                                        <span>JavaScript</span>
                                    </label>
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="languages" value="Python" />
                                        <span>Python</span>
                                    </label>
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="languages" value="Java" />
                                        <span>Java</span>
                                    </label>
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="languages" value="C++" />
                                        <span>C++</span>
                                    </label>
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="languages" value="C#" />
                                        <span>C#</span>
                                    </label>
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="languages" value="TypeScript" />
                                        <span>TypeScript</span>
                                    </label>
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="languages" value="Go" />
                                        <span>Go</span>
                                    </label>
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="languages" value="Rust" />
                                        <span>Rust</span>
                                    </label>
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="languages" value="PHP" />
                                        <span>PHP</span>
                                    </label>
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="languages" value="Ruby" />
                                        <span>Ruby</span>
                                    </label>
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="languages" value="Swift" />
                                        <span>Swift</span>
                                    </label>
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="languages" value="Kotlin" />
                                        <span>Kotlin</span>
                                    </label>
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="form-group">
                            <label for="jobDescription">Job Description (Optional)</label>
                            <textarea 
                                id="jobDescription" 
                                name="jobDescription" 
                                placeholder="Paste job description or key requirements..."
                                rows="4"
                            ></textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-cancel" @click=${() => {
                                this.showInterviewSetup = false;
                                this.requestUpdate();
                            }}>Cancel</button>
                            <button type="submit" class="btn-submit">Start Interview</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    renderCurrentView() {
        // Only re-render the view if it hasn't been cached or if critical properties changed
        const viewKey = `${this.currentView}-${this.selectedProfile}-${this.selectedLanguage}`;

        switch (this.currentView) {
            case 'login':
                return html`
                    <login-view .onLogin=${() => this.handleLoginSuccess()}></login-view>
                `;

            case 'main':
                return html`
                    <main-view
                        .onStart=${() => this.handleStart()}
                        .onAPIKeyHelp=${() => this.handleAPIKeyHelp()}
                        .onLayoutModeChange=${layoutMode => this.handleLayoutModeChange(layoutMode)}
                    ></main-view>
                `;

            case 'customize':
                return html`
                    <customize-view
                        .selectedProfile=${this.selectedProfile}
                        .selectedLanguage=${this.selectedLanguage}
                        .selectedScreenshotInterval=${this.selectedScreenshotInterval}
                        .selectedImageQuality=${this.selectedImageQuality}
                        .layoutMode=${this.layoutMode}
                        .onProfileChange=${profile => this.handleProfileChange(profile)}
                        .onLanguageChange=${language => this.handleLanguageChange(language)}
                        .onScreenshotIntervalChange=${interval => this.handleScreenshotIntervalChange(interval)}
                        .onImageQualityChange=${quality => this.handleImageQualityChange(quality)}
                        .onLayoutModeChange=${layoutMode => this.handleLayoutModeChange(layoutMode)}
                    ></customize-view>
                `;

            case 'help':
                return html` <help-view .onExternalLinkClick=${url => this.handleExternalLinkClick(url)}></help-view> `;

            case 'history':
                return html` <history-view></history-view> `;

            case 'assistant':
                return html`
                    <assistant-view
                        .responses=${this.responses}
                        .currentResponseIndex=${this.currentResponseIndex}
                        .selectedProfile=${this.selectedProfile}
                        .onSendText=${message => this.handleSendText(message)}
                        .shouldAnimateResponse=${this.shouldAnimateResponse}
                        .isLoading=${this.isLoading}
                        @response-index-changed=${this.handleResponseIndexChanged}
                        @clear-responses=${() => {
                            this.responses = [];
                            this.currentResponseIndex = -1;
                            console.log('Responses cleared');
                            this.requestUpdate();
                        }}
                        @response-animation-complete=${() => {
                            this.shouldAnimateResponse = false;
                            this._currentResponseIsComplete = true;
                            console.log('[response-animation-complete] Marked current response as complete');
                            this.requestUpdate();
                        }}
                    ></assistant-view>
                `;

            default:
                return html`<div>Unknown view: ${this.currentView}</div>`;
        }
    }

    render() {
        const viewClassMap = {
            'assistant': 'assistant-view',
            'customize': 'settings-view',
            'help': 'help-view',
            'history': 'history-view',
        };
        const mainContentClass = `main-content ${viewClassMap[this.currentView] || 'with-border'}`;

        return html`
            <div class="window-container">
                <div class="container">
                    <app-header
                        .currentView=${this.currentView}
                        .statusText=${this.statusText}
                        .startTime=${this.startTime}
                        .onCustomizeClick=${() => this.handleCustomizeClick()}
                        .onHelpClick=${() => this.handleHelpClick()}
                        .onHistoryClick=${() => this.handleHistoryClick()}
                        .onCloseClick=${() => this.handleClose()}
                        .onBackClick=${() => this.handleBackClick()}
                        .onHideToggleClick=${() => this.handleHideToggle()}
                        ?isClickThrough=${this._isClickThrough}
                    ></app-header>
                    <div class="${mainContentClass}">
                        <div class="view-container">${this.renderCurrentView()}</div>
                    </div>
                    ${this.showInterviewSetup ? this.renderInterviewSetup() : ''}
                </div>
            </div>
        `;
    }

    updateLayoutMode() {
        // Apply or remove compact layout class to document root
        if (this.layoutMode === 'compact') {
            document.documentElement.classList.add('compact-layout');
        } else {
            document.documentElement.classList.remove('compact-layout');
        }
    }

    async handleLayoutModeChange(layoutMode) {
        this.layoutMode = layoutMode;
        await cheatingDaddy.storage.updateConfig('layout', layoutMode);
        this.updateLayoutMode();

        // Notify main process about layout change for window resizing
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-sizes');
            } catch (error) {
                console.error('Failed to update sizes in main process:', error);
            }
        }

        this.requestUpdate();
    }
}

customElements.define('pulse-app', PulseApp);
