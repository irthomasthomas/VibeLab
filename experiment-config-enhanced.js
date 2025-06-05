// Enhanced VibeLab Experiment Configuration

class ExperimentConfig {
    constructor() {
        this.techniques = [];
        this.prompts = [];
        this.loadStoredData();
    }

    loadStoredData() {
        this.prompts = JSON.parse(localStorage.getItem("vibelab-prompts") || "[]");
        this.techniques = JSON.parse(localStorage.getItem("vibelab-techniques") || "[]");
    }

    saveStoredData() {
        localStorage.setItem("vibelab-prompts", JSON.stringify(this.prompts));
        localStorage.setItem("vibelab-techniques", JSON.stringify(this.techniques));
    }
}

    savePrompt() {
        const name = document.getElementById('prompt-name').value.trim();
        const content = document.getElementById('prompt-content').value.trim();
        const category = document.getElementById('prompt-category').value;
        
        if (!name || !content) {
            this.showNotification('Please fill in prompt name and content', 'error');
            return;
        }

        // Check for duplicate names
        if (this.prompts.some(p => p.name === name)) {
            if (!confirm('A prompt with this name already exists. Overwrite?')) {
                return;
            }
            this.prompts = this.prompts.filter(p => p.name !== name);
        }
        
        const prompt = {
            id: Date.now(),
            name,
            content,
            category,
            created: new Date().toISOString()
        };
        
        this.prompts.push(prompt);
        this.saveStoredData();
        this.showNotification('Prompt saved successfully!', 'success');
        
        // Clear form
        document.getElementById('prompt-name').value = '';
        document.getElementById('prompt-content').value = '';
    }

    loadPrompts() {
        if (this.prompts.length === 0) {
            this.showNotification('No saved prompts found', 'info');
            return;
        }
        
        this.showPromptLibrary();
    }

    showPromptLibrary() {
        const modal = this.createModal('Prompt Library', this.renderPromptLibrary());
        document.body.appendChild(modal);
    }

    renderPromptLibrary() {
        return `
            <div class="prompt-library">
                <div class="library-controls">
                    <input type="text" id="prompt-search" placeholder="Search prompts..." 
                           onkeyup="experimentConfig.filterPrompts(this.value)">
                </div>
                <div id="prompt-list" class="prompt-list">
                    ${this.prompts.map(prompt => this.renderPromptItem(prompt)).join('')}
                </div>
            </div>
        `;
    }

    renderPromptItem(prompt) {
        return `
            <div class="prompt-item" data-id="${prompt.id}">
                <div class="prompt-header">
                    <h4>${prompt.name}</h4>
                    <span class="prompt-category">${prompt.category}</span>
                </div>
                <div class="prompt-preview">${prompt.content.substring(0, 100)}...</div>
                <div class="prompt-actions">
                    <button onclick="experimentConfig.usePrompt(${prompt.id})">Use</button>
                    <button onclick="experimentConfig.deletePrompt(${prompt.id})">Delete</button>
                </div>
            </div>
        `;
    }

    usePrompt(promptId) {
        const prompt = this.prompts.find(p => p.id === promptId);
        if (prompt) {
            document.getElementById('prompt-name').value = prompt.name;
            document.getElementById('prompt-content').value = prompt.content;
            document.getElementById('prompt-category').value = prompt.category;
            this.closeModal();
            this.showNotification('Prompt loaded successfully!', 'success');
        }
    }

    deletePrompt(promptId) {
        if (confirm('Are you sure you want to delete this prompt?')) {
            this.prompts = this.prompts.filter(p => p.id !== promptId);
            this.saveStoredData();
            this.showNotification('Prompt deleted successfully!', 'success');
            this.showPromptLibrary();
        }
    }

    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button onclick="experimentConfig.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        return modal;
    }

    closeModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    async generateBatch() {
        const experimentName = document.getElementById('experiment-name').value.trim();
        const batchSize = parseInt(document.getElementById('batch-size').value);
        const model = document.getElementById('model-selection').value;
        const promptContent = document.getElementById('prompt-content').value.trim();
        
        if (!experimentName || !promptContent) {
            this.showNotification('Please enter experiment name and prompt content', 'error');
            return;
        }

        const experimentConfig = {
            name: experimentName,
            prompt: promptContent,
            batchSize,
            model,
            created: new Date().toISOString()
        };

        try {
            this.showNotification('Generating experiment batch...', 'info');
            
            // TODO: Replace with actual API call
            const response = await this.simulateAPICall(experimentConfig);
            
            if (response.success) {
                this.showNotification(`Batch generated successfully! Experiment ID: ${response.experimentId}`, 'success');
            } else {
                throw new Error(response.error || 'Unknown error occurred');
            }
        } catch (error) {
            this.showNotification(`Error generating batch: ${error.message}`, 'error');
        }
    }

    async simulateAPICall(config) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
            success: true,
            experimentId: 'exp_' + Date.now(),
            message: 'Batch generation started'
        };
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.experimentConfig = new ExperimentConfig();
    
    // Override global functions
    window.savePrompt = () => window.experimentConfig.savePrompt();
    window.loadPrompts = () => window.experimentConfig.loadPrompts();
    window.generateBatch = () => window.experimentConfig.generateBatch();
});
