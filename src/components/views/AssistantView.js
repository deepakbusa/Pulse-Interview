import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class AssistantView extends LitElement {
    static styles = css`
        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            cursor: default;
        }

        .connection-alert {
            background: rgba(255, 59, 48, 0.1);
            border-bottom: 1px solid rgba(255, 59, 48, 0.3);
            padding: 4px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 10px;
            color: #ff3b30;
            font-weight: 500;
            animation: slideDown 0.2s ease;
        }

        .connection-alert::before {
            content: '';
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: #ff3b30;
            animation: blink 1.5s infinite;
        }

        @keyframes slideDown {
            from { transform: translateY(-100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .connection-alert.hidden {
            display: none;
        }

        .transcription-display {
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            padding: 12px 16px;
            min-height: 50px;
            max-height: 150px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .transcription-display.listening {
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { border-bottom-color: var(--border-color); }
            50% { border-bottom-color: var(--border-hover); }
        }

        .transcription-label {
            font-size: 11px;
            color: var(--text-secondary);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .transcription-label .mic-icon {
            width: 14px;
            height: 14px;
            animation: blink 1.5s infinite;
        }

        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }

        .transcription-text {
            font-size: 15px;
            color: var(--text-color);
            line-height: 1.5;
            font-weight: 500;
        }

        .transcription-interim {
            color: var(--text-secondary);
            font-style: italic;
        }

        .response-wrapper {
            position: relative;
            height: calc(100% - 50px);
            overflow: hidden;
        }

        .response-container {
            height: 100%;
            overflow-y: auto;
            font-size: var(--response-font-size, 16px);
            line-height: 1.6;
            background: var(--bg-primary);
            padding: 12px;
            scroll-behavior: smooth;
            user-select: text;
            cursor: text;
        }

        .response-container * {
            user-select: text;
            cursor: text;
        }

        .response-container a {
            cursor: pointer;
        }

        /* Word display (no animation) */
        .response-container [data-word] {
            display: inline-block;
        }

        /* Markdown styling */
        .response-container h1,
        .response-container h2,
        .response-container h3,
        .response-container h4,
        .response-container h5,
        .response-container h6 {
            margin: 1em 0 0.5em 0;
            color: var(--text-color);
            font-weight: 600;
        }

        .response-container h1 { font-size: 1.6em; }
        .response-container h2 { font-size: 1.4em; }
        .response-container h3 { font-size: 1.2em; }
        .response-container h4 { font-size: 1.1em; }
        .response-container h5 { font-size: 1em; }
        .response-container h6 { font-size: 0.9em; }

        .response-container p {
            margin: 0.6em 0;
            color: var(--text-color);
        }

        .response-container ul,
        .response-container ol {
            margin: 0.6em 0;
            padding-left: 1.5em;
            color: var(--text-color);
        }

        .response-container li {
            margin: 0.3em 0;
        }

        .response-container blockquote {
            margin: 0.8em 0;
            padding: 0.5em 1em;
            border-left: 2px solid var(--border-default);
            background: var(--bg-secondary);
        }

        .response-container code {
            background: var(--bg-tertiary);
            padding: 0.15em 0.4em;
            border-radius: 3px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 0.85em;
        }

        .response-container pre {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 3px;
            padding: 12px;
            overflow-x: auto;
            margin: 0.8em 0;
        }

        .response-container pre code {
            background: none;
            padding: 0;
        }

        .response-container a {
            color: var(--text-color);
            text-decoration: underline;
            text-underline-offset: 2px;
        }

        .response-container strong,
        .response-container b {
            font-weight: 600;
        }

        .response-container hr {
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 1.5em 0;
        }

        .response-container table {
            border-collapse: collapse;
            width: 100%;
            margin: 0.8em 0;
        }

        .response-container th,
        .response-container td {
            border: 1px solid var(--border-color);
            padding: 8px;
            text-align: left;
        }

        .response-container th {
            background: var(--bg-secondary);
            font-weight: 600;
        }

        .response-container::-webkit-scrollbar {
            width: 8px;
        }

        .response-container::-webkit-scrollbar-track {
            background: transparent;
        }

        .response-container::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 4px;
        }

        .response-container::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        .text-input-container {
            display: flex;
            gap: 8px;
            margin-top: 8px;
            align-items: center;
        }

        .text-input-container input {
            flex: 1;
            background: transparent;
            color: var(--text-color);
            border: none;
            border-bottom: 1px solid var(--border-color);
            padding: 8px 4px;
            border-radius: 0;
            font-size: 13px;
        }

        .text-input-container input:focus {
            outline: none;
            border-bottom-color: var(--text-color);
        }

        .text-input-container input::placeholder {
            color: var(--placeholder-color);
        }

        .nav-button {
            background: transparent;
            color: var(--text-secondary);
            border: none;
            padding: 6px;
            border-radius: 3px;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.1s ease;
        }

        .nav-button:hover {
            background: var(--hover-background);
            color: var(--text-color);
        }

        .nav-button:disabled {
            opacity: 0.3;
        }

        .nav-button svg {
            width: 18px;
            height: 18px;
            stroke: currentColor;
        }

        .response-counter {
            font-size: 11px;
            color: var(--text-muted);
            white-space: nowrap;
            min-width: 50px;
            text-align: center;
            font-family: 'SF Mono', Monaco, monospace;
        }

        .screen-answer-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            background: var(--btn-primary-bg, #ffffff);
            color: var(--btn-primary-text, #000000);
            border: none;
            padding: 5px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            white-space: nowrap;
        }

        .screen-answer-btn:hover {
            background: var(--btn-primary-hover, #f0f0f0);
        }

        .screen-answer-btn svg {
            width: 14px;
            height: 14px;
            flex-shrink: 0;
        }

        .screen-answer-btn .shortcut-text {
            font-size: 10px;
            opacity: 0.6;
            font-family: 'SF Mono', Monaco, monospace;
            margin-left: 4px;
        }

        .screen-answer-btn-wrapper {
            position: relative;
        }

        .button-row {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .screen-answer-btn-wrapper .tooltip {
            position: absolute;
            bottom: 100%;
            right: 0;
            margin-bottom: 8px;
            background: var(--tooltip-bg, #1a1a1a);
            color: var(--tooltip-text, #ffffff);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 11px;
            white-space: nowrap;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.15s ease, visibility 0.15s ease;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 100;
        }

        .screen-answer-btn-wrapper .tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            right: 16px;
            border: 6px solid transparent;
            border-top-color: var(--tooltip-bg, #1a1a1a);
        }

        .screen-answer-btn-wrapper:hover .tooltip {
            opacity: 1;
            visibility: visible;
        }

        .tooltip-row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 4px;
        }

        .tooltip-row:last-child {
            margin-bottom: 0;
        }

        .tooltip-label {
            opacity: 0.7;
        }

        .tooltip-value {
            font-family: 'SF Mono', Monaco, monospace;
        }

        .tooltip-note {
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px solid rgba(255,255,255,0.1);
            opacity: 0.5;
            font-size: 10px;
        }

        .resume-sync-container {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            background: var(--bg-secondary);
            border-radius: 4px;
            border: 1px solid var(--border-color);
            transition: all 0.2s ease;
            white-space: nowrap;
        }

        .resume-sync-container:hover {
            background: var(--bg-tertiary);
            border-color: var(--border-hover);
        }

        .resume-sync-checkbox {
            width: 14px;
            height: 14px;
            accent-color: var(--btn-primary-bg, #ffffff);
            cursor: pointer;
            margin: 0;
            flex-shrink: 0;
        }

        .resume-sync-label {
            font-size: 10px;
            color: var(--text-color);
            cursor: pointer;
            user-select: none;
            font-weight: 500;
        }

        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--bg-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }

        .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
        }

        .loading-spinner {
            width: 60px;
            height: 60px;
            position: relative;
        }

        .loading-spinner::before,
        .loading-spinner::after {
            content: '';
            position: absolute;
            border-radius: 50%;
        }

        .loading-spinner::before {
            width: 100%;
            height: 100%;
            border: 3px solid transparent;
            border-top-color: var(--btn-primary-bg, #ffffff);
            animation: spin 1s linear infinite;
        }

        .loading-spinner::after {
            width: 80%;
            height: 80%;
            top: 10%;
            left: 10%;
            border: 3px solid transparent;
            border-top-color: var(--text-color);
            opacity: 0.5;
            animation: spin 0.7s linear infinite reverse;
        }

        @keyframes spin {
            0% {
                transform: rotate(0deg);
            }
            100% {
                transform: rotate(360deg);
            }
        }

        .loading-text {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-color);
            animation: pulse 1.5s ease-in-out infinite;
            letter-spacing: 0.5px;
        }

        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.5;
            }
        }

        .loading-dots {
            display: inline-flex;
            gap: 4px;
            margin-left: 4px;
        }

        .loading-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--btn-primary-bg, #ffffff);
            animation: bounce 1.4s ease-in-out infinite;
        }

        .loading-dot:nth-child(1) {
            animation-delay: 0s;
        }

        .loading-dot:nth-child(2) {
            animation-delay: 0.2s;
        }

        .loading-dot:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes bounce {
            0%, 80%, 100% {
                transform: scale(0.8);
                opacity: 0.5;
            }
            40% {
                transform: scale(1.2);
                opacity: 1;
            }
        }
    `;

    static properties = {
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        selectedProfile: { type: String },
        onSendText: { type: Function },
        shouldAnimateResponse: { type: Boolean },
        flashCount: { type: Number },
        flashLiteCount: { type: Number },
        transcriptionText: { type: String },
        interimText: { type: String },
        isListening: { type: Boolean },
        isOffline: { type: Boolean },
        syncWithResume: { type: Boolean },
        hasResumeContent: { type: Boolean },
        isLoading: { type: Boolean },
    };

    constructor() {
        super();
        this.responses = [];
        this.currentResponseIndex = -1;
        this.selectedProfile = 'interview';
        this.onSendText = () => {};
        this.flashCount = 0;
        this.flashLiteCount = 0;
        this.transcriptionText = '';
        this.interimText = '';
        this.isListening = false;
        this.isOffline = false;
        this.syncWithResume = false;
        this.hasResumeContent = false;
        this.isLoading = false;
        this._checkResumeContent();
        this._setupConnectionMonitor();
    }

    async _checkResumeContent() {
        try {
            const prefs = await window.pulse.storage.getPreferences();
            this.hasResumeContent = !!(prefs.resumeContent && prefs.resumeContent.trim());
            // Always start with sync OFF when entering live interview
            this.syncWithResume = false;
        } catch (error) {
            console.error('Error checking resume content:', error);
        }
    }

    _setupConnectionMonitor() {
        window.addEventListener('online', () => {
            this.isOffline = false;
            console.log('Connection restored');
        });
        window.addEventListener('offline', () => {
            this.isOffline = true;
            console.log('Connection lost');
        });
        this.isOffline = !navigator.onLine;
    }

    async handleResumeSyncChange(e) {
        const checked = e.target.checked;
        
        // If trying to enable sync, check if resume content exists
        if (checked) {
            const prefs = await window.pulse.storage.getPreferences();
            const resumeContent = prefs.resumeContent || '';
            
            if (!resumeContent.trim()) {
                // Show alert and uncheck
                alert('Please save your resume content in Settings.');
                e.target.checked = false;
                this.syncWithResume = false;
                return;
            }
            
            // Resume content exists, proceed with sync
            this.syncWithResume = true;
            await window.pulse.storage.updatePreference('syncWithResume', true);
            
            const message = `Please remember the following information about me for this conversation. Use this context to provide personalized responses when relevant:\n\n${resumeContent}\n\nAcknowledge that you've saved this information.`;
            await this.onSendText(message);
        } else {
            // Disabling sync
            this.syncWithResume = false;
            try {
                await window.pulse.storage.updatePreference('syncWithResume', false);
            } catch (error) {
                console.error('Error saving resume sync preference:', error);
            }
        }
    }

    getProfileNames() {
        return {
            interview: 'Job Interview',
            sales: 'Sales Call',
            meeting: 'Business Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
            exam: 'Exam Assistant',
        };
    }

    getCurrentResponse() {
        const profileNames = this.getProfileNames();
        return this.responses.length > 0 && this.currentResponseIndex >= 0
            ? this.responses[this.currentResponseIndex]
            : `Hey, Im listening to your ${profileNames[this.selectedProfile] || 'session'}?`;
    }

    renderMarkdown(content) {
        // Check if marked is available
        if (typeof window !== 'undefined' && window.marked) {
            try {
                // Configure marked for better security and formatting
                window.marked.setOptions({
                    breaks: true,
                    gfm: true,
                    sanitize: false, // We trust the AI responses
                });
                let rendered = window.marked.parse(content);
                rendered = this.wrapWordsInSpans(rendered);
                return rendered;
            } catch (error) {
                console.warn('Error parsing markdown:', error);
                return content; // Fallback to plain text
            }
        }
        console.log('Marked not available, using plain text');
        return content; // Fallback if marked is not available
    }

    wrapWordsInSpans(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tagsToSkip = ['PRE'];

        function wrap(node) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() && !tagsToSkip.includes(node.parentNode.tagName)) {
                const words = node.textContent.split(/(\s+)/);
                const frag = document.createDocumentFragment();
                words.forEach(word => {
                    if (word.trim()) {
                        const span = document.createElement('span');
                        span.setAttribute('data-word', '');
                        span.textContent = word;
                        frag.appendChild(span);
                    } else {
                        frag.appendChild(document.createTextNode(word));
                    }
                });
                node.parentNode.replaceChild(frag, node);
            } else if (node.nodeType === Node.ELEMENT_NODE && !tagsToSkip.includes(node.tagName)) {
                Array.from(node.childNodes).forEach(wrap);
            }
        }
        Array.from(doc.body.childNodes).forEach(wrap);
        return doc.body.innerHTML;
    }

    getResponseCounter() {
        return this.responses.length > 0 ? `${this.currentResponseIndex + 1}/${this.responses.length}` : '';
    }

    navigateToPreviousResponse() {
        if (this.currentResponseIndex > 0) {
            this.currentResponseIndex--;
            this.dispatchEvent(
                new CustomEvent('response-index-changed', {
                    detail: { index: this.currentResponseIndex },
                })
            );
            this.requestUpdate();
        }
    }

    navigateToNextResponse() {
        if (this.currentResponseIndex < this.responses.length - 1) {
            this.currentResponseIndex++;
            this.dispatchEvent(
                new CustomEvent('response-index-changed', {
                    detail: { index: this.currentResponseIndex },
                })
            );
            this.requestUpdate();
        }
    }

    scrollResponseUp() {
        const container = this.shadowRoot.querySelector('.response-container');
        if (container) {
            const scrollAmount = container.clientHeight * 0.3; // Scroll 30% of container height
            container.scrollTop = Math.max(0, container.scrollTop - scrollAmount);
        }
    }

    scrollResponseDown() {
        const container = this.shadowRoot.querySelector('.response-container');
        if (container) {
            const scrollAmount = container.clientHeight * 0.3; // Scroll 30% of container height
            container.scrollTop = Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + scrollAmount);
        }
    }

    connectedCallback() {
        super.connectedCallback();

        // Load limits on mount
        this.loadLimits();

        // Set up IPC listeners for keyboard shortcuts
        if (window.require) {
            const { ipcRenderer } = window.require('electron');

            this.handlePreviousResponse = () => {
                console.log('Received navigate-previous-response message');
                this.navigateToPreviousResponse();
            };

            this.handleNextResponse = () => {
                console.log('Received navigate-next-response message');
                this.navigateToNextResponse();
            };

            this.handleScrollUp = () => {
                console.log('Received scroll-response-up message');
                this.scrollResponseUp();
            };

            this.handleScrollDown = () => {
                console.log('Received scroll-response-down message');
                this.scrollResponseDown();
            };

            this.handleSendTranscription = async () => {
                console.log('Ctrl+D pressed - Sending accumulated transcription');
                if (this.transcriptionText && this.transcriptionText.trim()) {
                    const textToSend = this.transcriptionText.trim();
                    console.log('Sending transcription to GPT:', textToSend);
                    
                    // Clear transcription and interim before sending
                    this.transcriptionText = '';
                    this.interimText = '';
                    this.requestUpdate();
                    
                    // Send the message
                    await this.onSendText(textToSend);
                }
            };

            // Azure Speech Recognition handlers
            this.handleSpeechRecognizing = (event, data) => {
                console.log('Speech recognizing (interim):', data.text);
                this.isListening = true;
                // Show interim text separately (will be replaced by final)
                this.interimText = data.text;
                this.requestUpdate();
            };

            this.handleSpeechRecognized = async (event, data) => {
                console.log('Speech recognized (final):', data.text);
                // Keep listening indicator on
                this.isListening = true;
                
                // Clear interim text since we got final
                this.interimText = '';
                
                // ACCUMULATE recognized text (don't replace)
                // Add space if there's already text
                if (this.transcriptionText && !this.transcriptionText.endsWith(' ')) {
                    this.transcriptionText += ' ';
                }
                this.transcriptionText += data.text;
                
                this.requestUpdate();
                
                // Auto-scroll transcription display to bottom
                setTimeout(() => {
                    const transcriptionDisplay = this.shadowRoot.querySelector('.transcription-display');
                    if (transcriptionDisplay) {
                        transcriptionDisplay.scrollTop = transcriptionDisplay.scrollHeight;
                    }
                }, 50);
                
                // NO AUTO-SEND - Only send when user presses Ctrl+D
                console.log('✋ Transcription accumulated. Press Ctrl+D to send.');
            };

            this.handleSpeechSessionStarted = () => {
                console.log('Speech session started');
                this.isListening = true;
                this.transcriptionText = '';
                this.interimText = '';
                this.requestUpdate();
            };

            this.handleSpeechSessionStopped = () => {
                console.log('Speech session stopped');
                this.isListening = false;
                this.transcriptionText = '';
                this.interimText = '';
                this.requestUpdate();
            };

            ipcRenderer.on('navigate-previous-response', this.handlePreviousResponse);
            ipcRenderer.on('navigate-next-response', this.handleNextResponse);
            ipcRenderer.on('scroll-response-up', this.handleScrollUp);
            ipcRenderer.on('scroll-response-down', this.handleScrollDown);
            ipcRenderer.on('send-transcription', this.handleSendTranscription);

            // Azure Speech IPC listeners
            ipcRenderer.on('azure:speech-recognizing', this.handleSpeechRecognizing);
            ipcRenderer.on('azure:speech-recognized', this.handleSpeechRecognized);
            ipcRenderer.on('azure:speech-session-started', this.handleSpeechSessionStarted);
            ipcRenderer.on('azure:speech-session-stopped', this.handleSpeechSessionStopped);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        // Stop Azure speech recognition when leaving assistant view
        if (window.cheatingDaddy?.stopWebSpeech) {
            window.cheatingDaddy.stopWebSpeech();
        }

        // Clean up IPC listeners
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            if (this.handlePreviousResponse) {
                ipcRenderer.removeListener('navigate-previous-response', this.handlePreviousResponse);
            }
            if (this.handleNextResponse) {
                ipcRenderer.removeListener('navigate-next-response', this.handleNextResponse);
            }
            if (this.handleScrollUp) {
                ipcRenderer.removeListener('scroll-response-up', this.handleScrollUp);
            }
            if (this.handleScrollDown) {
                ipcRenderer.removeListener('scroll-response-down', this.handleScrollDown);
            }
            if (this.handleSendTranscription) {
                ipcRenderer.removeListener('send-transcription', this.handleSendTranscription);
            }
            
            // Clean up Azure Speech listeners
            if (this.handleSpeechRecognizing) {
                ipcRenderer.removeListener('azure:speech-recognizing', this.handleSpeechRecognizing);
            }
            if (this.handleSpeechRecognized) {
                ipcRenderer.removeListener('azure:speech-recognized', this.handleSpeechRecognized);
            }
            if (this.handleSpeechSessionStarted) {
                ipcRenderer.removeListener('azure:speech-session-started', this.handleSpeechSessionStarted);
            }
            if (this.handleSpeechSessionStopped) {
                ipcRenderer.removeListener('azure:speech-session-stopped', this.handleSpeechSessionStopped);
            }
        }
    }

    async handleSendText() {
        const textInput = this.shadowRoot.querySelector('#textInput');
        if (textInput && textInput.value.trim()) {
            const message = textInput.value.trim();
            textInput.value = ''; // Clear input
            // isLoading is now controlled by parent component for instant dismissal
            await this.onSendText(message);
        }
    }

    handleTextKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSendText();
        }
    }

    async loadLimits() {
        if (window.cheatingDaddy?.storage?.getTodayLimits) {
            const limits = await window.cheatingDaddy.storage.getTodayLimits();
            this.flashCount = limits.flash?.count || 0;
            this.flashLiteCount = limits.flashLite?.count || 0;
        }
    }

    getTotalUsed() {
        return this.flashCount + this.flashLiteCount;
    }

    getTotalAvailable() {
        return 40; // 20 flash + 20 flash-lite
    }

    async handleScreenAnswer() {
        if (window.captureManualScreenshot) {
            this.isLoading = true;
            try {
                await window.captureManualScreenshot();
                // Reload limits after a short delay to catch the update
                setTimeout(() => this.loadLimits(), 1000);
            } finally {
                this.isLoading = false;
            }
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            const container = this.shadowRoot.querySelector('.response-container');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 0);
    }

    firstUpdated() {
        super.firstUpdated();
        this.updateResponseContent();
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('responses') || changedProperties.has('currentResponseIndex')) {
            this.updateResponseContent();
        }
    }

    updateResponseContent() {
        console.log('updateResponseContent called');
        const container = this.shadowRoot.querySelector('#responseContainer');
        if (container) {
            const currentResponse = this.getCurrentResponse();
            console.log('Current response:', currentResponse);
            const renderedResponse = this.renderMarkdown(currentResponse);
            console.log('Rendered response:', renderedResponse);
            container.innerHTML = renderedResponse;
            // Show all words immediately (no animation)
            if (this.shouldAnimateResponse) {
                this.dispatchEvent(new CustomEvent('response-animation-complete', { bubbles: true, composed: true }));
            }
        } else {
            console.log('Response container not found');
        }
    }

    render() {
        const responseCounter = this.getResponseCounter();

        return html`
            ${this.isOffline ? html`
                <div class="connection-alert">Internet disconnected</div>
            ` : ''}

            ${(this.isListening || this.transcriptionText || this.interimText) ? html`
                <div class="transcription-display ${this.isListening ? 'listening' : ''}">
                    <div class="transcription-label">
                        <svg class="mic-icon" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z"></path>
                            <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z"></path>
                        </svg>
                        🎤 Listening... (Press Ctrl+D to send)
                    </div>
                    <div class="transcription-text">
                        ${this.transcriptionText}${this.interimText ? html`<span style="opacity: 0.6">${this.interimText}</span>` : ''}${!this.transcriptionText && !this.interimText ? 'Speak now...' : ''}
                    </div>
                </div>
            ` : ''}

            <div class="response-wrapper">
                ${this.isLoading ? html`
                    <div class="loading-overlay">
                        <div class="loading-container">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">
                                AI Thinking
                                <span class="loading-dots">
                                    <span class="loading-dot"></span>
                                    <span class="loading-dot"></span>
                                    <span class="loading-dot"></span>
                                </span>
                            </div>
                        </div>
                    </div>
                ` : ''}
                <div class="response-container" id="responseContainer"></div>
            </div>

            <div class="text-input-container">
                <button class="nav-button" @click=${this.navigateToPreviousResponse} ?disabled=${this.currentResponseIndex <= 0}>
                    <svg width="24px" height="24px" stroke-width="1.7" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>

                ${this.responses.length > 0 ? html`<span class="response-counter">${responseCounter}</span>` : ''}

                <button class="nav-button" @click=${this.navigateToNextResponse} ?disabled=${this.currentResponseIndex >= this.responses.length - 1}>
                    <svg width="24px" height="24px" stroke-width="1.7" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>

                <input type="text" id="textInput" placeholder="Type a message to the AI..." @keydown=${this.handleTextKeydown} />

                <div class="button-row">
                    ${this.hasResumeContent ? html`
                        <div class="resume-sync-container">
                            <input 
                                type="checkbox" 
                                id="resumeSync" 
                                class="resume-sync-checkbox"
                                .checked=${this.syncWithResume}
                                @change=${this.handleResumeSyncChange}
                            />
                            <label for="resumeSync" class="resume-sync-label" @click=${(e) => { e.preventDefault(); this.shadowRoot.querySelector('#resumeSync').click(); }}>
                                Sync resume
                            </label>
                        </div>
                    ` : ''}

                    <div class="screen-answer-btn-wrapper">
                        <div class="tooltip">
                            <div class="tooltip-row">
                                <span class="tooltip-label">Flash</span>
                                <span class="tooltip-value">${this.flashCount}/20</span>
                            </div>
                            <div class="tooltip-row">
                                <span class="tooltip-label">Flash Lite</span>
                                <span class="tooltip-value">${this.flashLiteCount}/20</span>
                            </div>
                            <div class="tooltip-note">Resets every 24 hours</div>
                        </div>
                        <button class="screen-answer-btn" @click=${this.handleScreenAnswer}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.632.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.551a1 1 0 0 0 1.898 0l.184-.551a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.184a1 1 0 0 1-.633-.632l-.183-.551Z" />
                            </svg>
                            <span>Analyze</span>
                            <span class="shortcut-text">(Ctrl+/)</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('assistant-view', AssistantView);
