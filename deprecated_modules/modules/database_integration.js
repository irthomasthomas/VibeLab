// Database Integration Enhancement for VibeLab
// Adds persistent storage for experiments

class DatabaseAPI {
    constructor(baseURL = 'http://localhost:8081') {
        this.baseURL = baseURL;
    }
    
    async createExperiment(experimentData) {
        const response = await fetch(`${this.baseURL}/api/experiments`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(experimentData)
        });
        
        if (!response.ok) throw new Error('Failed to create experiment');
        return response.json();
    }
    
    async getExperiment(experimentId) {
        const response = await fetch(`${this.baseURL}/api/experiments/${experimentId}`);
        if (!response.ok) throw new Error('Failed to get experiment');
        return response.json();
    }
    
    async listExperiments() {
        const response = await fetch(`${this.baseURL}/api/experiments`);
        if (!response.ok) throw new Error('Failed to list experiments');
        return response.json();
    }
    
    async saveRanking(rankingData) {
        const response = await fetch(`${this.baseURL}/api/rankings`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(rankingData)
        });
        
        if (!response.ok) throw new Error('Failed to save ranking');
        return response.json();
    }
    
    async registerModel(modelData) {
        const response = await fetch(`${this.baseURL}/api/models`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(modelData)
        });
        
        if (!response.ok) throw new Error('Failed to register model');
        return response.json();
    }
}

// Update createExperiment to use database;
VibeLab.prototype.createExperiment = async function() {
    const prompts = this.getPrompts();
    const models = this.getSelectedModels();
    const variations = this.getPromptVariations();
    const svgsPerVar = parseInt(document.getElementById('svgs-per-var').value) || 4;
    const skipBaseline = document.getElementById('skip-baseline').checked;
    const experimentName = document.getElementById('experiment-name').value ||
                          `Experiment_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}`;
    
    if (prompts.length === 0) {
        alert('Please enter at least one prompt');
        return;
    }
    
    if (models.length === 0) {
        alert('Please select at least one model');
        return;
    }
    
    try {
        // Create experiment in database
        const dbAPI = new DatabaseAPI();
        const experimentData = {
            name: experimentName,
            description: `Testing ${prompts.length} prompts with ${models.length} models`,
            config: {
                skipBaseline,
                svgsPerVar,
                variations,
                prompts,
                models
            }
        };
        
        const dbExperiment = await dbAPI.createExperiment(experimentData);
        
        this.currentExperiment = {
            id: dbExperiment.id,  // Use database ID
            name: experimentName,
            created: new Date().toISOString(),
            skipBaseline,
            prompts,
            models,
            variations,
            svgsPerVar,
            results: []
        };
        
        // Register models if not already registered
        for (const model of models) {
            try {
                await dbAPI.registerModel({
                    name: model,
                    type: 'base'  // Will be enhanced for consortium detection
                });
            } catch (e) {
                console.log(`Model ${model} might already be registered`);
            }
        }
        
        this.generateQueue();
        this.switchTab('queue');
        
        document.getElementById('queue-status').textContent =
            `Experiment "${experimentName}" created with ${this.generationQueue.length} tasks`;
    } catch (error) {
        alert(`Failed to create experiment: ${error.message}`);
    }
};
