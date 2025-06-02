/**
 * VibeLab API Service Layer - FastAPI Only
 * Centralized API communication for FastAPI backend
 */

class ApiService {
    constructor(baseUrl = 'http://localhost:8081') {
        this.baseUrl = baseUrl;
    }

    /**
     * Enhanced fetch wrapper with error handling
     */
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const requestOptions = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, requestOptions);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error(`API Request failed: ${endpoint}`, error);
            throw error;
        }
    }

    // ==================== GENERATION ENDPOINTS ====================

    /**
     * Generate content using LLM (FastAPI)
     */
    async generateContent(generationRequest) {
        const payload = {
            model: generationRequest.model,
            prompt: generationRequest.prompt,
            experiment_id: generationRequest.experiment_id,
            prompt_type: generationRequest.prompt_type || 'base',
            conversation_id: generationRequest.conversation_id,
            metadata: {
                variation_name: generationRequest.variation_name,
                variation_template: generationRequest.variation_template,
                instance_number: generationRequest.instance_number,
                ...generationRequest.metadata
            }
        };

        return await this.makeRequest('/api/v1/generate', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    /**
     * Process a queue item with proper data structure
     */
    async processGeneration(queueItem) {
        const fullPrompt = queueItem.variation.template.replace('{prompt}', queueItem.prompt);
        
        const generationRequest = {
            model: queueItem.model,
            prompt: fullPrompt,
            experiment_id: queueItem.experiment_id,
            prompt_type: queueItem.variation.type,
            variation_name: queueItem.variation.name,
            variation_template: queueItem.variation.template,
            instance_number: queueItem.instance,
            metadata: {
                original_prompt: queueItem.prompt,
                animated: queueItem.animated,
                queue_item_id: queueItem.id
            }
        };

        return await this.generateContent(generationRequest);
    }

    // ==================== EXPERIMENT ENDPOINTS ====================

    /**
     * Create a new experiment
     */
    async createExperiment(experimentData) {
        return await this.makeRequest('/api/v1/experiments', {
            method: 'POST',
            body: JSON.stringify(experimentData)
        });
    }

    /**
     * Get experiment by ID
     */
    async getExperiment(experimentId) {
        return await this.makeRequest(`/api/v1/experiments/${experimentId}`);
    }

    /**
     * Get all experiments
     */
    async getExperiments() {
        return await this.makeRequest('/api/v1/experiments');
    }

    // ==================== MODEL ENDPOINTS ====================

    /**
     * Get all registered models
     */
    async getModels() {
        return await this.makeRequest('/api/v1/models');
    }

    /**
     * Register a new model
     */
    async registerModel(modelData) {
        return await this.makeRequest('/api/v1/models', {
            method: 'POST',
            body: JSON.stringify(modelData)
        });
    }

    // ==================== UTILITY ENDPOINTS ====================

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const response = await this.makeRequest('/health');
            return { status: 'healthy', response };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }

    /**
     * Get API documentation URL
     */
    getDocsUrl() {
        return `${this.baseUrl}/docs`;
    }

    static async getSavedConsortiums() {
        try {
            const response = await fetch('http://localhost:8081/api/consortiums');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
                console.error('Error fetching saved consortiums:', response.status, errorData);
                return { success: false, message: errorData.message || `HTTP error ${response.status}` };
            }
            const data = await response.json();
            return { success: true, data: data };
        } catch (error) {
            console.error('Network or other error in getSavedConsortiums:', error);
            return { success: false, message: error.message || 'Network error' };
        }
    }

    static async getAvailableModels() {
        try {
            const response = await fetch('http://localhost:8081/api/available-models');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
                console.error('Error fetching available models:', response.status, errorData);
                return { success: false, message: errorData.message || `HTTP error ${response.status}`, data: [] };
            }
            const data = await response.json();
            // Expect data to be an array of objects like { id: "model-id", name: "Model Name" }
            if (Array.isArray(data)) {
                return { success: true, data: data };
            } else {
                console.error('Invalid format for available models:', data);
                return { success: false, message: 'Invalid format for available models', data: [] };
            }
        } catch (error) {
            console.error('Network or other error in getAvailableModels:', error);
            return { success: false, message: error.message || 'Network error', data: [] };
        }
    }
}
