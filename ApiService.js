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
            
            // For 204 No Content, we don't expect JSON
            if (response.status === 204) {
                return null; // Or an object indicating success, like { success: true }
            }

            const contentType = response.headers.get('content-type');
            let responseData;

            if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                responseData = await response.text(); // Fallback for non-JSON responses
            }

            if (!response.ok) {
                // Try to use detail from JSON error response if available
                const errorMessage = responseData?.detail || responseData || `HTTP ${response.status}`;
                throw new Error(errorMessage);
            }
            return responseData;

        } catch (error) {
            console.error(`API Request failed: ${url}`, error.message);
            // Re-throw a more structured error or the original if it's already good.
            // For now, just re-throwing is fine. The caller should handle it.
            throw error;
        }
    }

    // ==================== TEMPLATE ENDPOINTS ====================
    /**
     * Create a new template
     * @param {object} templateData - { name, prompt, tags?, animated? }
     */
    async createTemplate(templateData) {
        return await this.makeRequest('/api/v1/templates', {
            method: 'POST',
            body: JSON.stringify(templateData)
        });
    }

    /**
     * Get all templates
     */
    async getAllTemplates() {
        // The backend for /api/v1/templates returns List[TemplateResponse] directly
        return await this.makeRequest('/api/v1/templates');
    }

    /**
     * Get a specific template by ID
     * @param {string} templateId
     */
    async getTemplateById(templateId) {
        return await this.makeRequest(`/api/v1/templates/${templateId}`);
    }

    /**
     * Update an existing template
     * @param {string} templateId
     * @param {object} templateData - { name?, prompt?, tags?, animated? }
     */
    async updateTemplate(templateId, templateData) {
        return await this.makeRequest(`/api/v1/templates/${templateId}`, {
            method: 'PUT',
            body: JSON.stringify(templateData)
        });
    }

    /**
     * Delete a template by ID
     * @param {string} templateId
     */
    async deleteTemplate(templateId) {
        // Expects 204 No Content on success
        return await this.makeRequest(`/api/v1/templates/${templateId}`, {
            method: 'DELETE'
        });
    }


    // ==================== GENERATION ENDPOINTS ====================

    /**
     * Generate content using LLM (FastAPI)
     */
    async generateContent(generationRequest) {
        // Ensure metadata is an object
        const metadata = {
            ...(generationRequest.variation_name && { variation_name: generationRequest.variation_name }),
            ...(generationRequest.variation_template && { variation_template: generationRequest.variation_template }),
            ...(generationRequest.instance_number && { instance_number: generationRequest.instance_number }),
            ...(generationRequest.metadata || {}) // Spread existing metadata
        };
        
        const payload = {
            model: generationRequest.model,
            prompt: generationRequest.prompt,
            experiment_id: generationRequest.experiment_id,
            prompt_type: generationRequest.prompt_type || 'base',
            conversation_id: generationRequest.conversation_id,
            prompt_id: generationRequest.prompt_id, // Added prompt_id to payload
            metadata: metadata
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
        // queueItem.prompt is already { text: "...", animated: ... }
        // fullPrompt needs to use queueItem.prompt.text
        const fullPrompt = queueItem.variation.template.replace('{prompt}', queueItem.prompt.text); 
        
        const generationRequest = {
            model: queueItem.model,
            prompt: fullPrompt,
            experiment_id: queueItem.experiment_id,
            prompt_type: queueItem.variation.type, // This is the technique type
            // variation_name: queueItem.variation.name, // These are now part of metadata
            // variation_template: queueItem.variation.template,
            // instance_number: queueItem.instance,
            metadata: {
                original_prompt_text: queueItem.prompt.text, // Store original text
                animated: queueItem.prompt.animated,
                queue_item_id: queueItem.id,
                variation_name: queueItem.variation.name, // Keep variation details in metadata
                variation_type: queueItem.variation.type, // Redundant with prompt_type but ok for logs
                instance_number: queueItem.instance, // Keep instance number
            }
            // prompt_id can be passed if the prompt template itself was saved and has an ID
            // This is not the same as queueItem.id
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

    // ... (existing ApiService methods) ...

    // ==================== EVALUATION ENDPOINTS ====================
    /**
     * Submit evaluation rankings for an experiment
     * @param {string} experimentId
     * @param {Array<object>} evaluations - Array of { generation_id, rank, quality_score?, evaluator_id? }
     */
    async submitEvaluations(experimentId, evaluations) {
        const payload = {
            experiment_id: experimentId,
            evaluations: evaluations
        };
        // The backend endpoint is /api/v1/evaluations
        // It returns a detailed response, including potential partial errors.
        return await this.makeRequest('/api/v1/evaluations', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    // Ensure this new method is correctly indented within the ApiService class.
    // It can go after MODEL ENDPOINTS or before UTILITY ENDPOINTS.
    // ==================== UTILITY ENDPOINTS ====================

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const response = await this.makeRequest('/health');
            // Assuming /health returns JSON like {"status": "healthy", ...}
            return response; // Return the parsed JSON directly
        } catch (error) {
            // makeRequest already logs and throws, but we can catch to return a specific structure
            return { status: 'unhealthy', error: error.message, detail: error };
        }
    }

    /**
     * Get API documentation URL
     */
    getDocsUrl() {
        return `${this.baseUrl}/docs`;
    }

    // These static methods directly use fetch. They could be instance methods or use makeRequest.
    // For now, keeping them static as they are used that way in app.js.
    async getSavedConsortiums(baseUrl = this.baseUrl) {
        try {
            // Note: Using a passed baseUrl or a default if not an instance method context
            const response = await fetch(`${baseUrl}/api/consortiums`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Failed to parse error response from /api/consortiums' }));
                console.error('Error fetching saved consortiums:', response.status, errorData);
                // FastAPI often returns { "detail": "message" } for errors
                throw new Error(errorData.detail || `HTTP error ${response.status}`);
            }
            // Backend returns List directly for /api/consortiums
            return await response.json(); 
        } catch (error) {
            console.error('Network or other error in getSavedConsortiums:', error);
            throw error; // Re-throw for the caller (e.g., ErrorDisplay) to handle
        }
    }

    async getAvailableModels(baseUrl = this.baseUrl) {
        try {
            const response = await fetch(`${baseUrl}/api/available-models`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Failed to parse error from /api/available-models' }));
                console.error('Error fetching available models:', response.status, errorData);
                throw new Error(errorData.detail || `HTTP error ${response.status}`);
            }
            const data = await response.json();
            if (Array.isArray(data)) {
                return data; // Return the array of models directly
            } else {
                console.error('Invalid format for available models:', data);
                throw new Error('Invalid format for available models response');
            }
        } catch (error) {
            console.error('Network or other error in getAvailableModels:', error);
            throw error;
        }
    }
}
