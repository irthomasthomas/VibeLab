// Enhanced Error Display System for VibeLab Frontend

class VibeLab_ErrorManager {
    constructor() {
        this.createErrorContainer();
        this.setupStyles();
    }

    createErrorContainer() {
        // Create error notification container if it doesn't exist
        let container = document.getElementById('vl-error-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'vl-error-container';
            container.className = 'vl-error-container';
            document.body.appendChild(container);
        }
        this.container = container;
    }

    setupStyles() {
        // Add CSS if not already present
        if (!document.getElementById('vl-error-styles')) {
            const style = document.createElement('style');
            style.id = 'vl-error-styles';
            style.textContent = `
                .vl-error-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    max-width: 400px;
                }
                
                .vl-error-notification {
                    margin-bottom: 10px;
                    padding: 12px 16px;
                    border-radius: 6px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    animation: slideIn 0.3s ease-out;
                    position: relative;
                    max-height: 150px;
                    overflow-y: auto;
                }
                
                .vl-error-notification.error {
                    background: #fee;
                    border-left: 4px solid #e53e3e;
                    color: #742a2a;
                }
                
                .vl-error-notification.warning {
                    background: #fffbeb;
                    border-left: 4px solid #f59e0b;
                    color: #92400e;
                }
                
                .vl-error-notification.success {
                    background: #f0fff4;
                    border-left: 4px solid #10b981;
                    color: #065f46;
                }
                
                .vl-error-notification.info {
                    background: #eff6ff;
                    border-left: 4px solid #3b82f6;
                    color: #1e40af;
                }
                
                .vl-error-header {
                    font-weight: 600;
                    margin-bottom: 4px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .vl-error-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    opacity: 0.7;
                    padding: 0;
                    margin-left: 8px;
                }
                
                .vl-error-close:hover {
                    opacity: 1;
                }
                
                .vl-error-message {
                    font-size: 14px;
                    line-height: 1.4;
                }
                
                .vl-error-details {
                    margin-top: 8px;
                    font-size: 12px;
                    opacity: 0.8;
                    font-family: monospace;
                    background: rgba(0,0,0,0.05);
                    padding: 4px 8px;
                    border-radius: 3px;
                    max-height: 60px;
                    overflow-y: auto;
                }
                
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes fadeOut {
                    from {
                        opacity: 1;
                        transform: scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                }
                
                .vl-error-notification.fadeOut {
                    animation: fadeOut 0.2s ease-in forwards;
                }
            `;
            document.head.appendChild(style);
        }
    }

    showNotification(type, title, message, details = null, duration = 8000) {
        const notification = document.createElement('div');
        notification.className = `vl-error-notification ${type}`;
        
        const closeButton = document.createElement('button');
        closeButton.className = 'vl-error-close';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => this.removeNotification(notification);
        
        const header = document.createElement('div');
        header.className = 'vl-error-header';
        header.innerHTML = `<span>${title}</span>`;
        header.appendChild(closeButton);
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'vl-error-message';
        messageDiv.textContent = message;
        
        notification.appendChild(header);
        notification.appendChild(messageDiv);
        
        if (details) {
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'vl-error-details';
            detailsDiv.textContent = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
            notification.appendChild(detailsDiv);
        }
        
        this.container.appendChild(notification);
        
        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    this.removeNotification(notification);
                }
            }, duration);
        }
        
        return notification;
    }

    removeNotification(notification) {
        notification.classList.add('fadeOut');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 200);
    }

    // Convenience methods
    error(title, message, details = null) {
        return this.showNotification('error', title, message, details);
    }

    warning(title, message, details = null) {
        return this.showNotification('warning', title, message, details, 6000);
    }

    success(title, message, details = null) {
        return this.showNotification('success', title, message, details, 4000);
    }

    info(title, message, details = null) {
        return this.showNotification('info', title, message, details, 5000);
    }

    // Enhanced fetch wrapper with better error handling
    async enhancedFetch(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            const data = await response.json();

            if (!response.ok) {
                const errorTitle = `HTTP ${response.status}: ${response.statusText}`;
                const errorMessage = data.error || 'An unexpected error occurred';
                this.error(errorTitle, errorMessage, {
                    url: url,
                    status: response.status,
                    details: data
                });
                throw new Error(`${errorTitle}: ${errorMessage}`);
            }

            return data;

        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                this.error('Connection Error', 'Unable to connect to the server. Please check if the backend is running.', {
                    url: url,
                    error: error.message
                });
            } else if (!error.message.includes('HTTP')) {
                // Only show notification if we haven't already shown one above
                this.error('Request Failed', error.message, {
                    url: url,
                    error: error.stack
                });
            }
            throw error;
        }
    }

    // Clear all notifications
    clearAll() {
        const notifications = this.container.querySelectorAll('.vl-error-notification');
        notifications.forEach(notification => this.removeNotification(notification));
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.VibeLab_ErrorManager = window.VibeLab_ErrorManager || new VibeLab_ErrorManager();
    
    // Add convenience global functions
    window.vlError = (title, message, details) => window.VibeLab_ErrorManager.error(title, message, details);
    window.vlWarning = (title, message, details) => window.VibeLab_ErrorManager.warning(title, message, details);
    window.vlSuccess = (title, message, details) => window.VibeLab_ErrorManager.success(title, message, details);
    window.vlInfo = (title, message, details) => window.VibeLab_ErrorManager.info(title, message, details);
    window.vlFetch = (url, options) => window.VibeLab_ErrorManager.enhancedFetch(url, options);
}
