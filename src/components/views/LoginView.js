import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class LoginView extends LitElement {
    static styles = css`
        :host {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
            background: var(--bg-primary);
        }

        .login-container {
            background: var(--bg-secondary);
            border-radius: var(--border-radius);
            padding: 32px;
            border: 1px solid var(--border-color);
            max-width: 400px;
            width: 90%;
        }

        .login-header {
            text-align: center;
            margin-bottom: 24px;
        }

        .login-logo {
            font-size: 40px;
            margin-bottom: 12px;
        }

        .login-title {
            font-size: 20px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 6px;
        }

        .login-subtitle {
            font-size: 13px;
            color: var(--text-secondary);
        }

        .login-form {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .form-label {
            font-size: 12px;
            font-weight: 500;
            color: var(--text-color);
        }

        .form-input {
            padding: 10px 12px;
            font-size: 14px;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            background: var(--input-background);
            color: var(--text-color);
            transition: all 0.2s;
            font-family: inherit;
        }

        .form-input:focus {
            outline: none;
            border-color: var(--text-secondary);
            background: var(--input-focus-background);
        }

        .form-input::placeholder {
            color: var(--placeholder-color);
        }

        .login-button {
            padding: 12px 20px;
            font-size: 14px;
            font-weight: 600;
            color: var(--start-button-color);
            background: var(--start-button-background);
            border: 1px solid var(--start-button-border);
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 8px;
        }

        .login-button:hover:not(:disabled) {
            background: var(--start-button-hover-background);
            border-color: var(--start-button-hover-border);
        }

        .login-button:active:not(:disabled) {
            transform: translateY(1px);
        }

        .login-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .error-message {
            padding: 10px 12px;
            background: rgba(241, 76, 76, 0.1);
            border: 1px solid var(--error-color);
            border-radius: var(--border-radius);
            color: var(--error-color);
            font-size: 13px;
            text-align: center;
        }

        .info-message {
            text-align: center;
            padding: 10px;
            background: rgba(78, 201, 176, 0.1);
            border: 1px solid var(--success-color);
            border-radius: var(--border-radius);
            margin-bottom: 12px;
        }

        .info-text {
            font-size: 12px;
            color: var(--success-color);
            font-weight: 500;
        }

        .loading-spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid var(--border-color);
            border-top-color: var(--text-color);
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
            margin-right: 8px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;

    static properties = {
        errorMessage: { type: String },
        userId: { type: String },
        password: { type: String },
        onLogin: { type: Function },
        isLoading: { type: Boolean },
    };

    constructor() {
        super();
        this.errorMessage = '';
        this.userId = '';
        this.password = '';
        this.isLoading = false;
    }

    handleUserIdInput(e) {
        this.userId = e.target.value;
        this.errorMessage = '';
    }

    handlePasswordInput(e) {
        this.password = e.target.value;
        this.errorMessage = '';
    }

    handleKeyPress(e) {
        if (e.key === 'Enter') {
            this.handleLogin();
        }
    }

    async handleLogin() {
        if (!this.userId || !this.password) {
            this.errorMessage = 'Please enter both User ID and Password';
            return;
        }

        // Login mode only - verify credentials from Firebase
        this.isLoading = true;
        try {
            const isValid = await window.pulse.storage.verifyPulseCredentials(this.userId, this.password);
            if (isValid) {
                this.errorMessage = '';
                this.dispatchEvent(new CustomEvent('login-success'));
                if (this.onLogin) {
                    this.onLogin();
                }
            } else {
                this.errorMessage = 'Invalid User ID or Password';
                this.password = '';
            }
        } catch (error) {
            console.error('Login error:', error);
            this.errorMessage = 'Login verification failed. Please try again.';
        } finally {
            this.isLoading = false;
        }
    }

    render() {
        return html`
            <div class="login-container">
                <div class="login-header">
                    <div class="login-logo">🔐</div>
                    <div class="login-title">Welcome to Pulse</div>
                    <div class="login-subtitle">
                        Please login with your credentials
                    </div>
                </div>

                <div class="info-message">
                    <div class="info-text">
                        💡 Use your assigned User ID and Password
                    </div>
                </div>

                ${this.errorMessage ? html`
                    <div class="error-message">${this.errorMessage}</div>
                ` : ''}

                <div class="login-form">
                    <div class="form-group">
                        <label class="form-label">User ID</label>
                        <input
                            type="text"
                            class="form-input"
                            placeholder="Enter your user ID"
                            .value=${this.userId}
                            @input=${this.handleUserIdInput}
                            @keypress=${this.handleKeyPress}
                            autocomplete="username"
                        />
                    </div>

                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input
                            type="password"
                            class="form-input"
                            placeholder="Enter your password"
                            .value=${this.password}
                            @input=${this.handlePasswordInput}
                            @keypress=${this.handleKeyPress}
                            autocomplete="current-password"
                        />
                    </div>

                    <button 
                        class="login-button" 
                        @click=${this.handleLogin}
                        ?disabled=${!this.userId || !this.password || this.isLoading}
                    >
                        ${this.isLoading ? html`<span class="loading-spinner"></span>` : ''}
                        ${this.isLoading ? 'Logging in...' : 'Login'}
                    </button>
                </div>
            </div>
        `;
    }
}

customElements.define('login-view', LoginView);
